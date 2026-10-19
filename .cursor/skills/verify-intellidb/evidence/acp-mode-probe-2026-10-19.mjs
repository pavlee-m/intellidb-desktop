// Probe: how does the Cursor agent expose plan/agent mode over ACP?
// 1. Does session/new advertise modes (SessionModeState) and/or a "mode" config option?
// 2. Does session/set_mode work? Does set_config_option("mode", ...) work?
import * as acp from '@agentclientprotocol/sdk'
import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'

const CWD = process.cwd()
const UPDATES = []

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

const proc = spawn('cursor-agent', ['acp'], { stdio: ['pipe', 'pipe', 'inherit'] })

const connection = acp.client({ name: 'mode-probe' })
  .onRequest(acp.methods.client.session.requestPermission, () => ({
    outcome: { outcome: 'cancelled' },
  }))
  .onNotification(acp.methods.client.session.update, (ctx) => {
    UPDATES.push(ctx.params)
  })
  .connect(acp.ndJsonStream(
    Writable.toWeb(proc.stdin),
    Readable.toWeb(proc.stdout),
  ))

await withTimeout(connection.agent.request(acp.methods.agent.initialize, {
  protocolVersion: acp.PROTOCOL_VERSION,
  clientCapabilities: { _meta: { parameterizedModelPicker: true } },
}), 30000, 'initialize')

const created = await withTimeout(
  connection.agent.request(acp.methods.agent.session.new, { cwd: CWD, mcpServers: [] }),
  30000,
  'session/new',
)

console.log('--- session/new response ---')
console.log(JSON.stringify(created, null, 2))

const modeState = created.modes
const modeIds = (modeState?.availableModes ?? []).map((m) => m.id)
console.log('\nadvertised currentModeId:', modeState?.currentModeId)
console.log('advertised availableModes:', modeIds.join(', ') || '(none)')
const modeConfigOption = (created.configOptions ?? []).find((o) => o.id === 'mode')
console.log('"mode" config option present:', modeConfigOption ? JSON.stringify(modeConfigOption) : '(no)')

// Attempt 1: the ACP-standard way — session/set_mode with an advertised mode id.
const target = modeIds.find((id) => id !== modeState?.currentModeId) ?? 'plan'
if (modeIds.length > 0) {
  try {
    const res = await withTimeout(
      connection.agent.request(acp.methods.agent.session.setMode, { sessionId: created.sessionId, modeId: target }),
      15000,
      'session/set_mode',
    )
    console.log(`\nset_mode(${target}) OK:`, JSON.stringify(res ?? {}))
  } catch (error) {
    console.log(`\nset_mode(${target}) FAILED:`, error.code ?? '', error.message)
  }
} else {
  console.log(`\nset_mode skipped: agent advertised no modes; trying raw 'plan' anyway`)
  try {
    const res = await withTimeout(
      connection.agent.request(acp.methods.agent.session.setMode, { sessionId: created.sessionId, modeId: 'plan' }),
      15000,
      'session/set_mode(plan)',
    )
    console.log('set_mode(plan) OK:', JSON.stringify(res ?? {}))
  } catch (error) {
    console.log('set_mode(plan) FAILED:', error.code ?? '', error.message)
  }
}

// Attempt 2: the current app implementation — set_config_option("mode", ...).
try {
  const res = await withTimeout(
    connection.agent.request(acp.methods.agent.session.setConfigOption, {
      sessionId: created.sessionId,
      configId: 'mode',
      value: 'plan',
    }),
    15000,
    'set_config_option(mode)',
  )
  console.log('setConfigOption("mode","plan") OK:', JSON.stringify(res ?? {}))
} catch (error) {
  console.log('setConfigOption("mode","plan") FAILED:', error.code ?? '', error.message)
}

// Give the agent a moment to push a currentModeChanged notification.
await new Promise((r) => setTimeout(r, 2000))
console.log('\n--- session/update notifications seen ---')
console.log(JSON.stringify(UPDATES, null, 2))

proc.kill()
await new Promise((r) => setTimeout(r, 500))
process.exit(0)