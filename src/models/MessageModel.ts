export default interface MessageModel {
    chatId: number;
    messageId: string | null;
    // 0 = User, 1 = Assistant
    role: number;
    message: string;
}
