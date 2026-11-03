import Settings from '@/interfaces/Settings';
import type { ClaimResult } from '@/lib/agentHost';
import { DEFAULT_SQLMCP_PORT, parseSqlmcpPort } from '@/lib/sqlmcpPort';
import SettingsModel from '../models/SettingsModel';
import { Database } from 'sqlite';
import ChatModel from '../models/ChatModel';
import MessageModel from '../models/MessageModel';
import Connection from '@/interfaces/Connection';
import type ChatSearchHit from '@/interfaces/ChatSearchHit';
import { DEFAULT_CURSOR_CLI_COMMAND, DEFAULT_OPENCODE_CLI_COMMAND } from '@/constants/cliDefaults';

const SNIPPET_MAX_LENGTH = 160
function cutSnippet(
  messageText: string,
  matchStart: number,
  matchLength: number,
): string {
  const textLength = messageText.length
  if (textLength === 0) {
    return ''
  }

  let from: number
  let to: number

  if (matchStart < 0 || matchStart >= textLength) {
    from = 0
    to = Math.min(SNIPPET_MAX_LENGTH, textLength)
  } else {
    const matchEnd = Math.min(textLength, matchStart + Math.max(0, matchLength))
    const matchSpan = matchEnd - matchStart
    if (matchSpan >= SNIPPET_MAX_LENGTH) {
      from = matchStart
      to = Math.min(textLength, matchStart + SNIPPET_MAX_LENGTH)
    } else {
      const extra = SNIPPET_MAX_LENGTH - matchSpan
      const before = Math.floor(extra / 2)
      from = matchStart - before
      to = matchEnd + (extra - before)
      if (from < 0) {
        to = Math.min(textLength, to - from)
        from = 0
      }
      if (to > textLength) {
        from = Math.max(0, from - (to - textLength))
        to = textLength
      }
    }
  }

  const body = messageText.slice(from, to).replace(/\s+/g, ' ')
  const prefix = from > 0 ? '...' : ''
  const suffix = to < textLength ? '...' : ''
  return prefix + body + suffix
}

function parseCliCommand(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ''
  return trimmed
}

type ConnectionRow = Omit<Connection, 'sqlalchemy_query'> & {
  sqlalchemy_query: string | null;
};

type ChatSearchRow = {
  id: number;
  connectionId: number;
  name: string;
  createdAt: string;
  sessionId: string;
  provider: string;
  messageText: string;
  matchStart: number;
};

function knownProvider(value: string | null): string | null {
  if (value === 'cursor' || value === 'opencode') {
    return value;
  }
  return null;
}

// A missing provider is NULL on databases whose Provider column was added
// without a default, and '' after the backfill below. Both mean unclaimed.
function isUnclaimed(value: string | null): boolean {
  return value === null || value === '';
}

class DBManager {
  constructor(private readonly db: Database) {}

  async getConnections(): Promise<Connection[]> {
    const rows = await this.db.all<ConnectionRow[]>(`
      SELECT
        ID AS id,
        Name AS name,
        DBMS AS dbms,
        Host AS host,
        Username AS username,
        Password AS password,
        Database AS database,
        sqlalchemy_query AS sqlalchemy_query
      FROM Connection;
    `);

    return rows.map((row) => ({
      ...row,
      sqlalchemy_query: parseSqlalchemyQuery(row.sqlalchemy_query),
    }));
  }

