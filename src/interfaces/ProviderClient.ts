import type * as acp from "@agentclientprotocol/sdk";

export default interface ProviderClient {
    connect(): Promise<acp.InitializeResponse>;
    getSessionId(): string;
    sendMessage(text: string): Promise<acp.PromptResponse>;
    dispose(): void;
}