import type * as acp from "@agentclientprotocol/sdk";

export default interface ProviderClient {
    connect(): Promise<acp.InitializeResponse>;
    getSessionId(): string;
    sendMessage(text: string): Promise<acp.PromptResponse>;
    applyModelChoice(choice: { modelId: string; reasoning?: string; fast: boolean }): Promise<void>;
    setMode(mode: string): Promise<void>;
    cancel(): void;
    dispose(): void;
}