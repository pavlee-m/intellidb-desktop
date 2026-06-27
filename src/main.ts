import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import started from 'electron-squirrel-startup';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import DBManager from './lib/DBManager';
import Settings from './interfaces/Settings';
import Connection from './interfaces/Connection';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let dbManager: DBManager;
let settings: Settings;
let connections: Connection[] = [];

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
        FOREIGN KEY (ConnectionID) REFERENCES Connection(ID) ON DELETE CASCADE
      );
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Message (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ChatID INTEGER NOT NULL,
        Role TEXT NOT NULL,
        Content TEXT NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ChatID) REFERENCES Chat(ID) ON DELETE CASCADE
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
  }
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  await initDatabase();
  settings = await dbManager.getSettings();

  ipcMain.handle('settings:get', async () => {
    return settings;
  });

  ipcMain.handle('settings:update', async (_event, key: string, value: string) => {
    await dbManager.updateSetting(key, value);
    settings = await dbManager.getSettings();
    return settings;
  });

  createWindow();
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
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
