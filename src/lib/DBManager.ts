import Settings from '@/interfaces/Settings';
import type { CliProvider } from '@/lib/cliCommand';
import type { ClaimResult } from '@/lib/agentHost';
import { CURSOR_CLI_BINARY_KEY, parseCursorCliCommand, type CursorCliCommand } from '@/lib/cursorCliCommand';
import { DEFAULT_SQLMCP_PORT, parseSqlmcpPort } from '@/lib/sqlmcpPort';
import SettingsModel from '../models/SettingsModel';
import { Database } from 'sqlite';
import ChatModel from '../models/ChatModel';
import Connection from '@/interfaces/Connection';

type ConnectionRow = Omit<Connection, 'sqlalchemy_query'> & {
  sqlalchemy_query: string | null;
};

function knownProvider(value: string | null): CliProvider | null {
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

  async claimChatProvider(chatId: number, provider: CliProvider): Promise<ClaimResult> {
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
      cursor_cli_binary: parseCursorCliCommand(settingsObject.cursor_cli_binary),
      sqlmcp_port: parseSqlmcpPort(storedSqlmcpPort ?? '') ?? DEFAULT_SQLMCP_PORT,
    };
  }

  async getCursorCliCommand(): Promise<CursorCliCommand> {
    const row = await this.db.get<SettingsModel>(
      `
        SELECT Value AS value
        FROM Settings
        WHERE Key = ?;
      `,
      [CURSOR_CLI_BINARY_KEY],
    );

    return parseCursorCliCommand(row?.value);
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
