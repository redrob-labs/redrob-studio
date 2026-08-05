import { generateImage } from '@/lib/comfyui';
import { resolveWorkflow } from '@/lib/workflow-catalog';

export const MODERATION_OUTCOMES = ['safe-output', 'fail-suggestive', 'fail-explicit'];

const MODERATION_MODE = 'moderation';

export function resolveModerationWorkflow() {
  const workflow = resolveWorkflow({
    modality: 'image',
    task: 'vision',
    engine: 'quality',
  });
  if (!workflow?.vlm) {
    throw new Error('QwenVL vision workflow is not available');
  }
  return workflow;
}

export function extractJsonObject(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeModerationResult(raw, fallbackText = '') {
  const outcome = MODERATION_OUTCOMES.includes(raw?.outcome) ? raw.outcome : null;
  const confidence =
    typeof raw?.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.min(1, Math.max(0, raw.confidence))
      : null;
  const rationale =
    typeof raw?.rationale === 'string' && raw.rationale.trim()
      ? raw.rationale.trim()
      : fallbackText.slice(0, 280) || null;

  if (!outcome) {
    return {
      outcome: null,
      confidence,
      rationale: rationale ?? 'Could not parse moderation JSON',
      rawText: fallbackText,
      parseError: true,
    };
  }

  return {
    outcome,
    confidence,
    rationale,
    rawText: fallbackText,
    parseError: false,
  };
}

/**
 * Run QwenVL safety moderation on an image File/Blob.
 * @returns {{ outcome, confidence, rationale, rawText, parseError }}
 */
export async function moderateImageWithQwenVl(file, { signal, freeBeforeRun = false, unloadAfter = false } = {}) {
  const workflow = resolveModerationWorkflow();
  const imageNode = workflow.imageInputs?.[0]?.node ?? workflow.imageNode ?? '1';
  const imageFile =
    file instanceof File
      ? file
      : new File([file], 'eval-moderation.png', { type: file.type || 'image/png' });

  const result = await generateImage({
    workflowId: workflow.id,
    baseWorkflow: workflow.workflow,
    imageFiles: { [imageNode]: imageFile },
    imageInputs: workflow.imageInputs ?? undefined,
    imageNode,
    prompt: '',
    promptNode: workflow.promptNode,
    promptField: workflow.promptField ?? 'custom_prompt',
    requiresImage: true,
    vlm: workflow.vlm,
    vlmSettings: { mode: MODERATION_MODE },
    signal,
    freeBeforeRun,
    unloadAfter,
    outputType: 'text',
    historyTimeoutMs: workflow.vlm.historyTimeoutMs ?? 300_000,
  });

  const text = result?.text ?? '';
  return normalizeModerationResult(extractJsonObject(text), text);
}
