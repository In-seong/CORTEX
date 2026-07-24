import { getTerminal } from './spawn.post'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const term = getTerminal(id)
  if (!term) throw createError({ statusCode: 404, message: 'Terminal not found' })

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const controller = new AbortController()

  event.node.req.on('close', () => {
    controller.abort()
  })

  const stream = new ReadableStream({
    start(streamController) {
      const encoder = new TextEncoder()

      const dispose = term.onData((data: string) => {
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'output', data })}\n\n`))
        } catch {}
      })

      term.onExit(({ exitCode }) => {
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'exit', code: exitCode })}\n\n`))
          streamController.close()
        } catch {}
      })

      controller.signal.addEventListener('abort', () => {
        dispose.dispose()
      })
    },
  })

  return sendStream(event, stream)
})
