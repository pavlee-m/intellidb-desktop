# sqlmcp wired into ACP via client-supplied mcpServers (2026-10-04)

## Change

`mcpServers` now flows from code into every ACP session. No Cursor config file involved.

- `src/main.ts` defines `SQLMCP_MCP_URL = 'http://127.0.0.1:8000/mcp'` and calls `setAgentMcpServers([{ type: 'http', name: 'sqlmcp', url: SQLMCP_MCP_URL, headers: [] }])` after the backend health check passes.
- `src/lib/AgentHost.ts` holds a module-level `agentMcpServers` registry with `setAgentMcpServers()` (same pattern as the session persister) and passes it into every `CursorClient`.
- `src/acp/CursorClient.ts` takes `mcpServers` as a constructor param and passes it to **both** `session/new` and `session/load` (resumed sessions would silently lose the server otherwise).

## Proof

`node .cursor/skills/verify-intellidb/evidence/acp-mcp-probe-2026-10-04.mjs`

- Spawns `agent --model composer-2.5 acp` directly, mirroring `CursorClient.connect()`.
- `session/new` with the sqlmcp http server in `mcpServers`.
- Prompt: "Name the MCP servers and tools you can see. Then call any one sqlmcp tool."
- Permission handler mirrors `AgentHost.createHandlers` (auto-allow `allow_once`).

Observed:

- Agent reported `sqlmcp (MCP server, status: ready)` with `execute_sql` (matching the signature in `sqlmcp.py`: `conn_id`, `query`, `allowDestructive`, `limit`).
- Agent executed `sqlmcp -> execute_sql` against the live registered connection `mssql://sa@localhost/AdventureWorks2025` and returned `{"columns":["test"],"rows":[[1]],"count":1}`.
- `sawToolCall: true`, exit 0.

## Environment notes

- A user-owned `sqlmcp.bin` (pid 304317) was already listening on 8000; the probe used it read-only and did not kill it.
- First probe run had a cancel-all permission handler, so the tool call was rejected; second run with the app's allow-once handler completed the round trip.
- First run's script had a `probe.saw()` typo, fixed to `probe.sawTool()`.

## Not covered

- The full app UI path (launch via `launch.sh`, open chat, prompt) was not driven; the probe exercises the identical ACP sequence the app uses.
- `session/load` path not probed live, but it passes the same `this.mcpServers` field.