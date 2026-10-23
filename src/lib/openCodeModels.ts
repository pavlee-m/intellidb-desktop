import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import {
  isOpenCodeModelId,
  isOpenCodeVariant,
  type OpenCodeModel,
  type OpenCodeVariant,
} from '@/interfaces/Model'
import { readOpenCodeAuth } from '@/lib/openCodeAuth'

const execFileAsync = promisify(execFile)

const verboseModelSchema = z.object({
  id: z.string(),
  providerID: z.string(),
  name: z.string(),
  variants: z.record(z.string(), z.unknown()).optional(),
})

function isLineBreak(char: string): boolean {
  return char === '\n' || char === '\r'
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || isLineBreak(char)
}

function readJsonObject(text: string, start: number): { value: unknown; end: number } {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        const raw = text.slice(start, index + 1)
        const value: unknown = JSON.parse(raw)
        return { value, end: index + 1 }
      }
    }
  }
  throw new Error('opencode models --verbose JSON object did not end')
}

function variantKeys(variants: Record<string, unknown> | undefined): OpenCodeVariant[] {
  if (!variants) {
    return []
  }
  const keys: OpenCodeVariant[] = []
  for (const key of Object.keys(variants)) {
    if (!isOpenCodeVariant(key)) {
      throw new Error(`OpenCode variant key ${JSON.stringify(key)} is empty or has whitespace`)
    }
    keys.push(key)
  }
  return keys
}

function modelFromRecord(idLine: string, value: unknown): OpenCodeModel {
  const parsed = verboseModelSchema.safeParse(value)
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join('; ')
    throw new Error(`opencode models --verbose record for ${idLine} is invalid: ${detail}`)
  }
  const record = parsed.data
  if (!isOpenCodeModelId(idLine, record.providerID, record.id)) {
    throw new Error(
      `opencode models --verbose id line ${idLine} does not match ${record.providerID}/${record.id}`,
    )
  }
  return {
    provider: 'opencode',
    name: record.name,
    id: idLine,
    reasoningOptions: variantKeys(record.variants),
    hasFast: false,
  }
}

export function parseVerboseOpenCodeCatalog(stdout: string): OpenCodeModel[] {
  const models: OpenCodeModel[] = []
  let index = 0
  while (index < stdout.length) {
    while (index < stdout.length && isWhitespace(stdout[index])) {
      index += 1
    }
    if (index >= stdout.length) {
      break
    }
    const lineBreak = stdout.indexOf('\n', index)
    const lineEnd = lineBreak === -1 ? stdout.length : lineBreak
    const idLine = stdout.slice(index, lineEnd).replace(/\r$/, '').trim()
    index = lineBreak === -1 ? stdout.length : lineBreak + 1
    if (idLine.length === 0) {
      continue
    }
    if (idLine.startsWith('{')) {
      throw new Error('opencode models --verbose record is missing an id line')
    }
    while (index < stdout.length && isWhitespace(stdout[index])) {
      index += 1
    }
    if (stdout[index] !== '{') {
      throw new Error(`opencode models --verbose record for ${idLine} is missing a JSON object`)
    }
    const parsed = readJsonObject(stdout, index)
    index = parsed.end
    models.push(modelFromRecord(idLine, parsed.value))
  }
  if (models.length === 0) {
    throw new Error('opencode models --verbose returned no models')
  }
  return models
}

export async function fetchOpenCodeModels(command: string): Promise<OpenCodeModel[]> {
  let stdout = ''
  let stderr = ''
  try {
    const result = await execFileAsync(command, ['models', '--verbose'], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    })
    stdout = result.stdout
    stderr = result.stderr
  } catch (error) {
    const auth = readOpenCodeAuth(error)
    if (auth) {
      throw auth
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to run ${command} models --verbose: ${message}`)
  }
  try {
    return parseVerboseOpenCodeCatalog(stdout)
  } catch (error) {
    const auth = readOpenCodeAuth({ stdout, stderr })
    if (auth) {
      throw auth
    }
    throw error
  }
}
