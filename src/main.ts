import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';
import started from 'electron-squirrel-startup';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import DBManager from './lib/DBManager';
import Settings from './interfaces/Settings';
import Connection from './interfaces/Connection';
import { ChildProcess, execFile, spawn } from 'node:child_process';
import BackendConnection from './interfaces/BackendConnection';
import { ensureAgent, promptAgent, setAgentSessionPersister, disposeAgent, disposeAllAgents } from './lib/AgentHost';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let dbManager: DBManager;
let settings: Settings;
let connections: BackendConnection[] = [];
let backendProcess: ChildProcess;

const BACKEND_URL = 'http://localhost:8000';
const execFileAsync = promisify(execFile);

function toBackendConnection(connection: Connection): BackendConnection {
  return {
    backendConnectionId: '',
    connection,
  };
}

async function parseBackendResponse(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Backend request failed');
  }

  return data;
}

async function initDatabase() {
  const dbPath = path.join(os.homedir(), '.intellidb', 'config.db');
  await fs.promises.mkdir(path.join(os.homedir(), '.intellidb'), { recursive: true });
  const dbExists = fs.existsSync(dbPath);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  dbManager = new DBManager(db);

  // Check if sqlite database exists, if not create it
  if (!dbExists) {
    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Settings (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Key TEXT NOT NULL UNIQUE,
        Value TEXT NOT NULL
      );
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Connection (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        DBMS TEXT NOT NULL,
        Host TEXT NOT NULL,
        Username TEXT NOT NULL,
        Password TEXT NOT NULL,
        Database TEXT NOT NULL,
        sqlalchemy_query TEXT
      );
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Chat (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ConnectionID INTEGER NOT NULL,
        Name TEXT NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        SessionID TEXT,
        FOREIGN KEY (ConnectionID) REFERENCES Connection(ID) ON DELETE CASCADE
      );
    `);

    // Insert default settings
    await db.exec(`
      INSERT INTO Settings (Key, Value) VALUES
      ('theme', 'light');
    `);

    await db.exec(`
      INSERT INTO Settings (Key, Value) VALUES
      ('opencode_integration_enabled', 'false');
    `);

    await db.exec(`
      INSERT INTO Settings (Key, Value) VALUES
      ('opencode_binary', 'opencode');
    `);

    await db.exec(`
      INSERT INTO Settings (Key, Value) VALUES
      ('cursor_cli_integration_enabled', 'false');
    `);

    await db.exec(`
      INSERT INTO Settings (Key, Value) VALUES
      ('cursor_cli_binary', 'cursor-agent');
    `);
  }
}

function getBackendDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }

  return path.join(__dirname, 'backend');
}

async function waitUntilBackendResponsive(): Promise<boolean> {
  let noOfRetries = 0;

  return new Promise<boolean>((resolve) => {
    const id = setInterval(async () => {
      try {
        const data = await fetch(`${BACKEND_URL}/connections`);
        if (data.ok) {
          clearInterval(id);
          resolve(true);
          return;
        }

        noOfRetries++;
        if (noOfRetries >= 5) {
          clearInterval(id);
          resolve(false);
        }
      } catch {
        noOfRetries++;
        if (noOfRetries >= 5) {
          clearInterval(id);
          resolve(false);
        }
      }
    }, 500);
  });
}


async function startBackend(): Promise<boolean> {
  const backendDir = getBackendDir();
  const backendPath = path.join(backendDir, 'sqlmcp.bin');

  if (!backendProcess || backendProcess.killed || backendProcess.exitCode !== null) {
    if (!fs.existsSync(backendPath)) {
      console.error('Backend binary not found:', backendPath);
      return false;
    }

    backendProcess = spawn(backendPath, [], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
    });

    backendProcess.once('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error('Backend exited immediately with code', code);
      }
    });

    if (!backendProcess.pid) {
      return false;
    }
  }

  const ok = await waitUntilBackendResponsive();
  if (ok) {
    return true;
  } else {
    return false;
  }
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key.toLowerCase() === 'r' && (input.control || input.meta)) {
      event.preventDefault();
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
  });
}

async function killProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  const pid = child.pid;

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/pid', String(pid), '/T', '/F']);
    return;
  }

  process.kill(-pid, 'SIGKILL');
  await waitForExit(child);
}

app.on('before-quit', async (event) => {
  event.preventDefault();

  try {
    await dbManager.closeConnection();

    if (backendProcess) {
      await killProcessTree(backendProcess);
    }

    disposeAllAgents();
  }
  catch (e) {
    console.log(e);
  }
  finally {
    app.exit(0);
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  Menu.setApplicationMenu(null);
  try {
    if (!await startBackend()) {
      console.error('Failed to start backend');
      app.quit();
      return;
    }
    const response = await fetch(`${BACKEND_URL}/connections`);
    const data = await response.json();
    console.log(data);
    await initDatabase();
    settings = await dbManager.getSettings();
    const cons: Connection[] = await dbManager.getConnections();
    connections = cons.map(toBackendConnection);
    ipcMain.handle('settings:get', async () => {
      return settings;
    });

    ipcMain.handle('connections:get', async () => {
      return connections;
    });

    ipcMain.handle('connections:add', async (_event, connection: Omit<Connection, 'id'>) => {
      const id = await dbManager.addConnection(connection);
      const addedConnection = (await dbManager.getConnections()).find(
        (currentConnection) => currentConnection.id === id,
      );

      if (addedConnection) {
        connections = [...connections, toBackendConnection(addedConnection)];
      }

      return id;
    });

    ipcMain.handle('connections:delete', async (_event, connectionId: number) => {
      const existingConnection = connections.find(
        ({ connection }) => connection.id === connectionId,
      );

      if (existingConnection?.backendConnectionId) {
        await parseBackendResponse(await fetch(`${BACKEND_URL}/close_db`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: existingConnection.backendConnectionId }),
        }));
      }

      await dbManager.deleteConnection(connectionId);
      connections = connections.filter(
        ({ connection }) => connection.id !== connectionId,
      );
    });

    ipcMain.handle('connections:edit', async (_event, connection: Connection) => {
      const existingConnection = connections.find(
        ({ connection: currentConnection }) => currentConnection.id === connection.id,
      );

      if (existingConnection?.backendConnectionId) {
        await parseBackendResponse(await fetch(`${BACKEND_URL}/close_db`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: existingConnection.backendConnectionId }),
        }));
      }

      await dbManager.editConnection(connection);
      connections = connections.map((backendConnection) =>
        backendConnection.connection.id === connection.id
          ? toBackendConnection(connection)
          : backendConnection,
      );
    });

    ipcMain.handle('connections:connect', async (_event, connectionId: number) => {
      const existingConnection = connections.find(
        ({ connection }) => connection.id === connectionId,
      );
      if (!existingConnection) {
        throw new Error('Connection not found');
      }
      const data = await parseBackendResponse(await fetch(`${BACKEND_URL}/connect_db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbms: existingConnection.connection.dbms,
          username: existingConnection.connection.username,
          password: existingConnection.connection.password,
          database: existingConnection.connection.database,
          host: existingConnection.connection.host,
          conn_query: existingConnection.connection.sqlalchemy_query,
        }),
      }));
      console.log(data);
      if (typeof data.connection_id !== 'string' || !data.connection_id) {
        throw new Error('Backend did not return a connection ID');
      }
      connections = connections.map((backendConnection) =>
        backendConnection.connection.id === connectionId
          ? { ...backendConnection, backendConnectionId: data.connection_id as string }
          : backendConnection,
      );
      return data.connection_id as string;
    });

    ipcMain.handle('connections:disconnect', async (_event, connectionId: number) => {
      const existingConnection = connections.find(
        ({ connection }) => connection.id === connectionId,
      );

      if (!existingConnection?.backendConnectionId) {
        return;
      }

      await parseBackendResponse(await fetch(`${BACKEND_URL}/close_db`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: existingConnection.backendConnectionId }),
      }));

      connections = connections.map((backendConnection) =>
        backendConnection.connection.id === connectionId
          ? { ...backendConnection, backendConnectionId: '' }
          : backendConnection,
      );
    });

    ipcMain.handle('chats:get', async (_event, connectionId: number) => {
      return dbManager.getChatsByConnection(connectionId);
    });

    ipcMain.handle('chats:add', async (_event, connectionId: number) => {
      const existingConnection = connections.find(
        ({ connection }) => connection.id === connectionId,
      );
      if (!existingConnection || !existingConnection.backendConnectionId) {
        throw new Error('Connect the database before creating chats');
      }
      return dbManager.addChat(connectionId, 'New chat');
    });

    ipcMain.handle('chats:rename', async (_event, chatId: number, name: string) => {
      await dbManager.renameChat(chatId, name);
    });

    ipcMain.handle('chats:delete', async (_event, chatId: number) => {
      await dbManager.deleteChat(chatId);
      disposeAgent(chatId);
    });

    // Give the agent host a method to persist the session id to the database.
    setAgentSessionPersister((chatId, sessionId) => dbManager.updateChatSessionId(chatId, sessionId));

    ipcMain.handle('agent:connect', async (event, chatId: number, sessionId: string) : Promise<string> => {
      const chat = await dbManager.getChat(chatId);
      if (chat) {
        const existingConnection = connections.find(
          ({ connection }) => connection.id === chat.connectionId,
        );
        if (!existingConnection || !existingConnection.backendConnectionId) {
          throw new Error('Connect the database before using the agent');
        }
      }
      return ensureAgent(chatId, sessionId, (entry) => event.sender.send('agent:activity', { chatId, entry }));
    });

    ipcMain.handle('agent:prompt', async (_event, chatId: number, text: string) => {
      const chat = await dbManager.getChat(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }
      const existingConnection = connections.find(
        ({ connection }) => connection.id === chat.connectionId,
      );
      if (!existingConnection || !existingConnection.backendConnectionId) {
        throw new Error('Connect the database before sending messages');
      }
      return promptAgent(chatId, text);
    });

    ipcMain.handle('settings:update', async (_event, key: string, value: string) => {
      await dbManager.updateSetting(key, value);
      // Find a good way to update in memory, instead of reading db every time.
      // TODO: Make all the settings update the store.
      settings = await dbManager.getSettings();
      return settings;
    });

    await createWindow();
  } catch (err) {
    console.error('Failed to initialize app:', err);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
