/** Server-side ComfyUI backend URL helpers (API routes / server runtime only). */
export const DEFAULT_COMFYUI_URL = 'http://127.0.0.1:8188';

export function getComfyBackendUrl() {
  const url = process.env.COMFYUI_URL || DEFAULT_COMFYUI_URL;
  return String(url).replace(/\/$/, '');
}

export function getComfyBackendWsUrl(clientId) {
  const base = new URL(getComfyBackendUrl());
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/ws';
  base.searchParams.set('clientId', clientId);
  return base.toString();
}
