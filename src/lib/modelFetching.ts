import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import {
  DEFAULT_CURSOR_CLI_COMMAND,
} from '@/constants/cliDefaults'
import { readOpenCodeAuth } from '@/lib/openCodeAuth'
import {
  isOpenCodeModelId,
  isOpenCodeVariant,
  REASONING_OPTIONS,
  type CursorModel,
  type OpenCodeModel,
  type OpenCodeVariant,
  type ReasoningOption,
} from '@/interfaces/Model'

const execFileAsync = promisify(execFile)

// These CLI family ids are not the ids ACP advertises. Unmapped families keep their CLI family id.
const CLI_FAMILY_TO_ACP_BASE_ID: Readonly<Record<string, string>> = {
  auto: 'default',
  'cursor-grok-4.6': 'grok-4.6',
  'cursor-grok-4.5': 'grok-4.5',
  'claude-4.6-sonnet': 'claude-sonnet-4-6',
  'claude-4.6-opus': 'claude-opus-4-6',
  'claude-4.5-opus': 'claude-opus-4-5',
  'claude-4.5-sonnet': 'claude-sonnet-4-5',
  'claude-4-sonnet': 'claude-sonnet-4',
}

function titleCaseToken(token: string): string {
  return token
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const DISPLAY_STRIP_PHRASES = [
  ...REASONING_OPTIONS.map(titleCaseToken),
  'No Thinking',
  'Thinking',
  'Fast',
  '(default)',
].sort((left, right) => right.length - left.length)

// Longest token first. '-xhigh'.endsWith('-high') is true.
const EFFORT_MATCH_ORDER = [...REASONING_OPTIONS].sort(
  (left, right) => right.length - left.length,
)

type VariantRow = {
  variantId: string
  displayName: string
}

type NameRow = {
  cleaned: string
  fast: boolean
}

type FamilyGroup = {
  efforts: Set<ReasoningOption>
  hasFast: boolean
  names: NameRow[]
}

function cleanDisplayName(raw: string): string {
  let text = raw.replace(/\u200B/g, '')
  for (const phrase of DISPLAY_STRIP_PHRASES) {
    text = text.split(phrase).join('')
  }
  return text.replace(/\s+/g, ' ').trim()
}

function parseVariantId(variantId: string): {
  familyId: string
  effort: ReasoningOption | undefined
  fast: boolean
} {
  let id = variantId
  const fast = id.endsWith('-fast')
  if (fast) {
    id = id.slice(0, -'-fast'.length)
  }

  if (id.endsWith('-thinking')) {
    id = id.slice(0, -'-thinking'.length)
  } else if (id.includes('-thinking-')) {
    id = id.replace('-thinking-', '-')
  }

  let effort: ReasoningOption | undefined
  for (const token of EFFORT_MATCH_ORDER) {
    const suffix = `-${token}`
    if (id.endsWith(suffix)) {
      effort = token
      id = id.slice(0, -suffix.length)
      break
    }
  }

  return { familyId: id, effort, fast }
}

function pickDisplayName(rows: NameRow[]): string {
  const preferred = rows.filter((row) => !row.fast)
  const pool = preferred.length > 0 ? preferred : rows
  const counts = new Map<string, number>()
  for (const row of pool) {
    counts.set(row.cleaned, (counts.get(row.cleaned) ?? 0) + 1)
  }

  let maxCount = 0
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count
    }
  }

  for (const row of pool) {
    if (counts.get(row.cleaned) === maxCount) {
      return row.cleaned
    }
  }

  return pool[0].cleaned
}

function groupVariants(rows: VariantRow[]): CursorModel[] {
  const families = new Map<string, FamilyGroup>()

  for (const row of rows) {
    const { familyId, effort, fast } = parseVariantId(row.variantId)
    let family = families.get(familyId)
    if (!family) {
      family = {
        efforts: new Set(),
        hasFast: false,
        names: [],
      }
      families.set(familyId, family)
    }
    if (effort !== undefined) {
      family.efforts.add(effort)
    }
    if (fast) {
      family.hasFast = true
    }
    family.names.push({
      cleaned: cleanDisplayName(row.displayName),
      fast,
    })
  }

  const models: CursorModel[] = []
  for (const [familyId, family] of families) {
    models.push({
      provider: 'cursor',
      name: pickDisplayName(family.names),
      id: (CLI_FAMILY_TO_ACP_BASE_ID[familyId] ?? familyId),
      reasoningOptions: REASONING_OPTIONS.filter((option) =>
        family.efforts.has(option),
      ),
      hasFast: family.hasFast,
    })
  }
  return models
}

function parseModelCatalog(stdout: string): CursorModel[] {
  const lines = stdout.split(/\r?\n/)
  const hasHeader = lines.some((line) => line.trim() === 'Available models')
  if (!hasHeader) {
    throw new Error('cursor models output is missing the Available models line')
  }

  const rows: VariantRow[] = []
  for (const line of lines) {
    const match = /^(\S+) - (.+)$/.exec(line.trim())
    if (!match) {
      continue
    }
    rows.push({
      variantId: match[1],
      displayName: match[2],
    })
  }

  if (rows.length === 0) {
    throw new Error('cursor models output contained no model variant lines')
  }

  return groupVariants(rows)
}

export async function fetchCursorModels(
  cliCommand: string = DEFAULT_CURSOR_CLI_COMMAND,
): Promise<CursorModel[]> {
  let stdout: string
  try {
    const result = await execFileAsync(cliCommand, ['models'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    stdout = result.stdout
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to run ${cliCommand} models: ${message}`)
  }
  return parseModelCatalog(stdout)
}

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