  async addConnection(connection: Omit<Connection, 'id'>): Promise<number> {
    const result = await this.db.run(
      `
        INSERT INTO Connection (Name, DBMS, Host, Username, Password, Database, sqlalchemy_query)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [
        connection.name,
        connection.dbms,
        connection.host,
        connection.username,
        connection.password,
        connection.database,
        JSON.stringify(connection.sqlalchemy_query || {}),
      ],
    )

    return result.lastID!
  }
  async editConnection(connection: Connection): Promise<void> {
    await this.db.run(
      `
        UPDATE Connection
        SET
          Name = ?,
          DBMS = ?,
          Host = ?,
          Username = ?,
          Password = ?,
          Database = ?,
          sqlalchemy_query = ?
        WHERE ID = ?;
      `,
      [
        connection.name,
        connection.dbms,
        connection.host,
        connection.username,
        connection.password,
        connection.database,
        JSON.stringify(connection.sqlalchemy_query || {}),
        connection.id,
      ],
    );
  }

  async deleteConnection(connectionId: number): Promise<void> {
    await this.db.run(
      `
        DELETE FROM Connection WHERE ID = ?;
      `,
      [connectionId],
    );
  }

  async getChatsByConnection(connectionId: number): Promise<ChatModel[]> {
    return this.db.all<ChatModel[]>(
      `
        SELECT
          ID AS id,
          ConnectionID AS connectionId,
          Name AS name,
          CreatedAt AS createdAt,
          SessionID AS sessionId,
          Provider AS provider
        FROM Chat
        WHERE ConnectionID = ?
        ORDER BY ID;
      `,
      [connectionId],
    );
  }

  async getChat(chatId: number): Promise<ChatModel | undefined> {
    return this.db.get<ChatModel>(
      `
        SELECT
          ID AS id,
          ConnectionID AS connectionId,
          Name AS name,
          CreatedAt AS createdAt,
          SessionID AS sessionId,
          Provider AS provider
        FROM Chat
        WHERE ID = ?;
      `,
      [chatId],
    );
  }

  async addChat(connectionId: number, name: string): Promise<ChatModel> {
    const result = await this.db.run(
      `
        INSERT INTO Chat (ConnectionID, Name, SessionID, Provider)
        VALUES (?, ?, '', '');
      `,
      [connectionId, name],
    );

    const chat = await this.db.get<ChatModel>(
      `
        SELECT
          ID AS id,
          ConnectionID AS connectionId,
          Name AS name,
          CreatedAt AS createdAt,
          SessionID AS sessionId,
          Provider AS provider
        FROM Chat
        WHERE ID = ?;
      `,
      [result.lastID],
    );

    return chat!;
  }

  async searchChats(query: string, limit = 50): Promise<ChatSearchHit[]> {
    const needle = query.trim();
    // SQLite instr(text, '') is 1 for every row, so an empty needle would
    // return the newest message of each chat instead of no hits.
    if (!needle) {
      return [];
    }

    const rows = await this.db.all<ChatSearchRow[]>(
      `
        SELECT
          id,
          connectionId,
          name,
          createdAt,
          sessionId,
          provider,
          messageText,
          matchStart
        FROM (
          SELECT
            Chat.ID AS id,
            Chat.ConnectionID AS connectionId,
            Chat.Name AS name,
            Chat.CreatedAt AS createdAt,
            Chat.SessionID AS sessionId,
            Chat.Provider AS provider,
            Message.Message AS messageText,
            instr(lower(Message.Message), lower(?)) - 1 AS matchStart,
            ROW_NUMBER() OVER (
              PARTITION BY Chat.ID
              ORDER BY Message.CreatedAt DESC, Message.ID DESC
            ) AS rn,
            Message.CreatedAt AS messageCreatedAt,
            Message.ID AS messageRowId
          FROM Message
          INNER JOIN Chat ON Chat.ID = Message.ChatID
          WHERE instr(lower(Message.Message), lower(?)) > 0
        ) AS ranked
        WHERE rn = 1
        ORDER BY messageCreatedAt DESC, messageRowId DESC
        LIMIT ?;
      `,
      [needle, needle, limit],
    );

    return rows.map((row) => ({
      chat: {
        id: row.id,
        connectionId: row.connectionId,
        name: row.name,
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        provider: row.provider,
      },
      snippet: cutSnippet(row.messageText, row.matchStart, needle.length),
    }));
  }

  async createSettingsTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS Settings (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Key TEXT NOT NULL UNIQUE,
        Value TEXT NOT NULL
      );
    `);
  }

  async createConnectionTable(): Promise<void> {
    await this.db.exec(`
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
  }

  async createChatTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS Chat (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ConnectionID INTEGER NOT NULL,
        Name TEXT NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        SessionID TEXT,
        Provider TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (ConnectionID) REFERENCES Connection(ID) ON DELETE CASCADE
      );
    `);
  }

