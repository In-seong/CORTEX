import * as pty from 'node-pty'
import { randomUUID } from 'crypto'
import { readdirSync, existsSync } from 'fs'
import { claudeProjectDir } from '../../utils/claude-paths'

// claude -c 는 이전 대화가 없으면 "No conversation found to continue"로 즉시 종료된다.
// 해당 cwd의 transcript(.jsonl)가 하나도 없으면 -c 를 제거해 새 대화로 시작.
function adjustClaudeContinue(command: string, cwd: string): string {
  if (!command || !/\bclaude\b/.test(command) || !/\s-c(\s|$)/.test(command)) return command
  const dir = claudeProjectDir(cwd)
  try {
    if (existsSync(dir) && readdirSync(dir).some(f => f.endsWith('.jsonl'))) return command
  } catch {}
  return command.replace(/\s-c(?=\s|$)/, '')
}

// orca terminal-main-owned-state 패턴의 축약판:
// 서버가 출력 링버퍼(2MB)+단조 seq를 소유하고, 클라이언트는 seq 기준으로 replay/재동기화한다.
// 페이지 이탈/네트워크 단절에도 PTY는 살아있고, 재접속 시 since=seq로 이어받는다.

export interface TermSession {
  pty: pty.IPty
  cwd: string
  startClaude: boolean
  seq: number
  buffer: { seq: number; data: string }[]
  bufferBytes: number
  listeners: Set<(seq: number, data: string) => void>
  exitListeners: Set<(code: number) => void>
  exited: boolean
  exitCode: number | null
  createdAt: number
}

const MAX_BUFFER_BYTES = 2 * 1024 * 1024

const g = globalThis as any
if (!g.__cortexTerminals) g.__cortexTerminals = new Map<string, TermSession>()
const terminals: Map<string, TermSession> = g.__cortexTerminals

export function getTerminal(id: string) {
  return terminals.get(id)
}

export function getAllTerminals() {
  return terminals
}

export function killByCwd(cwd: string): number {
  let killed = 0
  for (const [id, s] of terminals) {
    if (s.cwd === cwd && !s.exited) {
      try { s.pty.kill() } catch {}
      killed++
    }
  }
  return killed
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { cwd, command } = body

  if (!cwd) throw createError({ statusCode: 400, message: 'cwd required' })

  const id = randomUUID()
  const shell = process.env.SHELL || '/bin/zsh'

  const home = process.env.HOME || '/Users/scoop'
  const extraPaths = [
    `${home}/.local/bin`,
    `${home}/.nvm/versions/node/v20.19.6/bin`,
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
  ]
  const currentPath = process.env.PATH || '/usr/bin:/bin'
  const fullPath = [...extraPaths, ...currentPath.split(':')].filter((v, i, a) => a.indexOf(v) === i).join(':')

  const effectiveCommand = command ? adjustClaudeContinue(command, cwd) : command
  const args = effectiveCommand
    ? ['-l', '-c', effectiveCommand]
    : ['-l']

  const term = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      HOME: home,
      PATH: fullPath,
    },
  })

  const session: TermSession = {
    pty: term,
    cwd,
    startClaude: !!command,
    seq: 0,
    buffer: [],
    bufferBytes: 0,
    listeners: new Set(),
    exitListeners: new Set(),
    exited: false,
    exitCode: null,
    createdAt: Date.now(),
  }

  term.onData((data: string) => {
    session.seq++
    session.buffer.push({ seq: session.seq, data })
    session.bufferBytes += data.length
    while (session.bufferBytes > MAX_BUFFER_BYTES && session.buffer.length > 1) {
      const dropped = session.buffer.shift()!
      session.bufferBytes -= dropped.data.length
    }
    for (const fn of session.listeners) {
      try { fn(session.seq, data) } catch {}
    }
  })

  term.onExit(({ exitCode }) => {
    session.exited = true
    session.exitCode = exitCode
    for (const fn of session.exitListeners) {
      try { fn(exitCode) } catch {}
    }
    // 재접속으로 마지막 출력을 볼 수 있게 5분 유예 후 제거
    setTimeout(() => terminals.delete(id), 5 * 60 * 1000)
  })

  terminals.set(id, session)

  return { id, pid: term.pid }
})
