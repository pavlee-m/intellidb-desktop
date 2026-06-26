declare module '*.css';
declare module '*.svg';

type Settings = import('./src/interfaces/Settings').default;

interface Window {
  settingsApi: {
    getSettings: () => Promise<Settings>;
    updateSetting: (key: string, value: string) => Promise<Settings>;
  };
}
