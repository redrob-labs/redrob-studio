/**
 * Browser-safe ComfyUI URL helpers (no backend host/port literals).
 */

export const COMFY_PROXY_BASE = '/api/comfy';

/**
 * URL prefix for ComfyUI HTTP calls from shared code.
 * Browser always uses the same-origin proxy. Server reads COMFYUI_URL with no
 * hardcoded host fallback here (fallback lives in comfy-backend-url.js).
 */
export function getComfyUrl() {
  if (typeof window === 'undefined') {
    const url = process.env.COMFYUI_URL;
    if (!url) {
      throw new Error('COMFYUI_URL is not set');
    }
    return String(url).replace(/\/$/, '');
  }
  return COMFY_PROXY_BASE;
}

export function getComfyProgressSseUrl(clientId) {
  const params = new URLSearchParams({ clientId });
  return `${COMFY_PROXY_BASE}/progress?${params.toString()}`;
}

/**
 * Rewrite absolute ComfyUI /view URLs (from server-side generation) to the
 * same-origin proxy so the browser can fetch without CORS failures.
 */
export function toBrowserComfyMediaUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  if (url.startsWith(`${COMFY_PROXY_BASE}/`) || url === COMFY_PROXY_BASE) {
    return url;
  }
  if (url.startsWith('/view?') || url.startsWith('/view&')) {
    return `${COMFY_PROXY_BASE}${url.replace(/^\/view&/, '/view?')}`;
  }
  try {
    const parsed = new URL(url, 'http://local.invalid');
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path === '/view' || path.endsWith('/view')) {
      return `${COMFY_PROXY_BASE}/view?${parsed.searchParams.toString()}`;
    }
  } catch {
    // keep original
  }
  return url;
}

/** Map generate API result URLs onto the browser proxy. */
export function rewriteGenerateResultForBrowser(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }
  if (!result.url) {
    return result;
  }
  return {
    ...result,
    url: toBrowserComfyMediaUrl(result.url),
  };
}
