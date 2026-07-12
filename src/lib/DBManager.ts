import Settings from '@/interfaces/Settings';
import SettingsModel from '../models/SettingsModel';
import { Database } from 'sqlite';
import Connection from '@/interfaces/Connection';

type ConnectionRow = Omit<Connection, 'sqlalchemy_query'> & {
  sqlalchemy_query: string | null;
};

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

  async addConnection(connection: Omit<Connection, 'id'>): Promise<void> {
    await this.db.run(
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
    );
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

  async getSettings(): Promise<Settings> {
    const rows = await this.db.all<SettingsModel[]>(`
      SELECT
        ID AS id,
        Key AS key,
        Value AS value
      FROM Settings;
    `);

    const settingsObject: Partial<Settings> = {};

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
      }
    }

    return {
      theme: settingsObject.theme ?? 'light',
      opencode_integration_enabled: settingsObject.opencode_integration_enabled ?? true,
      opencode_binary: settingsObject.opencode_binary ?? 'opencode',
    };
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
