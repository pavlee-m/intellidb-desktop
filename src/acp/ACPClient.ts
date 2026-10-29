import * as acp from "@agentclientprotocol/sdk";
import ACPClientHandlers from "../interfaces/ACPClientHandlers";

// let availableCommands: acp.AvailableCommand[] = [];

export class ACPClient implements acp.Client {

    constructor(
        private handlers: ACPClientHandlers,
        private readonly chatId: number,
        private messageStoreHandler: (chatId: number, messageId: string | null, text: string) => void,
    ) {
    }

    async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
        console.log("requestPermission", params);
        return this.handlers.handleRequestPermission(params);
    }

    async sessionUpdate(params: acp.SessionNotification): Promise<void> {
        const update = params.update;

        switch (update.sessionUpdate) {
            case "agent_message_chunk":
                this.handlers.onAgentMessageChunk(update);
                if (update.content.type === "text") {
                    this.messageStoreHandler(this.chatId, update.messageId ?? null, update.content.text);
                }
                break;
            case "agent_thought_chunk":
                this.handlers.onAgentThoughtChunk(update);
                break;
            case "user_message_chunk":
                this.handlers.onUserMessageChunk(update);
                break;
            case "tool_call":
                this.handlers.onToolCall(update);
                break;
            case "tool_call_update":
                this.handlers.onToolCallUpdate(update);
                break;
            case "plan":
                this.handlers.onPlan(update);
                break;
            case "available_commands_update":
                // Each notification is a complete snapshot — replace the cached list.
                // availableCommands = update.availableCommands;
                this.handlers.onAvailableCommandsUpdate(update);
                break;
            default:
                break;
        }
    }
}