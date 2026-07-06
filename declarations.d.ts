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
    addConnection: (connection: Omit<Connection, 'id'>) => Promise<Connection[]>;
    deleteConnection: (connectionId: number) => Promise<Connection[]>;
    editConnection: (connection: Connection) => Promise<Connection[]>;
  };
}
