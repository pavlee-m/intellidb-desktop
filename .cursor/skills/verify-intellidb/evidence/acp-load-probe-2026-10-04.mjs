// Probe: does session/load fail for a session that was created but never prompted?
// Mirrors CursorClient.connect(): spawn `agent acp`, initialize, then new/load.
import * as acp from '@agentclientprotocol/sdk'
import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'

const CWD = process.cwd()

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
  const connection = acp.client({ name: 'load-probe' })
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
  return withTimeout(
    connection.agent.request(acp.methods.agent.initialize, {
      protocolVersion: acp.PROTOCOL_VERSION,
    }),
    30000,
    'initialize',
  )
}

async function stop(proc) {
  proc.kill()
  await new Promise((r) => setTimeout(r, 500))
}

// Attempt A: session/new with no prompt, exactly what the app does when a chat opens.
const a = startAgent()
await initialize(a.connection)
const created = await withTimeout(
  a.connection.agent.request(acp.methods.agent.session.new, { cwd: CWD, mcpServers: [] }),
  30000,
  'session/new',
)
console.log('A session/new ok:', created.sessionId)
await stop(a.proc)

// Attempt B: session/load of that never-prompted id in a fresh agent process.
const b = startAgent()
await initialize(b.connection)
try {
  await withTimeout(
    b.connection.agent.request(acp.methods.agent.session.load, {
      sessionId: created.sessionId,
      cwd: CWD,
      mcpServers: [],
    }),
    30000,
    'session/load(empty)',
  )
  console.log('B session/load of never-prompted session: OK')
} catch (error) {
  console.log('B session/load of never-prompted session FAILED:', error.code ?? '', error.message)
}
await stop(b.proc)

// Attempt C: positive control — load a session known to have been prompted.
const promptedId = '7e677306-31a0-4908-8607-ba0816c8282b'
const c = startAgent()
await initialize(c.connection)
try {
  await withTimeout(
    c.connection.agent.request(acp.methods.agent.session.load, {
      sessionId: promptedId,
      cwd: CWD,
      mcpServers: [],
    }),
    30000,
    'session/load(prompted)',
  )
  console.log('C session/load of prompted session: OK')
} catch (error) {
  console.log('C session/load of prompted session FAILED:', error.code ?? '', error.message)
}
await stop(c.proc)