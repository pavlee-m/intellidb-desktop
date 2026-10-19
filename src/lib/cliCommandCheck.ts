import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import type { CliCommandCheckResult } from '@/lib/cliCommand'

function errnoCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function hasRejectedFsCharacters(command: string): boolean {
  if (command.includes('\0')) {
    return true
  }
  for (let index = 0; index < command.length; index += 1) {
    if (command.charCodeAt(index) < 32) {
      return true
    }
  }
  if (process.platform === 'win32' && /[<>"|?*]/.test(command)) {
    return true
  }
  return false
}

function isPathLike(command: string): boolean {
  if (command.includes('/')) {
    return true
  }
  // A POSIX filename may contain a backslash; only treat it as a separator on Windows.
  return process.platform === 'win32' && command.includes('\\')
}

function pathSearchNames(name: string): string[] {
  if (process.platform !== 'win32' || path.extname(name).length > 0) {
    return [name]
  }
  const pathext = process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD'
  const suffixes = pathext.split(';').filter((suffix) => suffix.length > 0)
  return [name, ...suffixes.map((suffix) => `${name}${suffix}`)]
}

type CandidateProbe =
  | { status: 'ok'; resolvedPath: string }
  | { status: 'missing' }
  | { status: 'not-a-file' }
  | { status: 'not-executable' }
  | { status: 'inaccessible' }

async function probeCandidate(candidate: string): Promise<CandidateProbe> {
  let fileStats
  try {
    fileStats = await stat(candidate)
  } catch (error) {
    const code = errnoCode(error)
    if (code === 'ENOENT') {
      return { status: 'missing' }
    }
    if (code) {
      return { status: 'inaccessible' }
    }
    throw error
  }
  if (!fileStats.isFile()) {
    return { status: 'not-a-file' }
  }
  try {
    await access(candidate, constants.X_OK)
  } catch (error) {
    const code = errnoCode(error)
    if (!code) {
      throw error
    }
    return { status: 'not-executable' }
  }
  return { status: 'ok', resolvedPath: candidate }
}

function inaccessibleResult(candidate: string): CliCommandCheckResult {
  return {
    ok: false,
    reason: 'inaccessible',
    message: `Cannot access "${candidate}".`,
  }
}

export async function checkCliCommand(raw: string): Promise<CliCommandCheckResult> {
  const command = raw.trim()
  if (command.length === 0) {
    return { ok: false, reason: 'empty', message: 'Command is empty.' }
  }
  if (hasRejectedFsCharacters(command)) {
    return { ok: false, reason: 'invalid', message: 'Command contains invalid characters.' }
  }

  if (isPathLike(command)) {
    const resolved = path.resolve(command)
    const probe = await probeCandidate(resolved)
    switch (probe.status) {
      case 'ok':
        return { ok: true, resolvedPath: resolved }
      case 'missing':
        return { ok: false, reason: 'not-found', message: `"${command}" does not exist.` }
      case 'not-a-file':
        return { ok: false, reason: 'not-a-file', message: `"${command}" is not a file.` }
      case 'not-executable':
        return {
          ok: false,
          reason: 'not-executable',
          message: `"${command}" exists but is not executable. Make it executable with chmod +x.`,
        }
      case 'inaccessible':
        return inaccessibleResult(resolved)
    }
  }

  const pathEntries = (process.env.PATH ?? '').split(path.delimiter)
  for (const dir of pathEntries) {
    // Empty PATH segments mean the current directory, matching execvp and spawn.
    const directory = dir.length > 0 ? dir : '.'
    for (const name of pathSearchNames(command)) {
      const candidate = path.join(directory, name)
      const probe = await probeCandidate(candidate)
      if (probe.status === 'ok') {
        return { ok: true, resolvedPath: probe.resolvedPath }
      }
      if (probe.status === 'inaccessible') {
        return inaccessibleResult(candidate)
      }
    }
  }

  return {
    ok: false,
    reason: 'not-found',
    message: `Command "${command}" was not found on your PATH. Install it or enter an absolute path in Settings → Integrations.`,
  }
}
