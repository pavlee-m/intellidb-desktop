export default interface ChatModel {
  id: number;
  connectionId: number;
  name: string;
  createdAt: string;
  sessionId: string;
  provider: string;
}
