import { getTerminal } from './spawn.post'

// SSE 스트림. ?since=<seq> 로 재접속하면 링버퍼에서 그 이후 출력을 replay한 뒤 라이브 전환.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const session = getTerminal(id)
  if (!session) throw createError({ statusCode: 404, message: 'Terminal not found' })

  const query = getQuery(event)
  const since = Number(query.since) || 0

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const stream = new ReadableStream({
    start(streamController) {
      const encoder = new TextEncoder()
      let closed = false

      const send = (obj: any) => {
        if (closed) return
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        } catch {
          closed = true
        }
      }

      // 1) replay: since 이후의 버퍼 내용
      const replay = session.buffer.filter(b => b.seq > since)
      if (replay.length) {
        send({ type: 'replay', seq: replay[replay.length - 1].seq, data: replay.map(b => b.data).join('') })
      } else {
        send({ type: 'hello', seq: session.seq })
      }

      // 2) live
      const onData = (seq: number, data: string) => send({ type: 'output', seq, data })
      const onExit = (code: number) => {
        send({ type: 'exit', code })
        cleanup()
        try { streamController.close() } catch {}
      }

      session.listeners.add(onData)
      session.exitListeners.add(onExit)

      const cleanup = () => {
        closed = true
        session.listeners.delete(onData)
        session.exitListeners.delete(onExit)
      }

      if (session.exited) {
        onExit(session.exitCode ?? 0)
        return
      }

      event.node.req.on('close', () => {
        cleanup()
        try { streamController.close() } catch {}
      })
    },
  })

  return sendStream(event, stream)
})
