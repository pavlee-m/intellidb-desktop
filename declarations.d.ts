declare module '*.css';

interface Window {
  settingsApi: {
    getSettings: () => Promise<{ theme: 'light' | 'dark' }>;
    updateSetting: (key: string, value: string) => Promise<{ theme: 'light' | 'dark' }>;
  };
}
