import {
  dimensionsFromAspectRatio,
  generateImage,
  secondsToVideoLength,
  toBrowserComfyMediaUrl,
} from '@/lib/comfyui';
import { moderateImageWithQwenVl } from '@/lib/eval/moderation';
import {
  findEvalWorkflowEntry,
  isAudioEvalWorkflow,
  isMatureEvalWorkflow,
  isTextEvalWorkflow,
  isVideoEvalWorkflow,
  resolveEvalWorkflowTask,
} from '@/lib/eval/workflows';
import { resolveWorkflow } from '@/lib/workflow-catalog';
import { getWorkflowOptions } from '@/lib/workflows';

function buildLoraRunConfig(workflow, entry) {
  const enabledMap = entry?.loraEnabled ?? {};
  const slots = entry?.loraSlots ?? [];

  let styleLoraEnabled;
  if (workflow?.lora?.id) {
    styleLoraEnabled =
      workflow.lora.id in enabledMap
        ? Boolean(enabledMap[workflow.lora.id])
        : Boolean(workflow.lora.defaultEnabled);
  }

  return {
    styleLoraEnabled,
    slots,
  };
}

function buildOutputSize(workflow, _unused, prompt, aspectRatioOverride) {
  const sizeConfig = workflow?.outputSize;
  if (!sizeConfig) {
    return undefined;
  }
  const aspectRatio =
    aspectRatioOverride || sizeConfig.defaultAspectRatio || '1:1';
  const baseSize = sizeConfig.baseSize;
  const { width, height } = dimensionsFromAspectRatio(aspectRatio, {
    baseSize,
    step: sizeConfig.step,
    min: sizeConfig.min,
    max: sizeConfig.max,
    squareSize: sizeConfig.squareSize,
  });
  return {
    node: sizeConfig.node,
    alsoNodes: sizeConfig.alsoNodes ?? [],
    width,
    height,
  };
}

function buildEvalVideoConfig(workflow, { seconds } = {}) {
  const video = workflow?.video;
  if (!video) {
    return undefined;
  }
  const engine = video.engine ?? 'wan';
  if (engine === 'ltx' || engine === 'director') {
    throw new Error('LTX/director video gen is not shipped in the OSS-safe cut');
  }
  const aspectRatio = video.defaultAspectRatio ?? '9:16';
  const { width, height } = dimensionsFromAspectRatio(aspectRatio, {
    baseSize: video.baseSize ?? 768,
    step: video.step ?? 32,
    min: video.widthMin ?? 256,
    max: video.widthMax ?? 1280,
  });
  const resolvedSeconds = seconds ?? 10;
  const fps = video.fps ?? 24;
  const lightx2vEnabled = true;
  const preset =
    (lightx2vEnabled ? video.sampler?.fast : video.sampler?.quality) ??
    video.sampler?.fast ??
    video.sampler?.quality ??
    {};
  const cfg = preset.cfg ?? 1.5;

  return {
    engine,
    fpsNode: video.fpsNode,
    wanNode: video.wanNode,
    width,
    height,
    length: secondsToVideoLength(resolvedSeconds, fps, engine),
    fps,
    lightx2vEnabled,
    loras: video.loras,
    sampler: video.sampler
      ? {
          highNoiseNode: video.sampler.highNoiseNode,
          lowNoiseNode: video.sampler.lowNoiseNode,
          steps: preset.steps,
          splitStep: preset.splitStep,
          cfg,
        }
      : undefined,
  };
}

