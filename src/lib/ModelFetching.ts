import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  DEFAULT_CURSOR_CLI_COMMAND,
  type CursorCliCommand,
} from '@/lib/cursorCliCommand'
import Model, {
  type AcpModelId,
  REASONING_OPTIONS,
  type ReasoningOption,
} from '@/lib/Model'

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

function groupVariants(rows: VariantRow[]): Model[] {
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

  const models: Model[] = []
  for (const [familyId, family] of families) {
    models.push({
      name: pickDisplayName(family.names),
      id: (CLI_FAMILY_TO_ACP_BASE_ID[familyId] ?? familyId) as AcpModelId,
      reasoningOptions: REASONING_OPTIONS.filter((option) =>
        family.efforts.has(option),
      ),
      hasFast: family.hasFast,
    })
  }
  return models
}

function parseModelCatalog(stdout: string): Model[] {
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
  cliCommand: CursorCliCommand = DEFAULT_CURSOR_CLI_COMMAND,
): Promise<Model[]> {
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
