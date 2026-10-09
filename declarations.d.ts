type BackendConnection = import('./src/interfaces/BackendConnection').default;
type Settings = import('./src/interfaces/Settings').default;
type Connection = import('./src/interfaces/Connection').default;
type Chat = import('./src/interfaces/Chat').default;
type ChatActivity = import('./src/interfaces/ChatActivity').default;

declare global {
  interface Window {
    settingsApi: {
      getSettings: () => Promise<Settings>;
      updateSetting: (key: string, value: string) => Promise<Settings>;
    };
    connectionsApi: {
      getConnections: () => Promise<BackendConnection[]>;
      addConnection: (connection: Omit<Connection, 'id'>) => Promise<number>;
      deleteConnection: (connectionId: number) => Promise<void>;
      editConnection: (connection: Connection) => Promise<void>;
      connectConnection: (connectionId: number) => Promise<string>;
      disconnectConnection: (connectionId: number) => Promise<void>;
      getPassword: (connectionId: number) => Promise<string>;
    };
    chatsApi: {
      getChats: (connectionId: number) => Promise<Chat[]>;
      addChat: (connectionId: number) => Promise<Chat>;
      renameChat: (chatId: number, name: string) => Promise<void>;
      deleteChat: (chatId: number) => Promise<void>;
    };
    agentApi: {
      connect: (chatId: number, sessionId: string | null) => Promise<string>;
      prompt: (chatId: number, text: string) => Promise<unknown>;
      cancel: (chatId: number) => Promise<void>;
      onActivity: (callback: (chatId: number, entry: ChatActivity) => void) => () => void;
    };
  }
}

export {};
