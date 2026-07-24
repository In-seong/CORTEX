import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { projectPath } = body

  if (!projectPath) throw createError({ statusCode: 400, message: 'projectPath required' })

  const projectKey = projectPath.replace(/[^a-zA-Z0-9]/g, '-')
  const sessionsDir = join(homedir(), '.claude', 'projects', projectKey)

  try {
    const files = await readdir(sessionsDir)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))

    const sessions = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = join(sessionsDir, file)
        const id = file.replace('.jsonl', '')
        const fileStat = await stat(filePath)

        let firstMessage = ''
        let lastMessage = ''
        let messageCount = 0
        try {
          const content = await readFile(filePath, 'utf-8')
          const lines = content.trim().split('\n').filter(Boolean)
          messageCount = lines.length

          for (const line of lines) {
            try {
              const msg = JSON.parse(line)
              if (msg.type === 'human' && msg.message?.content) {
                const text = typeof msg.message.content === 'string'
                  ? msg.message.content
                  : Array.isArray(msg.message.content)
                    ? msg.message.content.find((c: any) => c.type === 'text')?.text || ''
                    : ''
                if (!firstMessage && text) firstMessage = text.slice(0, 100)
                if (text) lastMessage = text.slice(0, 100)
              }
            } catch {}
          }
        } catch {}

        return {
          id,
          firstMessage,
          lastMessage,
          messageCount,
          sizeMb: Math.round(fileStat.size / 1024 / 1024 * 10) / 10,
          updatedAt: fileStat.mtime.toISOString(),
        }
      })
    )

    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return { sessions }
  } catch {
    return { sessions: [] }
  }
})
