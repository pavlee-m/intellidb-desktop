// Probe: does cursor-agent honor client-supplied mcpServers in session/new?
// Mirrors CursorClient.connect(): spawn `agent acp`, initialize, new session
// with sqlmcp as an http-type MCP server, prompt, watch for tool_call events.
import * as acp from '@agentclientprotocol/sdk'
import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'

const SQLMCP_MCP_URL = 'http://127.0.0.1:8000/mcp'
const mcpServers = [{ type: 'http', name: 'sqlmcp', url: SQLMCP_MCP_URL, headers: [] }]

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

function startAgent() {
  const proc = spawn('agent', ['--model', 'composer-2.5', 'acp'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  let sawToolCall = false
  const connection = acp.client({ name: 'mcp-probe' })
    .onRequest(acp.methods.client.session.requestPermission, (ctx) => {
      // Mirror AgentHost.createHandlers: auto-allow, so MCP tool calls round-trip.
      const options = ctx.params.options
      const option = options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always') ?? options[0]
      if (!option) return { outcome: { outcome: 'cancelled' } }
      return { outcome: { outcome: 'selected', optionId: option.optionId } }
    })
    .onNotification(acp.methods.client.session.update, (ctx) => {
      const u = ctx.params?.update
      if (!u) return
      if (u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update') {
        sawToolCall = true
        console.log('TOOL:', u.sessionUpdate, '|', u.title, '|', u.status, '|', JSON.stringify(u.rawInput ?? u.content ?? '').slice(0, 160))
      } else if (u.sessionUpdate === 'agent_message_chunk') {
        process.stdout.write('MSG: ' + (u.content?.type === 'text' ? u.content.text : ''))
      }
    })
    .connect(acp.ndJsonStream(
      Writable.toWeb(proc.stdin),
      Readable.toWeb(proc.stdout),
    ))
  return { proc, connection, sawTool: () => sawToolCall }
}

const probe = startAgent()
await withTimeout(
  probe.connection.agent.request(acp.methods.agent.initialize, { protocolVersion: acp.PROTOCOL_VERSION }),
  30000,
  'initialize',
)
console.log('\ninitialize ok')

const created = await withTimeout(
  probe.connection.agent.request(acp.methods.agent.session.new, { cwd: process.cwd(), mcpServers }),
  30000,
  'session/new',
)
console.log('session/new ok:', created.sessionId)

try {
  await withTimeout(
    probe.connection.agent.request(acp.methods.agent.session.prompt, {
      sessionId: created.sessionId,
      prompt: [{ type: 'text', text: 'Name the MCP servers and tools you can see. Then call any one sqlmcp tool.' }],
    }),
    120000,
    'prompt',
  )
  console.log('\nprompt ok')
} catch (error) {
  console.log('\nprompt FAILED:', error.code ?? '', error.message)
}

console.log('sawToolCall:', probe.sawTool())
probe.proc.kill()
await new Promise((r) => setTimeout(r, 500))
process.exit(0)