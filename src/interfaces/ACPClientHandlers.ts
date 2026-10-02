import type * as acp from "@agentclientprotocol/sdk";

// Handlers required by ACPClient for permission requests and session updates.
export default interface ACPClientHandlers {
    handleRequestPermission: (params: acp.RequestPermissionRequest) => Promise<acp.RequestPermissionResponse>;
    onAgentMessageChunk: (update: acp.ContentChunk) => void;
    onAgentThoughtChunk: (update: acp.ContentChunk) => void;
    onUserMessageChunk: (update: acp.ContentChunk) => void;
    onToolCall: (update: acp.ToolCall) => void;
    onToolCallUpdate: (update: acp.ToolCallUpdate) => void;
    onPlan: (update: acp.Plan) => void;
    onAvailableCommandsUpdate: (update: acp.AvailableCommandsUpdate) => void;
}