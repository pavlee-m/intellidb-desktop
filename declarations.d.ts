declare module '*.css';
declare module '*.svg';

type Settings = import('./src/interfaces/Settings').default;
type Connection = import('./src/interfaces/Connection').default;

interface Window {
  settingsApi: {
    getSettings: () => Promise<Settings>;
    updateSetting: (key: string, value: string) => Promise<Settings>;
  };
  connectionsApi: {
    getConnections: () => Promise<Connection[]>;
    addConnection: (connection: Omit<Connection, 'id'>) => Promise<number>;
    deleteConnection: (connectionId: number) => Promise<void>;
    editConnection: (connection: Connection) => Promise<void>;
  };
}
