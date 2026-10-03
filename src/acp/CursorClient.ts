import ACPClientHandlers from "../interfaces/ACPClientHandlers";
import ProviderClient from "../interfaces/ProviderClient";
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
        private existingSessionId?: string,
    ) {
    }

    async connect(): Promise<acp.InitializeResponse> {
        this.agentProcess = spawn("agent", ["--model", "composer-2.5", "acp"], {
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

        let initResult: acp.InitializeResponse = await this.connection.agent.request(acp.methods.agent.initialize, {
            protocolVersion: acp.PROTOCOL_VERSION,
        });

        if (this.existingSessionId) {
            let loaded: acp.LoadSessionResponse = await this.connection.agent.request(acp.methods.agent.session.load, {
                sessionId: this.existingSessionId,
                cwd: process.cwd(),
                mcpServers: [],
            });
            this.sessionId = this.existingSessionId;
        } else {
            let created: acp.NewSessionResponse = await this.connection.agent.request(acp.methods.agent.session.new, {
                cwd: process.cwd(),
                mcpServers: [],
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