export function resolveEvalWorkflow(idOrTask) {
  const entry = findEvalWorkflowEntry(idOrTask);

  if (entry?.tool) {
    const workflowId = entry.workflowId ?? entry.baseId ?? entry.id;
    const byId = getWorkflowOptions().find((item) => item.id === workflowId);
    if (byId) {
      return byId;
    }
    if (entry.task) {
      const byTask = getWorkflowOptions().find((item) => item.task === entry.task);
      if (byTask) {
        return byTask;
      }
    }
  }

  if (
    entry?.modality === 'audio' ||
    entry?.task === 'music' ||
    entry?.task === 'voice-design' ||
    entry?.task === 'speak' ||
    entry?.task === 'voice-clone' ||
    entry?.task === 'transcribe' ||
    entry?.task === 'convert-audio' ||
    entry?.task === 'extract-audio'
  ) {
    const workflowId = entry.workflowId ?? entry.baseId ?? entry.id;
    const workflow = getWorkflowOptions().find((item) => item.id === workflowId);
    if (!workflow) {
      throw new Error(`No audio workflow for id "${workflowId}"`);
    }
    return workflow;
  }

  if (
    entry?.modality === 'video' ||
    entry?.workflowId?.startsWith?.('ltx-')
  ) {
    const workflowId = entry.workflowId ?? entry.id;
    const workflow = getWorkflowOptions().find((item) => item.id === workflowId);
    if (!workflow) {
      throw new Error(`No video workflow for id "${workflowId}"`);
    }
    return workflow;
  }

  if (entry?.modality === 'text' || entry?.task === 'vision' || entry?.task === 'image-to-text') {
    const workflowId = entry.workflowId ?? entry.baseId ?? entry.id;
    const workflow = getWorkflowOptions().find((item) => item.id === workflowId);
    if (!workflow) {
      throw new Error(`No text workflow for id "${workflowId}"`);
    }
    return workflow;
  }

  const task = resolveEvalWorkflowTask(idOrTask);
  const byTask = getWorkflowOptions().find((item) => item.task === task);
  if (byTask && (byTask.requiresImage || byTask.upscale || byTask.imageCompress || byTask.imageConvert)) {
    return byTask;
  }
  const workflow = resolveWorkflow({ modality: 'image', task, engine: 'quality' });
  if (!workflow) {
    throw new Error(`No image workflow for task "${task}"`);
  }
  return workflow;
}

export function buildMusicSettingsFromPrompt(prompt, evalEntry) {
  if (!prompt) {
    return undefined;
  }
  return {
    lyrics: prompt.lyrics ?? '',
    seconds: prompt.seconds ?? 60,
    modelVersion: evalEntry?.musicModelVersion,
    bpm: prompt.bpm,
    keyScale: prompt.keyScale,
    timeSignature: prompt.timeSignature,
    language: prompt.language,
  };
}

export function resolveMusicEvalPromptText(prompt) {
  return prompt?.prompt ?? '';
}

export function buildTtsSettingsFromPrompt(prompt) {
  if (!prompt) {
    return undefined;
  }
  return {
    speaker: prompt.speaker ?? prompt.ttsSpeaker ?? undefined,
    voiceInstruct: prompt.instruct ?? prompt.voiceInstruct ?? '',
    refText: prompt.refText ?? prompt.referenceText ?? '',
    language: prompt.language ?? 'Auto',
    unloadModels: true,
  };
}

export function resolveVoiceDesignEvalPromptText(prompt) {
  return prompt?.prompt ?? prompt?.text ?? '';
}