  async createMessageTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS Message (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ChatID INTEGER NOT NULL,
        MessageID TEXT,
        Message TEXT NOT NULL,
        Role INTEGER NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ChatID) REFERENCES Chat(ID) ON DELETE CASCADE
      );
    `);
  }

  async ensureMessageColumns(): Promise<void> {
    const table = await this.db.get<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE name = 'Message'`,
    );
    if (!table) {
      return;
    }
    const columns = await this.db.all<{ name: string; notnull: number }[]>(`PRAGMA table_info(Message)`);
    if (!columns.some((column) => column.name === 'MessageID')) {
      await this.db.exec(`ALTER TABLE Message ADD COLUMN MessageID TEXT`);
    }
    if (!columns.some((column) => column.name === 'Role')) {
      await this.db.exec(`ALTER TABLE Message ADD COLUMN Role INTEGER NOT NULL DEFAULT 0`);
    }
    if (columns.some((column) => column.name === 'MessageID' && column.notnull)) {
      try {
        await this.db.exec(`
          BEGIN;
          CREATE TABLE Message_new (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            ChatID INTEGER NOT NULL,
            MessageID TEXT,
            Message TEXT NOT NULL,
            Role INTEGER NOT NULL,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ChatID) REFERENCES Chat(ID) ON DELETE CASCADE
          );
          INSERT INTO Message_new (ID, ChatID, MessageID, Message, Role, CreatedAt)
          SELECT ID, ChatID, MessageID, Message, Role, CreatedAt FROM Message;
          DROP TABLE Message;
          ALTER TABLE Message_new RENAME TO Message;
          COMMIT;
        `);
      } catch (error) {
        await this.db.exec('ROLLBACK');
        throw error;
      }
    }
  }

  async insertDefaultSettings(): Promise<void> {
    const defaults: [string, string][] = [
      ['theme', 'light'],
      ['opencode_integration_enabled', 'false'],
      ["opencode_binary", DEFAULT_OPENCODE_CLI_COMMAND],
      ['cursor_cli_integration_enabled', 'false'],
      ["cursor_cli_binary", DEFAULT_CURSOR_CLI_COMMAND],
      ['sqlmcp_port', String(DEFAULT_SQLMCP_PORT)],
    ];

    for (const [key, value] of defaults) {
      await this.db.run(
        `INSERT INTO Settings (Key, Value) VALUES (?, ?);`,
        [key, value],
      );
    }
  }

  async ensureChatProviderColumn(): Promise<void> {
    const columns = await this.db.all<{ name: string }[]>(`PRAGMA table_info(Chat)`);
    if (!columns.some((column) => column.name === 'Provider')) {
      await this.db.exec(`ALTER TABLE Chat ADD COLUMN Provider TEXT NOT NULL DEFAULT ''`);
    }

    // Chats that already have a session were opened through Cursor. New chats stay unset.
    // NULL and '' are both unclaimed. Older databases stored NULL because the column
    // had no default, and a claim compared that NULL to '' and reported the chat missing.
    await this.db.run(`
      UPDATE Chat
      SET Provider = 'cursor'
      WHERE (Provider IS NULL OR Provider = '')
        AND SessionID IS NOT NULL AND SessionID != '';
    `);
    await this.db.run(`UPDATE Chat SET Provider = '' WHERE Provider IS NULL`);
  }

  async claimChatProvider(chatId: number, provider: string): Promise<ClaimResult> {
    const row = await this.db.get<{ provider: string | null }>(
      `
        SELECT Provider AS provider
        FROM Chat
        WHERE ID = ?;
      `,
      [chatId],
    );
    if (!row) {
      return { ok: false, stored: null };
    }
    if (row.provider === provider) {
      return { ok: true };
    }
    if (!isUnclaimed(row.provider)) {
      return { ok: false, stored: knownProvider(row.provider) };
    }

    // A second send can write the provider between the read above and this update.
    const result = await this.db.run(
      `
        UPDATE Chat
        SET Provider = ?
        WHERE ID = ? AND (Provider IS NULL OR Provider = '');
      `,
      [provider, chatId],
    );
    if ((result.changes ?? 0) > 0) {
      return { ok: true };
    }

    const again = await this.db.get<{ provider: string | null }>(
      `
        SELECT Provider AS provider
        FROM Chat
        WHERE ID = ?;
      `,
      [chatId],
    );
    if (!again) {
      return { ok: false, stored: null };
    }
    if (again.provider === provider) {
      return { ok: true };
    }
    return { ok: false, stored: knownProvider(again.provider) };
  }

  async updateChatSessionId(chatId: number, sessionId: string): Promise<void> {
    await this.db.run(
      `
        UPDATE Chat
        SET SessionID = ?
        WHERE ID = ?;
      `,
      [sessionId, chatId],
    );
  }

  async renameChat(chatId: number, name: string): Promise<void> {
    await this.db.run(
      `
        UPDATE Chat
        SET Name = ?
        WHERE ID = ?;
      `,
      [name, chatId],
    );
  }

  async deleteChat(chatId: number): Promise<void> {
    await this.db.run(
      `
        DELETE FROM Chat WHERE ID = ?;
      `,
      [chatId],
    );
  }

  async getSettings(): Promise<Settings> {
    const rows = await this.db.all<SettingsModel[]>(`
      SELECT
        ID AS id,
        Key AS key,
        Value AS value
      FROM Settings;
    `);

    const settingsObject: Partial<Settings> = {};
    let storedSqlmcpPort: string | undefined;

    for (const row of rows) {
      if (row.key === 'theme' && (row.value === 'light' || row.value === 'dark')) {
        settingsObject.theme = row.value;
        continue;
      }

      if (row.key === 'opencode_integration_enabled') {
        settingsObject.opencode_integration_enabled = row.value === 'true';
        continue;
      }

      if (row.key === 'opencode_binary') {
        settingsObject.opencode_binary = row.value;
        continue;
      }

      if (row.key === 'cursor_cli_integration_enabled') {
        settingsObject.cursor_cli_integration_enabled = row.value === 'true';
        continue;
      }

      if (row.key === 'cursor_cli_binary') {
        settingsObject.cursor_cli_binary = row.value;
        continue;
      }

      if (row.key === 'sqlmcp_port') {
        storedSqlmcpPort = row.value;
      }
    }

    return {
      theme: settingsObject.theme ?? 'light',
      opencode_integration_enabled: settingsObject.opencode_integration_enabled ?? true,
      opencode_binary: settingsObject.opencode_binary ?? 'opencode',
      cursor_cli_integration_enabled: settingsObject.cursor_cli_integration_enabled ?? true,
      cursor_cli_binary: parseCliCommand(settingsObject.cursor_cli_binary) ?? DEFAULT_CURSOR_CLI_COMMAND,
      sqlmcp_port: parseSqlmcpPort(storedSqlmcpPort ?? '') ?? DEFAULT_SQLMCP_PORT,
    };
  }

  async getCursorCliCommand(): Promise<string> {
    const row = await this.db.get<SettingsModel>(
      `
        SELECT Value AS value
        FROM Settings
        WHERE Key = ?;
      `,
      ["cursor_cli_binary"],
    );

    return parseCliCommand(row?.value) ?? DEFAULT_CURSOR_CLI_COMMAND;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await this.db.run(
      `
        INSERT INTO Settings (Key, Value)
        VALUES (?, ?)
        ON CONFLICT(Key) DO UPDATE SET Value = excluded.Value;
      `,
      [key, value],
    );
  }

  async closeConnection(): Promise<void> {
    await this.db.close();
  }

  async getMessage(messageId: string): Promise<MessageModel | undefined> {
    return this.db.get<MessageModel>(
      `
        SELECT
          ChatID AS chatId,
          MessageID AS messageId,
          Role AS role,
          Message AS message
        FROM Message
        WHERE MessageID = ?;
      `,
      [messageId],
    );
  }

  async addMessage(chatId: number, messageId: string | null, message: string, role: number): Promise<void> {
    await this.db.run(
      `
        INSERT INTO Message (ChatID, MessageID, Message, Role)
        VALUES (?, ?, ?, ?);
      `,
      [chatId, messageId, message, role],
    );
  }

}

function parseSqlalchemyQuery(rawValue: string | null): Record<string, string> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)]),
    );
  } catch {
    return {};
  }

}

export default DBManager;
