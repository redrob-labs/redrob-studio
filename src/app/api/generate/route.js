import { generateImageOnServer } from '@/lib/comfy-generate-server';
import { assertNoClientGraph } from '@/lib/workflow-allowlist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

function parseJsonField(formData, key) {
  const raw = formData.get(key);
  if (raw == null || raw === '') return null;
  return JSON.parse(String(raw));
}

function collectNamedFiles(formData, prefix) {
  /** @type {Record<string, File>} */
  const out = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (typeof value === 'string') continue;
    const node = key.slice(prefix.length);
    if (node) out[node] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  let meta;
  try {
    meta = parseJsonField(formData, 'meta') ?? {};
  } catch {
    return Response.json({ error: 'Invalid meta JSON' }, { status: 400 });
  }

  try {
    assertNoClientGraph(meta.baseWorkflow, 'baseWorkflow');
    assertNoClientGraph(meta.promptGraph, 'promptGraph');
    assertNoClientGraph(meta.workflow, 'workflow');
    // meta.prompt is the text prompt string - not a graph
    if (meta.prompt && typeof meta.prompt === 'object') {
      assertNoClientGraph(meta.prompt, 'prompt');
    }

    const file = formData.get('file');
    const imageFiles = collectNamedFiles(formData, 'imageFiles.');
    const audioFiles = collectNamedFiles(formData, 'audioFiles.');
    const videoFiles = collectNamedFiles(formData, 'videoFiles.');

    const result = await generateImageOnServer({
      ...meta,
      file: file && typeof file !== 'string' ? file : undefined,
      imageFiles,
      audioFiles,
      videoFiles,
      signal: request.signal,
    });

    return Response.json({ result });
  } catch (error) {
    const status = error?.code?.startsWith?.('safety_gate') ? 403 : 500;
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Generation failed',
        code: error?.code ?? undefined,
      },
      { status: error?.name === 'SafetyGateError' ? 403 : status },
    );
  }
}
