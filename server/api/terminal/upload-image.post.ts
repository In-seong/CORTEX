import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { base64, mimeType, projectPath } = body

  if (!base64 || !projectPath) {
    throw createError({ statusCode: 400, message: 'base64 and projectPath required' })
  }

  const ext = mimeType?.includes('png') ? 'png' : mimeType?.includes('gif') ? 'gif' : 'jpg'
  const tmpDir = join(projectPath, '.claude-tmp')

  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }

  const filename = `paste-${randomUUID().slice(0, 8)}.${ext}`
  const filePath = join(tmpDir, filename)

  const buffer = Buffer.from(base64, 'base64')
  writeFileSync(filePath, buffer)

  return { path: filePath, filename }
})
