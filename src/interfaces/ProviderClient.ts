import type * as acp from "@agentclientprotocol/sdk";
import type { SessionMode } from "@/interfaces/SessionMode";

export default interface ProviderClient {
    connect(): Promise<acp.InitializeResponse>;
    getSessionId(): string;
    sendMessage(text: string): Promise<acp.PromptResponse>;
    applyModelChoice(choice: { modelId: string; reasoning?: string; fast: boolean }): Promise<void>;
    setMode(mode: SessionMode): Promise<void>;
    cancel(): void;
    dispose(): void;
}