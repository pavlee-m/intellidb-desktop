import ACPClientHandlers from "../interfaces/ACPClientHandlers";
import ProviderClient from "../interfaces/ProviderClient";
import type { CursorCliCommand } from "../lib/cursorCliCommand";
import * as acp from "@agentclientprotocol/sdk";
import { ChildProcess, spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { ACPClient } from "./ACPClient";

export class CursorClient implements ProviderClient {

    private acpClient!: ACPClient;
    private agentProcess!: ChildProcess;
    private connection!: acp.ClientConnection;
    private sessionId!: string;

    getSessionId(): string {
        return this.sessionId;
    }

    constructor(
        private handlers: ACPClientHandlers,
        private command: CursorCliCommand,
        private existingSessionId?: string,
        private mcpServers: acp.McpServer[] = [],
    ) {
    }

    async cancel(): Promise<void> {
        await this.connection.agent.notify(acp.methods.agent.session.cancel, {
            sessionId: this.sessionId,
        });
    }

    async connect(): Promise<acp.InitializeResponse> {
        this.agentProcess = spawn(this.command, ["--model", "composer-2.5", "acp"], {
            stdio: ["pipe", "pipe", "inherit"],
        });

        this.acpClient = new ACPClient(this.handlers);

        this.connection = acp.client({ name: "intellidb-client" })
            .onRequest(acp.methods.client.session.requestPermission, (ctx) =>
                this.acpClient.requestPermission(ctx.params),
            )
            .onNotification(acp.methods.client.session.update, (ctx) =>
                this.acpClient.sessionUpdate(ctx.params),
            )
            .connect(acp.ndJsonStream(
                Writable.toWeb(this.agentProcess.stdin!) as unknown as WritableStream<Uint8Array>,
                Readable.toWeb(this.agentProcess.stdout!) as unknown as ReadableStream<Uint8Array>,
            ));

        let onSpawnError: (error: Error) => void = () => undefined;
        const spawnFailed = new Promise<never>((_, reject) => {
            onSpawnError = reject;
        });
        this.agentProcess.once("error", onSpawnError);

        const initResult = await Promise.race([
            this.connection.agent.request(acp.methods.agent.initialize, {
                protocolVersion: acp.PROTOCOL_VERSION,
            }),
            spawnFailed,
        ]);

        if (this.existingSessionId) {
            let loaded: acp.LoadSessionResponse = await this.connection.agent.request(acp.methods.agent.session.load, {
                sessionId: this.existingSessionId,
                cwd: process.cwd(),
                mcpServers: this.mcpServers,
            });
            this.sessionId = this.existingSessionId;
        } else {
            let created: acp.NewSessionResponse = await this.connection.agent.request(acp.methods.agent.session.new, {
                cwd: process.cwd(),
                mcpServers: this.mcpServers,
            });
            this.sessionId = created.sessionId;
        }

        return initResult;
    }

    async sendMessage(text: string): Promise<acp.PromptResponse> {
        return this.connection.agent.request(acp.methods.agent.session.prompt, {
            sessionId: this.sessionId,
            prompt: [{ type: "text", text }],
        });
    }

    dispose(): void {
        this.agentProcess.kill();
    }
}