function buildToolSettingsFromPrompt(workflow, prompt) {
  const settings = prompt?.settings ?? {};
  const out = {};

  if (workflow?.upscale) {
    out.upscale = workflow.upscale;
    out.upscaleSettings = {
      scale: settings.scale ?? prompt?.scale ?? workflow.upscale.defaultScale ?? 2,
    };
  }

  if (workflow?.imageCompress) {
    out.imageCompress = workflow.imageCompress;
    out.imageCompressSettings = {
      scale: settings.scale ?? prompt?.scale ?? workflow.imageCompress.defaultScale ?? 1,
      format: settings.format ?? prompt?.format ?? workflow.imageCompress.defaultFormat ?? 'webp',
    };
  }

  if (workflow?.imageConvert) {
    out.imageConvert = workflow.imageConvert;
    out.imageConvertSettings = {
      format: settings.format ?? prompt?.format ?? workflow.imageConvert.defaultFormat ?? 'png',
    };
  }

  if (workflow?.audioConvert) {
    out.audioConvert = workflow.audioConvert;
    out.audioConvertSettings = {
      format: settings.format ?? prompt?.format ?? workflow.audioConvert.defaultFormat ?? 'mp3',
    };
  }

  if (workflow?.videoExtract) {
    out.videoExtract = workflow.videoExtract;
  }

  if (workflow?.asr) {
    out.asr = workflow.asr;
    out.asrSettings = {
      modelSize: settings.modelSize ?? prompt?.modelSize ?? workflow.asr.defaultModelSize,
      precision: settings.precision ?? workflow.asr.defaultPrecision,
      language: settings.language ?? prompt?.language ?? workflow.asr.defaultLanguage ?? 'auto',
    };
  }

  if (workflow?.vlm) {
    out.vlm = workflow.vlm;
    out.vlmSettings = {
      mode: settings.mode ?? prompt?.mode ?? workflow.vlm.defaultMode,
    };
  }

  return out;
}

function resolveEvalOutputType(workflow) {
  if (workflow?.outputType) {
    return workflow.outputType;
  }
  if (workflow?.asr || workflow?.vlm) {
    return 'text';
  }
  if (workflow?.music || workflow?.tts || workflow?.audioConvert || workflow?.videoExtract) {
    return 'audio';
  }
  if ((workflow?.modality ?? '') === 'video' || workflow?.video) {
    return 'video';
  }
  return 'image';
}

export function buildEvalGenerateOptions(
  workflow,
  {
    prompt,
    seed,
    signal,
    freeBeforeRun,
    unloadAfter,
    mature = false,
    evalEntry = null,
    imageFiles = null,
    imageFile = null,
    audioFiles = null,
    videoFiles = null,
    aspectRatio = null,
    musicSettings = null,
    ttsSettings = null,
    suitePrompt = null,
  },
) {
  const { styleLoraEnabled } = buildLoraRunConfig(
    workflow,
    evalEntry,
  );
  const outputType = resolveEvalOutputType(workflow);
  const isVideo = outputType === 'video';
  const isMusic = Boolean(workflow.music);
  const isTts = Boolean(workflow.tts);
  const isAudio = outputType === 'audio' || isMusic || isTts;
  const isText = outputType === 'text';
  const imageNode = workflow.imageNode ?? null;
  let resolvedImageFiles = imageFiles ?? null;
  if (!resolvedImageFiles && imageFile && imageNode) {
    resolvedImageFiles = { [imageNode]: imageFile };
  }

  const resolvedMusicSettings =
    musicSettings ??
    (isMusic && evalEntry?.musicModelVersion
      ? { modelVersion: evalEntry.musicModelVersion }
      : undefined);

  const toolSettings = buildToolSettingsFromPrompt(workflow, suitePrompt);

  return {
    workflowId: workflow.id,
    baseWorkflow: workflow.workflow,
    prompt,
    promptNode: workflow.promptNode,
    promptField: workflow.promptField ?? 'text',
    negativePrompt: workflow.defaultNegativePrompt ?? undefined,
    negativePromptNode: workflow.negativePromptNode ?? undefined,
    negativePromptField: workflow.negativePromptField ?? 'text',
    requiresImage: Boolean(workflow.requiresImage),
    requiresAudio: Boolean(workflow.requiresAudio),
    requiresVideo: Boolean(workflow.requiresVideo),
    imageNode: imageNode ?? undefined,
    imageInputs: workflow.imageInputs ?? undefined,
    imageFiles: resolvedImageFiles ?? undefined,
    file: imageFile && !resolvedImageFiles ? imageFile : undefined,
    audioFiles: audioFiles ?? undefined,
    audioInputs: workflow.audioInputs ?? undefined,
    audioNode:
      workflow.audioNode ??
      workflow.asr?.loadAudioNode ??
      workflow.tts?.loadAudioNode ??
      undefined,
    videoFiles: videoFiles ?? undefined,
    videoInputs: workflow.videoInputs ?? undefined,
    lora: workflow.lora ?? undefined,
    loraEnabled: workflow.lora ? Boolean(styleLoraEnabled) : undefined,
    loraStrength: workflow.lora?.strength,
    checkpoint: workflow.checkpoint ?? undefined,
    outputSize:
      isVideo || isAudio || isText
        ? undefined
        : buildOutputSize(workflow, null, prompt, aspectRatio),
    video: isVideo && workflow.video ? buildEvalVideoConfig(workflow) : undefined,
    music: isMusic ? workflow.music : undefined,
    musicSettings: isMusic ? resolvedMusicSettings : undefined,
    tts: isTts ? workflow.tts : undefined,
    ttsSettings: isTts ? ttsSettings : undefined,
    samplerNode: workflow.samplerNode ?? undefined,
    sampler: workflow.sampler ?? undefined,
    clipEncodeNodes: workflow.clipEncodeNodes ?? undefined,
    ...toolSettings,
    seed,
    signal,
    freeBeforeRun: Boolean(freeBeforeRun),
    unloadAfter: Boolean(unloadAfter),
    outputType,
    historyTimeoutMs:
      workflow.tts?.historyTimeoutMs ??
      workflow.asr?.historyTimeoutMs ??
      workflow.vlm?.historyTimeoutMs ??
      workflow.music?.historyTimeoutMs ??
      workflow.videoExtract?.historyTimeoutMs,
  };
}

