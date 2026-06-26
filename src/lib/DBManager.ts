import Settings from '../interfaces/Settings';
import SettingsModel from '../models/SettingsModel';
import { Database } from 'sqlite';

class DBManager {
  constructor(private readonly db: Database) {}

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
}

export default DBManager;
