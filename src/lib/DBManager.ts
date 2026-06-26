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
      }
    }

    return {
      theme: settingsObject.theme ?? 'light',
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