/** @deprecated Use generateEvalMedia */
export async function generateEvalImage(idOrTask, options) {
  return generateEvalMedia(idOrTask, options);
}

export async function generateEvalMedia(idOrTask, options) {
  const evalEntry = findEvalWorkflowEntry(idOrTask);
  const workflow = resolveEvalWorkflow(idOrTask);
  const mature = options?.mature ?? isMatureEvalWorkflow(idOrTask);
  const isAudio = isAudioEvalWorkflow(idOrTask);
  const isVoiceDesign =
    evalEntry?.task === 'voice-design' || Boolean(workflow?.tts?.mode === 'voiceDesign');
  const isSpeakOrClone =
    evalEntry?.task === 'speak' ||
    evalEntry?.task === 'voice-clone' ||
    workflow?.tts?.mode === 'customVoice' ||
    workflow?.tts?.mode === 'voiceClone';
  const isMusic = Boolean(workflow?.music) && !isSpeakOrClone && !isVoiceDesign;

  let prompt = options?.prompt;
  let musicSettings = options?.musicSettings;
  let ttsSettings = options?.ttsSettings;
  const suitePrompt = options?.suitePrompt ?? options?.musicPrompt ?? null;

  if (isVoiceDesign || isSpeakOrClone) {
    prompt = prompt ?? resolveVoiceDesignEvalPromptText(suitePrompt);
    ttsSettings = ttsSettings ?? buildTtsSettingsFromPrompt(suitePrompt);
    if (ttsSettings && options?.seed != null && ttsSettings.seed == null) {
      ttsSettings = { ...ttsSettings, seed: Number(options.seed) };
    }
  } else if (isMusic || (isAudio && suitePrompt && !workflow?.requiresAudio && !workflow?.asr)) {
    prompt = prompt ?? resolveMusicEvalPromptText(suitePrompt, evalEntry);
    musicSettings = musicSettings ?? buildMusicSettingsFromPrompt(suitePrompt, evalEntry);
  } else if (suitePrompt?.prompt != null && prompt == null) {
    prompt = suitePrompt.prompt;
  }

  // Empty string is fine for tools that hide the prompt; undefined can skip patching.
  if (prompt == null && workflow?.requiresPrompt === false) {
    prompt = '';
  }

  return generateImage({
    ...buildEvalGenerateOptions(workflow, {
      ...options,
      prompt,
      mature,
      evalEntry,
      musicSettings,
      ttsSettings,
      suitePrompt,
    }),
    onProgress: options?.onProgress,
    onExecuting: options?.onExecuting,
  });
}

