import * as pty from 'node-pty'
import { randomUUID } from 'crypto'

const terminals = new Map<string, pty.IPty>()

export function getTerminal(id: string) {
  return terminals.get(id)
}

export function getAllTerminals() {
  return terminals
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

  const args = command
    ? ['-l', '-c', command]
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

  terminals.set(id, term)

  term.onExit(() => {
    terminals.delete(id)
  })

  return { id, pid: term.pid }
})
