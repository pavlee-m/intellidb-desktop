import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REASONING_OPTIONS } from '../src/interfaces/Model'
import { parseVerboseOpenCodeCatalog } from '../src/lib/openCodeModels'

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'opencode-models-verbose.txt',
)
const stdout = readFileSync(fixturePath, 'utf8')
const models = parseVerboseOpenCodeCatalog(stdout)

assert.equal(models.length, 2)
assert.equal(models[0].id, 'anthropic/claude-sonnet')
assert.equal(models[0].provider, 'opencode')
assert.equal(models[0].hasFast, false)
assert.deepEqual(models[0].reasoningOptions, ['low', 'not-a-cursor-effort'])
assert.equal(models[1].id, 'openai/gpt-small')
assert.equal(models[1].hasFast, false)
assert.deepEqual(models[1].reasoningOptions, [])

const cursorOptions: readonly string[] = REASONING_OPTIONS
assert.equal(cursorOptions.includes('not-a-cursor-effort'), false)
assert.equal(models[0].reasoningOptions[1], 'not-a-cursor-effort')

const absentVariants = parseVerboseOpenCodeCatalog(
  'local/plain\n{\n  "id": "plain",\n  "providerID": "local",\n  "name": "Plain"\n}\n',
)
assert.deepEqual(absentVariants[0].reasoningOptions, [])
assert.equal(absentVariants[0].hasFast, false)

assert.throws(
  () => parseVerboseOpenCodeCatalog(''),
  (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.equal(error.message, 'opencode models --verbose returned no models')
    return true
  },
)

assert.throws(() => parseVerboseOpenCodeCatalog(stdout.replace(
  'anthropic/claude-sonnet\n',
  'anthropic/wrong\n',
)))

assert.throws(() => parseVerboseOpenCodeCatalog('local/plain\n[]\n'))

console.log(JSON.stringify({
  first: {
    id: models[0].id,
    hasFast: models[0].hasFast,
    reasoningOptions: models[0].reasoningOptions,
  },
  second: {
    id: models[1].id,
    hasFast: models[1].hasFast,
    reasoningOptions: models[1].reasoningOptions,
  },
  keptVariantOutsideReasoningOptions: models[0].reasoningOptions[1],
}, null, 2))
