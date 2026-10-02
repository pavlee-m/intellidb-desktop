import ACPClientHandlers from "../interfaces/ACPClientHandlers";
import * as acp from "@agentclientprotocol/sdk";
import { ChildProcess, spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { ACPClient } from "./ACPClient";

// One CursorClient represents exactly one agent session.
// Pass an existing sessionId to resume it; omit it to start a new session.
export class CursorClient {

    private acpClient!: ACPClient;
    private agentProcess!: ChildProcess;
    private connection!: acp.ClientConnection;
    private sessionId!: string;
    private configOptions?: acp.SessionConfigOption[];

    constructor(
        private handlers: ACPClientHandlers,
        private existingSessionId?: string,
    ) {
    }

    // One-time setup: spawn the agent, wire handlers, open the connection,
    // initialize, then load the existing session or create a new one.
    async connect(): Promise<acp.InitializeResponse> {
        this.agentProcess = spawn("agent", ["--model", "composer-2.5", "acp"], {
            stdio: ["pipe", "pipe", "inherit"],
        });

        this.acpClient = new ACPClient(this.handlers);

        // Unlike connectWith(...), this connection stays open until we close it —
        // connection.agent can be used for the lifetime of the connection.
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
            // Resume an existing session.
            let loaded: acp.LoadSessionResponse = await this.connection.agent.request(acp.methods.agent.session.load, {
                sessionId: this.existingSessionId,
                cwd: process.cwd(),
                mcpServers: [],
            });
            this.sessionId = this.existingSessionId;
            this.configOptions = loaded.configOptions ?? undefined;
        } else {
            // Start a new session.
            let created: acp.NewSessionResponse = await this.connection.agent.request(acp.methods.agent.session.new, {
                cwd: process.cwd(),
                mcpServers: [],
            });
            this.sessionId = created.sessionId;
            this.configOptions = created.configOptions ?? undefined;
        }

        return initResult;
    }

    async sendMessage(text: string): Promise<acp.PromptResponse> {
        return this.connection.agent.request(acp.methods.agent.session.prompt, {
            sessionId: this.sessionId,
            prompt: [{ type: "text", text }],
        });
    }

    // async selectModel(configId: string, value: string): Promise<acp.SetSessionConfigOptionResponse> {
    //     let response: acp.SetSessionConfigOptionResponse = await this.connection.agent.request(acp.methods.agent.session.setConfigOption, {
    //         sessionId: this.sessionId,
    //         configId,
    //         value,
    //     });
    //     // The response carries a fresh snapshot of all config options — re-cache it.
    //     this.configOptions = response.configOptions;
    //     return response;
    // }

    dispose(): void {
        this.agentProcess.kill();
    }
}