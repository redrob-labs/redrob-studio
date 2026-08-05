import { getComfyBackendUrl } from '@/lib/comfy-backend-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BLOCKED_PROMPT_MESSAGE =
  'Direct ComfyUI /prompt is disabled. Use /api/generate with an allowlisted workflowId.';

function backendUrl(pathSegments, searchParams) {
  const base = getComfyBackendUrl();
  const path = pathSegments.map(encodeURIComponent).join('/');
  const qs = searchParams?.toString();
  return qs ? `${base}/${path}?${qs}` : `${base}/${path}`;
}

async function proxyRequest(request, context) {
  const { path: pathSegments = [] } = await context.params;
  const segments = Array.isArray(pathSegments) ? pathSegments : [pathSegments];

  // Progress SSE is a dedicated route; avoid shadowing if caught here.
  if (segments[0] === 'progress') {
    return Response.json({ error: 'Use /api/comfy/progress' }, { status: 404 });
  }

  // T3: never forward client graphs to ComfyUI /prompt
  if (segments[0] === 'prompt') {
    return Response.json({ error: BLOCKED_PROMPT_MESSAGE }, { status: 403 });
  }

  const url = backendUrl(segments, request.nextUrl.searchParams);
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const init = {
    method: request.method,
    headers,
    duplex: 'half',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  let upstream;
  try {
    upstream = await fetch(url, init);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'ComfyUI proxy failed' },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) {
    responseHeaders.set('content-type', upstreamType);
  }
  const cacheControl = upstream.headers.get('cache-control');
  if (cacheControl) {
    responseHeaders.set('cache-control', cacheControl);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function POST(request, context) {
  return proxyRequest(request, context);
}

export async function PUT(request, context) {
  return proxyRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context);
}
