import { execSync } from 'child_process'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { type, path } = body

  if (!path) throw createError({ statusCode: 400, message: 'path required' })

  const commands: Record<string, string> = {
    'vscode': `open -a "Visual Studio Code" "${path}"`,
    'android-studio': `open -a "Android Studio" "${path}"`,
    'xcode': `open -a "Xcode" "${path}"`,
    'finder': `open "${path}"`,
    'terminal': `open -a "Terminal" "${path}"`,
    'iterm': `open -a "iTerm" "${path}"`,
  }

  const cmd = commands[type]
  if (!cmd) throw createError({ statusCode: 400, message: `Unknown IDE type: ${type}` })

  try {
    execSync(cmd)
    return { success: true, launched: type }
  } catch (e: any) {
    throw createError({ statusCode: 500, message: e.message })
  }
})
