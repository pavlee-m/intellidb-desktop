// Probe: reproduce the app's two-attempt flow against chat 11's stored session.
// Attempt 1: load 'faefd9aa-37d2-4fc5-9c06-0119af243c5d'. Attempt 2: fresh process, session/new.
import * as acp from '@agentclientprotocol/sdk'
import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'

const CWD = process.cwd()
const STORED = 'faefd9aa-37d2-4fc5-9c06-0119af243c5d'

function startAgent() {
  const proc = spawn('agent', ['--model', 'composer-2.5', 'acp'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const connection = acp.client({ name: 'repro-probe' })
    .onRequest(acp.methods.client.session.requestPermission, () => ({
      outcome: { outcome: 'cancelled' },
    }))
    .onNotification(acp.methods.client.session.update, () => {})
    .connect(acp.ndJsonStream(
      Writable.toWeb(proc.stdin),
      Readable.toWeb(proc.stdout),
    ))
  return { proc, connection }
}

async function initialize(connection) {
  return connection.agent.request(acp.methods.agent.initialize, {
    protocolVersion: acp.PROTOCOL_VERSION,
  })
}

async function stop(proc) {
  proc.kill()
  await new Promise((r) => setTimeout(r, 500))
}

const a = startAgent()
await initialize(a.connection)
try {
  await a.connection.agent.request(acp.methods.agent.session.load, {
    sessionId: STORED,
    cwd: CWD,
    mcpServers: [],
  })
  console.log('A load(stored chat 11 session): OK')
} catch (error) {
  console.log('A load(stored) FAILED:', JSON.stringify(error.data ?? error.message).slice(0, 400))
}
await stop(a.proc)

const b = startAgent()
await initialize(b.connection)
try {
  const created = await b.connection.agent.request(acp.methods.agent.session.new, {
    cwd: CWD,
    mcpServers: [],
  })
  console.log('B session/new: OK', created.sessionId)
} catch (error) {
  console.log('B session/new FAILED:', JSON.stringify(error.data ?? error.message).slice(0, 400))
}
await stop(b.proc)