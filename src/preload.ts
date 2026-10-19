import { contextBridge, ipcRenderer } from 'electron'
import Settings from '@/interfaces/Settings'
import Chat from '@/interfaces/Chat'
import Connection from '@/interfaces/Connection'
import BackendConnection from './interfaces/BackendConnection'
import type ChatActivity from '@/interfaces/ChatActivity'
import type Model from '@/interfaces/Model'
import type { CliCommandCheckResult } from '@/lib/cliCommand'

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  updateSetting: (key: string, value: string) =>
    ipcRenderer.invoke('settings:update', key, value) as Promise<Settings>,
  checkCliCommand: (command: string) =>
    ipcRenderer.invoke('cli:checkCommand', command) as Promise<CliCommandCheckResult>,
})

contextBridge.exposeInMainWorld('connectionsApi', {
  getConnections: () => ipcRenderer.invoke('connections:get') as Promise<BackendConnection[]>,
  addConnection: (connection: Omit<Connection, 'id'>) =>
    ipcRenderer.invoke('connections:add', connection) as Promise<number>,
  deleteConnection: (connectionId: number) =>
    ipcRenderer.invoke('connections:delete', connectionId) as Promise<void>,
  editConnection: (connection: Connection) =>
    ipcRenderer.invoke('connections:edit', connection) as Promise<void>,
  connectConnection: (connectionId: number) =>
    ipcRenderer.invoke('connections:connect', connectionId) as Promise<string>,
  disconnectConnection: (connectionId: number) =>
    ipcRenderer.invoke('connections:disconnect', connectionId) as Promise<void>,
  getPassword: (connectionId: number) =>
    ipcRenderer.invoke('connections:getPassword', connectionId) as Promise<string>,
})

contextBridge.exposeInMainWorld('chatsApi', {
  getChats: (connectionId: number) =>
    ipcRenderer.invoke('chats:get', connectionId) as Promise<Chat[]>,
  addChat: (connectionId: number) =>
    ipcRenderer.invoke('chats:add', connectionId) as Promise<Chat>,
  renameChat: (chatId: number, name: string) =>
    ipcRenderer.invoke('chats:rename', chatId, name) as Promise<void>,
  deleteChat: (chatId: number) =>
    ipcRenderer.invoke('chats:delete', chatId) as Promise<void>,
  setProvider: (chatId: number, provider: string) =>
    ipcRenderer.invoke('chats:setProvider', chatId, provider) as Promise<void>,
})

contextBridge.exposeInMainWorld('modelsApi', {
  listCursor: () => ipcRenderer.invoke('models:cursor') as Promise<Model[]>,
})

contextBridge.exposeInMainWorld('agentApi', {
  connect: (chatId: number, sessionId: string) =>
    ipcRenderer.invoke('agent:connect', chatId, sessionId) as Promise<string>,
  prompt: (chatId: number, text: string) =>
    ipcRenderer.invoke('agent:prompt', chatId, text) as Promise<unknown>,
  onActivity: (callback: (chatId: number, entry: ChatActivity) => void) => {
    const listener = (_event: unknown, payload: { chatId: number; entry: ChatActivity }) =>
      callback(payload.chatId, payload.entry)
    ipcRenderer.on('agent:activity', listener)
    return () => {
      ipcRenderer.removeListener('agent:activity', listener)
    }
  },
  cancel: (chatId: number) =>
    ipcRenderer.invoke('agent:cancel', chatId) as Promise<void>,
  applyModel: (
    chatId: number,
    choice: { modelId: string; reasoning?: string; fast: boolean },
  ) => ipcRenderer.invoke('agent:applyModel', chatId, choice) as Promise<void>,
})
