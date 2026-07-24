import { spawn } from 'child_process'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { prompt, cwd, mode, sessionId } = body

  if (!prompt) throw createError({ statusCode: 400, message: 'prompt required' })
  if (!cwd) throw createError({ statusCode: 400, message: 'cwd required' })

  const controller = new AbortController()

  event.node.req.on('close', () => {
    controller.abort()
  })

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const args: string[] = ['-p', '--output-format', 'text']

  if (mode === 'continue') {
    args.push('-c')
  } else if (mode === 'resume' && sessionId) {
    args.push('-r', sessionId)
  }

  args.push(prompt)

  const stream = new ReadableStream({
    start(streamController) {
      const encoder = new TextEncoder()

      const proc = spawn('claude', args, {
        cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
        signal: controller.signal,
      })

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString()
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stdout', text })}\n\n`))
      })

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString()
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stderr', text })}\n\n`))
      })

      proc.on('close', (code) => {
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', code })}\n\n`))
        streamController.close()
      })

      proc.on('error', (err) => {
        streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`))
        streamController.close()
      })
    },
  })

  return sendStream(event, stream)
})
