import { contextBridge, ipcRenderer } from 'electron'
import Settings from '@/interfaces/Settings'
import ChatModel from '@/models/ChatModel'
import Connection from '@/interfaces/Connection'
import BackendConnection from './interfaces/BackendConnection'
import type ChatActivity from '@/interfaces/ChatActivity'
import type { Model } from '@/interfaces/Model'
import type { CliCommandCheckResult, CliProvider } from '@/lib/cliCommand'
import type { AgentResult } from '@/interfaces/AgentSession'
import type { TurnConfig } from '@/lib/turnConfig'
import type ChatSearchHit from '@/interfaces/ChatSearchHit'
import type { RequestPermissionRequest } from '@agentclientprotocol/sdk'

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
    ipcRenderer.invoke('chats:get', connectionId) as Promise<ChatModel[]>,
  addChat: (connectionId: number) =>
    ipcRenderer.invoke('chats:add', connectionId) as Promise<ChatModel>,
  renameChat: (chatId: number, name: string) =>
    ipcRenderer.invoke('chats:rename', chatId, name) as Promise<void>,
  deleteChat: (chatId: number) =>
    ipcRenderer.invoke('chats:delete', chatId) as Promise<void>,
  searchChats: (query: string) =>
    ipcRenderer.invoke('chats:searchByMessageContent', query) as Promise<ChatSearchHit[]>,
  addMessage: (chatId: number, messageId: string | null, message: string, role: number) =>
    ipcRenderer.invoke('chats:addMessage', chatId, messageId, message, role) as Promise<void>,
})

contextBridge.exposeInMainWorld('modelsApi', {
  list: (provider: CliProvider) =>
    ipcRenderer.invoke('models:list', provider) as Promise<Model[]>,
})

contextBridge.exposeInMainWorld('agentApi', {
  connect: (chatId: number, sessionId: string) =>
    ipcRenderer.invoke('agent:connect', chatId, sessionId) as Promise<AgentResult>,
  sendTurn: (chatId: number, sessionId: string, config: TurnConfig, text: string, userText: string) =>
    ipcRenderer.invoke('agent:sendTurn', chatId, sessionId, config, text, userText) as Promise<AgentResult>,
  applyConfig: (chatId: number, config: TurnConfig) =>
    ipcRenderer.invoke('agent:applyConfig', chatId, config) as Promise<AgentResult>,
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
  onPermissionChange: (chatId: number, callback: (request: RequestPermissionRequest | null) => void) => {
    let sawEvent = false
    const listener = (_event: unknown, payload: { chatId: number; request: RequestPermissionRequest | null }) => {
      if (payload.chatId !== chatId) return
      sawEvent = true
      callback(payload.request)
    }
    ipcRenderer.on('agent:permission-changed', listener)
    void ipcRenderer.invoke('agent:permission-current', chatId).then((request: RequestPermissionRequest | null) => {
      if (!sawEvent) callback(request)
    })
    return () => ipcRenderer.removeListener('agent:permission-changed', listener)
  },
  selectPermission: (chatId: number, optionId: string) =>
    ipcRenderer.invoke('agent:permission-select', chatId, optionId) as Promise<void>,
  dismissPermission: (chatId: number) =>
    ipcRenderer.invoke('agent:permission-dismiss', chatId) as Promise<void>,
})
