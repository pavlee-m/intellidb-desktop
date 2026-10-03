export default interface IndexState {
  openChatId: number | null
  openByConnectionId: Record<number, boolean>
  openChat: (chatId: number) => void
  closeChat: () => void
  setConnectionOpen: (connectionId: number, open: boolean) => void
}
