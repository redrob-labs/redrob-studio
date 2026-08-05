import { generateImage as generateImageDirect } from '@/lib/comfyui';
import { enforcePromptSafetyGate } from '@/lib/safety-gate';
import { resolveAllowlistedWorkflow, assertNoClientGraph } from '@/lib/workflow-allowlist';

/**
 * Server-only generation entry: allowlisted workflowId + params, never a client graph.
 */
export async function generateImageOnServer(options = {}) {
  const {
    workflowId,
    baseWorkflow: _ignoredGraph,
    clientId,
    skipPromptGate = false,
    promptGateChecker,
    ...rest
  } = options;

  assertNoClientGraph(_ignoredGraph, 'baseWorkflow');
  assertNoClientGraph(rest.prompt && typeof rest.prompt === 'object' ? rest.prompt : null, 'prompt');

  const option = resolveAllowlistedWorkflow(workflowId);

  if (!skipPromptGate) {
    await enforcePromptSafetyGate(rest.prompt ?? '', {
      signal: rest.signal,
      checker: promptGateChecker,
    });
  }

  return generateImageDirect({
    ...rest,
    baseWorkflow: option.workflow,
    // Prefer template wiring when caller omitted nodes
    imageNode: rest.imageNode ?? option.imageNode,
    imageInputs: rest.imageInputs ?? option.imageInputs ?? undefined,
    audioNode: rest.audioNode ?? option.audioNode,
    audioInputs: rest.audioInputs ?? option.audioInputs ?? undefined,
    videoInputs: rest.videoInputs ?? option.videoInputs ?? undefined,
    promptNode: rest.promptNode ?? option.promptNode,
    promptField: rest.promptField ?? option.promptField ?? 'text',
    negativePromptNode: rest.negativePromptNode ?? option.negativePromptNode,
    negativePromptField: rest.negativePromptField ?? option.negativePromptField ?? 'text',
    requiresImage: rest.requiresImage ?? option.requiresImage,
    requiresAudio: rest.requiresAudio ?? option.requiresAudio ?? false,
    requiresVideo: rest.requiresVideo ?? option.requiresVideo ?? false,
    lora: rest.lora ?? option.lora,
    promptRequire: rest.promptRequire ?? option.promptRequire,
    checkpoint: rest.checkpoint ?? option.checkpoint ?? undefined,
    video: rest.video ?? option.video,
    samplerNode: rest.samplerNode ?? option.samplerNode ?? undefined,
    clipEncodeNodes: rest.clipEncodeNodes ?? option.clipEncodeNodes ?? undefined,
    sampler: rest.sampler ?? option.sampler ?? undefined,
    upscale: rest.upscale ?? option.upscale ?? undefined,
    asr: rest.asr ?? option.asr ?? undefined,
    vlm: rest.vlm ?? option.vlm ?? undefined,
    music: rest.music ?? option.music ?? undefined,
    videoExtract: rest.videoExtract ?? option.videoExtract ?? undefined,
    audioConvert: rest.audioConvert ?? option.audioConvert ?? undefined,
    imageConvert: rest.imageConvert ?? option.imageConvert ?? undefined,
    imageCompress: rest.imageCompress ?? option.imageCompress ?? undefined,
    tts: rest.tts ?? option.tts ?? undefined,
    clientId,
  });
}
