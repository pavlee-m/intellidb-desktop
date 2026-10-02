import { contextBridge, ipcRenderer } from 'electron'
import Settings from '@/interfaces/Settings'
import Chat from '@/interfaces/Chat'
import Connection from '@/interfaces/Connection'
import BackendConnection from './interfaces/BackendConnection'

contextBridge.exposeInMainWorld('settingsApi', {
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  updateSetting: (key: string, value: string) =>
    ipcRenderer.invoke('settings:update', key, value) as Promise<Settings>,
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
})
