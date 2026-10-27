// Interface for returning chats by a message
import type MessageModel from "@/models/MessageModel";
import type ChatModel from "@/models/ChatModel";

export default interface MessageFromChat {
    Message: MessageModel;
    Chat: ChatModel;
}