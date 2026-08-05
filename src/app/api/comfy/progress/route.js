import { getComfyBackendWsUrl } from '@/lib/comfy-backend-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Browser EventSource ← SSE ← this route ← WebSocket ← ComfyUI.
 */
export async function GET(request) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return Response.json({ error: 'clientId is required' }, { status: 400 });
  }

  const wsUrl = getComfyBackendWsUrl(clientId);
  const encoder = new TextEncoder();

  let ws = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          // stream already closed
        }
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        try {
          ws?.close();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      try {
        const { default: WebSocketImpl } = await import('ws');
        ws = new WebSocketImpl(wsUrl);
      } catch (error) {
        send({
          type: 'execution_error',
          data: {
            exception_message: error instanceof Error ? error.message : 'WebSocket open failed',
          },
        });
        close();
        return;
      }

      ws.on('message', (data) => {
        const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
        try {
          send(JSON.parse(text));
        } catch {
          // ignore non-JSON
        }
      });

      ws.on('error', () => {
        send({
          type: 'execution_error',
          data: { exception_message: 'WebSocket connection failed' },
        });
        close();
      });

      ws.on('close', () => {
        close();
      });

      request.signal.addEventListener('abort', close);
    },
    cancel() {
      closed = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