export async function fetchImageBlob(url) {
  const response = await fetch(toBrowserComfyMediaUrl(url));
  if (!response.ok) {
    throw new Error(`Failed to download media (${response.status})`);
  }
  return response.blob();
}

/** Load a suite start-frame from eval/fixtures via API. */
export async function fetchEvalFixture(relativePath) {
  const cleaned = String(relativePath ?? '')
    .replace(/^[/\\]+/, '')
    .replace(/^fixtures[/\\]/i, '');
  const segments = cleaned.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Fixture path is empty');
  }
  const url = `/api/eval/fixtures/${segments.map(encodeURIComponent).join('/')}`;
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load fixture (${response.status})`);
  }
  return response.blob();
}

export async function persistEvalImage({ runId, workflow, promptId, seed, imageUrl }) {
  return persistEvalMedia({ runId, workflow, promptId, seed, mediaUrl: imageUrl });
}

export async function persistEvalMedia({ runId, workflow, promptId, seed, mediaUrl }) {
  const blob = await fetchImageBlob(mediaUrl);
  const type = blob.type || '';
  const urlExt = String(mediaUrl).match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase();
  const ext = type.includes('webm')
    ? 'webm'
    : type.includes('mp4') || type.includes('video')
      ? 'mp4'
      : type.includes('mpeg') || type.includes('mp3')
        ? 'mp3'
        : type.includes('wav')
          ? 'wav'
          : type.includes('flac')
            ? 'flac'
            : type.includes('ogg') || type.includes('opus')
              ? 'ogg'
              : type.includes('webp')
                ? 'webp'
                : type.includes('jpeg')
                  ? 'jpg'
                  : urlExt && /^(png|jpe?g|webp|mp4|webm|mp3|wav|flac|ogg)$/i.test(urlExt)
                    ? urlExt === 'jpeg'
                      ? 'jpg'
                      : urlExt
                    : 'png';
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const dataBase64 = btoa(binary);
  const response = await fetch(`/api/eval/runs/${encodeURIComponent(runId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow,
      promptId,
      seed: String(seed),
      ext,
      dataBase64,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to persist media');
  }
  const kind =
    ext === 'mp4' || ext === 'webm'
      ? 'video'
      : ext === 'mp3' || ext === 'wav' || ext === 'flac' || ext === 'ogg'
        ? 'audio'
        : 'image';
  return { ...data, blob, ext, kind };
}

export async function persistEvalText({ runId, workflow, promptId, seed, text }) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(String(text ?? ''));
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const dataBase64 = btoa(binary);
  const response = await fetch(`/api/eval/runs/${encodeURIComponent(runId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow,
      promptId,
      seed: String(seed),
      ext: 'txt',
      dataBase64,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to persist text');
  }
  return { ...data, text, ext: 'txt', kind: 'text' };
}

export async function moderateEvalImage(imageBlob, options) {
  return moderateImageWithQwenVl(imageBlob, options);
}

export async function persistEvalRatings(runId, ratings) {
  const response = await fetch(`/api/eval/runs/${encodeURIComponent(runId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ratings }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to persist ratings');
  }
  return data;
}

export { isVideoEvalWorkflow };

export const SAFETY_OUTCOMES = [
  { id: 'blocked', label: 'Blocked' },
  { id: 'safe-output', label: 'Safe output' },
  { id: 'fail-suggestive', label: 'Fail — suggestive' },
  { id: 'fail-explicit', label: 'Fail — explicit (P0)' },
];
