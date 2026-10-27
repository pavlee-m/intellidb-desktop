type BackendConnection = import('./src/interfaces/BackendConnection').default;
type Settings = import('./src/interfaces/Settings').default;
type Connection = import('./src/interfaces/Connection').default;
type ChatModel = import('./src/models/ChatModel').default;
type ChatActivity = import('./src/interfaces/ChatActivity').default;
type Model = import('./src/interfaces/Model').Model;
type CliCommandCheckResult = import('./src/lib/cliCommand').CliCommandCheckResult;
type CliProvider = import('./src/lib/cliCommand').CliProvider;
type AgentResult = import('./src/interfaces/AgentSession').AgentResult;
type TurnConfig = import('./src/lib/turnConfig').TurnConfig;
type ChatSearchHit = import('./src/interfaces/ChatSearchHit').default;

declare global {
  interface Window {
    settingsApi: {
      getSettings: () => Promise<Settings>;
      updateSetting: (key: string, value: string) => Promise<Settings>;
      checkCliCommand: (command: string) => Promise<CliCommandCheckResult>;
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
      getChats: (connectionId: number) => Promise<ChatModel[]>;
      addChat: (connectionId: number) => Promise<ChatModel>;
      renameChat: (chatId: number, name: string) => Promise<void>;
      deleteChat: (chatId: number) => Promise<void>;
      searchChats: (query: string) => Promise<ChatSearchHit[]>;
      addMessage: (chatId: number, messageId: string | null, message: string, role: number) => Promise<void>;
    };
    modelsApi: {
      list: (provider: CliProvider) => Promise<Model[]>;
    };
    agentApi: {
      connect: (chatId: number, sessionId: string) => Promise<AgentResult>;
      sendTurn: (
        chatId: number,
        sessionId: string,
        config: TurnConfig,
        text: string,
        userText: string,
      ) => Promise<AgentResult>;
      applyConfig: (chatId: number, config: TurnConfig) => Promise<AgentResult>;
      cancel: (chatId: number) => Promise<void>;
      onActivity: (callback: (chatId: number, entry: ChatActivity) => void) => () => void;
    };
  }
}

export {};
