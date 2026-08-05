import { estimateTtsMaxNewTokens, prepareSpeakText, resolveSpeakPauseStyle } from '@/lib/audio-prompt';
import {
  getComfyProgressSseUrl,
  getComfyUrl,
  rewriteGenerateResultForBrowser,
} from '@/lib/comfy-config';
import { toKeySegment } from '@/lib/i18n/keys';
import { resolveRedrobTuneModel } from '@/lib/redrob-tune';
import { isVirtualImageNode } from '@/lib/workflows';

export { getComfyUrl, toBrowserComfyMediaUrl } from '@/lib/comfy-config';

const AUDIO_MISSING_NODE_MESSAGE =
  'Speech is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';

const LAYERED_MISSING_NODE_MESSAGE =
  'This image tool is not part of the local Studio install. Re-run scripts/setup-comfyui-local.sh if a required node is missing.';

const MULTICHANNEL_MISSING_NODE_MESSAGE =
  'This image tool is not fully set up locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.';

const TRANSCRIBE_MISSING_NODE_MESSAGE =
  'Speech-to-text is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';

const REDROB_TUNE_MISSING_NODE_MESSAGE =
  'Redrob Tune is not set up locally yet. Run scripts/setup-comfyui-local.sh (music profile) and restart ComfyUI.';

const VIDEO_LOAD_MISSING_NODE_MESSAGE =
  'Video upload is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';

const LTX_DIRECTOR_MISSING_NODE_MESSAGE =
  'Video generation is not included in the local Studio install. Use Video → Compress, or install only the nodes from scripts/setup-comfyui-local.sh.';

const QWENVL_MISSING_NODE_MESSAGE =
  'Vision is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';

function parseComfyNodeErrors(nodeErrors) {
  if (!nodeErrors || typeof nodeErrors !== 'object') {
    return null;
  }

  for (const entry of Object.values(nodeErrors)) {
    for (const err of entry?.errors ?? []) {
      if (err?.type !== 'value_not_in_list') {
        continue;
      }
      const details = String(err.details ?? '');
      const received = String(err.extra_info?.received_value ?? '');
      if (
        /ckpt_name|unet_name|lora_name|model_name|text_encoder|vae_name/i.test(details) ||
        /\.safetensors$/i.test(received)
      ) {
        return 'A required model weight is missing locally. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';
      }
    }
  }

  return null;
}

function parseComfyPromptErrorPayload(data) {
  const nodeError = parseComfyNodeErrors(data?.node_errors);
  if (nodeError) {
    return nodeError;
  }

  const err = data?.error;
  if (!err || typeof err !== 'object' || err.type !== 'missing_node_type') {
    return null;
  }

  const missingType = err.extra_info?.class_type ?? err.details ?? '';
  const title = err.extra_info?.node_title ?? 'A required step';
  if (/Qwen3ASR|ShowText/i.test(missingType)) {
    return TRANSCRIBE_MISSING_NODE_MESSAGE;
  }
  if (/FB_Qwen3TTS/i.test(missingType) || /Qwen3TTS/i.test(missingType)) {
    return AUDIO_MISSING_NODE_MESSAGE;
  }
  if (
    /AILab_QwenVL/i.test(missingType) ||
    /QwenVL/i.test(missingType) ||
    /Qwen2\.5-VL|Qwen3-VL|image.?to.?text/i.test(title)
  ) {
    return QWENVL_MISSING_NODE_MESSAGE;
  }
  if (/SaveAudioMP3/i.test(missingType)) {
    return 'Saving audio is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';
  }
  if (
    /TextEncodeAceStepAudio/i.test(missingType) ||
    /EmptyAceStep/i.test(missingType) ||
    /ReferenceTimbreAudio/i.test(missingType) ||
    /ACEModelLoader|ACEAudioEncode|AceStep/i.test(missingType) ||
    /^APG$/i.test(missingType) ||
    /ace.?step/i.test(title)
  ) {
    return REDROB_TUNE_MISSING_NODE_MESSAGE;
  }
  if (/VHS_LoadVideo/i.test(missingType)) {
    return VIDEO_LOAD_MISSING_NODE_MESSAGE;
  }
  if (/LTXDirector/i.test(missingType) || /ltx director/i.test(title)) {
    return LTX_DIRECTOR_MISSING_NODE_MESSAGE;
  }
  if (
    /LazyIndexSwitch/i.test(missingType) ||
    /^INTConstant$/i.test(missingType) ||
    /master image switch|multi-channel routing|akatz-loops/i.test(title)
  ) {
    return MULTICHANNEL_MISSING_NODE_MESSAGE;
  }
  if (
    /EmptyQwenImageLayeredLatentImage|ReferenceLatent|LatentCutToBatch/i.test(missingType) ||
    /layered latent/i.test(title)
  ) {
    return LAYERED_MISSING_NODE_MESSAGE;
  }
  return `${title} is not available in this local ComfyUI install. Run scripts/setup-comfyui-local.sh and restart ComfyUI.`;
}

function parseComfyPromptErrorBody(body) {
  if (!body || typeof body !== 'string') {
    return null;
  }
  try {
    const data = JSON.parse(body);
    const nodeError = parseComfyNodeErrors(data?.node_errors);
    if (nodeError) {
      return nodeError;
    }
    return parseComfyPromptErrorPayload(data);
  } catch {
    if (/missing_node_type/i.test(body) && /FB_Qwen3TTS|Qwen3TTS/i.test(body)) {
      return AUDIO_MISSING_NODE_MESSAGE;
    }
    if (/missing_node_type/i.test(body) && /AILab_QwenVL|Qwen2\.5-VL|QwenVL/i.test(body)) {
      return QWENVL_MISSING_NODE_MESSAGE;
    }
    return null;
  }
}

export function getSpeakMissingNodeMessage() {
  return AUDIO_MISSING_NODE_MESSAGE;
}

export function getAudioMissingNodeMessage(task = 'speak') {
  if (task === 'voice-clone') {
    return 'Voice cloning is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';
  }
  if (task === 'voice-design') {
    return 'Voice design is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.';
  }
  return AUDIO_MISSING_NODE_MESSAGE;
}

export function getLayeredMissingNodeMessage() {
  return LAYERED_MISSING_NODE_MESSAGE;
}

export function getMultichannelMissingNodeMessage() {
  return MULTICHANNEL_MISSING_NODE_MESSAGE;
}

export function getTranscribeMissingNodeMessage() {
  return TRANSCRIBE_MISSING_NODE_MESSAGE;
}

const TTS_SPEAKER_MAP = {
  Uncle_Fu: 'Uncle_fu',
  Ono_Anna: 'Ono_anna',
};

function resolveTtsSpeaker(speaker) {
  return TTS_SPEAKER_MAP[speaker] ?? speaker;
}

/** @deprecated Browser uses SSE; server opens the backend WebSocket in connectProgressWebSocket. */
export function getComfyWsUrl(clientId) {
  if (typeof window === 'undefined') {
    throw new Error('Use connectProgressWebSocket on the server');
  }
  return getComfyProgressSseUrl(clientId);
}

export function createClientId() {
  return crypto.randomUUID();
}

let _isGenerating = false;

export class GenerationInProgressError extends Error {
  constructor(message = 'A generation is already in progress. Please wait.') {
    super(message);
    this.name = 'GenerationInProgressError';
  }
}

export class GenerationStoppedError extends Error {
  constructor(message = 'Generation stopped') {
    super(message);
    this.name = 'GenerationStoppedError';
  }
}

export function isGenerating() {
  return _isGenerating;
}

export function acquireLock() {
  if (_isGenerating) {
    throw new GenerationInProgressError();
  }
  _isGenerating = true;
}

export function releaseLock() {
  _isGenerating = false;
}

export async function interruptPrompt(promptId) {
  const response = await fetch(`${getComfyUrl()}/interrupt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(promptId ? { prompt_id: promptId } : {}),
  });

  if (!response.ok) {
    throw new Error(`Interrupt failed (${response.status})`);
  }
}

export async function deleteQueueItems(promptIds) {
  const response = await fetch(`${getComfyUrl()}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete: promptIds }),
  });

  if (!response.ok) {
    throw new Error(`Queue delete failed (${response.status})`);
  }
}

export async function stopGeneration(promptId) {
  await Promise.allSettled([
    interruptPrompt(promptId),
    promptId ? deleteQueueItems([promptId]) : Promise.resolve(),
  ]);
}

/**
 * ComfyUI's POST /free only *sets flags* — the worker applies them after the
 * next prompt finishes (or after a very long idle timeout). With --highvram,
 * that means the previous checkpoint stays in VRAM through the next run unless
 * we kick an empty prompt so the unload actually happens before loading again.
 */
const FREE_DRAIN_WORKFLOW = {
  '1': {
    class_type: 'EmptyImage',
    inputs: {
      width: 8,
      height: 8,
      batch_size: 1,
      color: 0,
    },
  },
  '2': {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: '_vram_free',
      images: ['1', 0],
    },
  },
};

let freeMemoryInFlight = null;

export async function freeMemory() {
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/comfy/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'free' }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.warn(`freeMemory failed: ${body || response.status}`);
      }
    } catch (error) {
      console.warn('freeMemory failed:', error);
    }
    return;
  }

  if (freeMemoryInFlight) {
    return freeMemoryInFlight;
  }

  freeMemoryInFlight = (async () => {
    try {
      const response = await fetch(`${getComfyUrl()}/free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models: true, free_memory: true }),
      });
      if (!response.ok) {
        console.warn(`freeMemory failed: HTTP ${response.status}`);
        return;
      }

      const clientId = createClientId();
      const promptId = await queuePrompt(FREE_DRAIN_WORKFLOW, clientId);
      await waitForHistory(promptId, {
        requireOutput: false,
        timeoutMs: 120_000,
      });
      await waitForIdle(120_000);
    } catch (error) {
      console.warn('freeMemory failed:', error);
    }
  })();

  try {
    await freeMemoryInFlight;
  } finally {
    freeMemoryInFlight = null;
  }
}

export async function isComfyOnline(timeoutMs = 4000) {
  try {
    const response = await fetch(`${getComfyUrl()}/system_stats`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

let audioCapabilityCache = null;
let saveAudioMp3SchemaCache = null; // 'builtin' | 'legacy'

export function resetComfyCapabilityCache() {
  audioCapabilityCache = null;
  saveAudioMp3SchemaCache = null;
}

function wireTtsSaveNode(workflow, tts) {
  if (!tts?.saveNode || !workflow[tts.saveNode]?.inputs) {
    return;
  }

  const saveInputs = workflow[tts.saveNode].inputs;
  const audioLink = [tts.node, 0];
  const schema =
    saveAudioMp3SchemaCache ??
    (Object.prototype.hasOwnProperty.call(saveInputs, 'audio_data') &&
    !Object.prototype.hasOwnProperty.call(saveInputs, 'audio')
      ? 'legacy'
      : 'builtin');

  if (schema === 'legacy') {
    saveInputs.audio_data = audioLink;
    saveInputs.bitrate = saveInputs.bitrate ?? '320k';
    delete saveInputs.audio;
    delete saveInputs.quality;
    return;
  }

  saveInputs.audio = audioLink;
  saveInputs.quality = saveInputs.quality ?? '320k';
  delete saveInputs.audio_data;
  delete saveInputs.bitrate;
}

export async function getComfyAudioCapabilities(timeoutMs = 4000) {
  if (audioCapabilityCache !== null) {
    return audioCapabilityCache;
  }

  try {
    const [customVoiceResponse, voiceCloneResponse, voiceDesignResponse, saveResponse] =
      await Promise.all([
        fetch(`${getComfyUrl()}/object_info/FB_Qwen3TTSCustomVoice`, {
          signal: AbortSignal.timeout(timeoutMs),
        }),
        fetch(`${getComfyUrl()}/object_info/FB_Qwen3TTSVoiceClone`, {
          signal: AbortSignal.timeout(timeoutMs),
        }),
        fetch(`${getComfyUrl()}/object_info/FB_Qwen3TTSVoiceDesign`, {
          signal: AbortSignal.timeout(timeoutMs),
        }),
        fetch(`${getComfyUrl()}/object_info/SaveAudioMP3`, {
          signal: AbortSignal.timeout(timeoutMs),
        }),
      ]);

    if (saveResponse.ok) {
      const saveData = await saveResponse.json();
      const saveRequired = saveData?.SaveAudioMP3?.input?.required ?? {};
      saveAudioMp3SchemaCache = Object.prototype.hasOwnProperty.call(saveRequired, 'audio')
        ? 'builtin'
        : 'legacy';
    }

    audioCapabilityCache = {
      speak: customVoiceResponse.ok && saveResponse.ok,
      voiceClone: voiceCloneResponse.ok && saveResponse.ok,
      voiceDesign: voiceDesignResponse.ok && saveResponse.ok,
    };
    return audioCapabilityCache;
  } catch {
    audioCapabilityCache = {
      speak: false,
      voiceClone: false,
      voiceDesign: false,
    };
    return audioCapabilityCache;
  }
}

export async function isComfySpeakSupported(timeoutMs = 4000) {
  const capabilities = await getComfyAudioCapabilities(timeoutMs);
  return capabilities.speak;
}

export async function isComfyVoiceDesignSupported(timeoutMs = 4000) {
  const capabilities = await getComfyAudioCapabilities(timeoutMs);
  return capabilities.voiceDesign;
}

export async function waitForIdle(timeoutMs = 120_000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${getComfyUrl()}/queue`);
      const data = await response.json();
      const running = data?.queue_running?.length ?? 0;
      const pending = data?.queue_pending?.length ?? 0;
      if (running === 0 && pending === 0) {
        return true;
      }
    } catch {
      // ComfyUI may be restarting after an OOM crash
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('System is busy, try again in a moment');
}

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('overwrite', 'true');

  const response = await fetch(`${getComfyUrl()}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.name) {
    throw new Error('Upload response missing filename');
  }

  return data.name;
}

export function snapWanLength(frames) {
  const min = 5;
  const clamped = Math.max(min, Math.round(frames));
  return Math.round((clamped - 1) / 4) * 4 + 1;
}

export function secondsToWanLength(seconds, fps) {
  return snapWanLength(seconds * fps);
}

export function secondsToVideoLength(seconds, fps, engine = 'wan') {
  if (engine === 'ltx' || engine === 'director') {
    throw new Error('LTX/director video gen is not shipped in the OSS-safe cut');
  }
  return secondsToWanLength(seconds, fps);
}

export function wanLengthToSeconds(length, fps) {
  return Math.round((length / fps) * 100) / 100;
}

export function snapVideoDimension(value, { min, max, step }) {
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function commitVideoDimension(value, { min, max, step }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return snapVideoDimension(parsed, { min, max, step });
}

export function commitVideoSeconds(value, { secondsMin, secondsMax, secondsStep }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return secondsMin;
  }
  const clamped = Math.min(secondsMax, Math.max(secondsMin, parsed));
  return Math.round(clamped / secondsStep) * secondsStep;
}

export function readImageFileDimensions(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).then((bitmap) => {
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      return size;
    });
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}

export function readAudioFileDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const { duration } = audio;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read audio duration'));
    };
    audio.src = url;
  });
}

export function readVideoFileDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const { duration } = video;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read video duration'));
    };
    video.src = url;
  });
}

export function dimensionsFromAspectRatio(
  aspectRatio,
  { baseSize, step, min, max, sourceWidth, sourceHeight, squareSize },
) {
  const bounds = { min, max, step };

  if (aspectRatio === 'original') {
    if (sourceWidth && sourceHeight) {
      return {
        width: snapVideoDimension(sourceWidth, bounds),
        height: snapVideoDimension(sourceHeight, bounds),
      };
    }
    return {
      width: snapVideoDimension(baseSize, bounds),
      height: snapVideoDimension(baseSize, bounds),
    };
  }

  const [ratioWidth, ratioHeight] = aspectRatio.split(':').map(Number);
  if (!ratioWidth || !ratioHeight) {
    return {
      width: snapVideoDimension(baseSize, bounds),
      height: snapVideoDimension(baseSize, bounds),
    };
  }

  if (ratioWidth === ratioHeight && squareSize != null) {
    const size = snapVideoDimension(squareSize, bounds);
    return { width: size, height: size };
  }

  if (ratioWidth >= ratioHeight) {
    const width = snapVideoDimension(baseSize, bounds);
    const height = snapVideoDimension(Math.round((baseSize * ratioHeight) / ratioWidth), bounds);
    return { width, height };
  }

  const height = snapVideoDimension(baseSize, bounds);
  const width = snapVideoDimension(Math.round((baseSize * ratioWidth) / ratioHeight), bounds);
  return { width, height };
}

function normalizeUploadedFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return filename;
  }
  const normalized = filename.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filename;
}

function applyAudioFilenameToNode(workflow, nodeId, filename) {
  const node = workflow[nodeId];
  if (!node?.inputs || !filename) {
    return;
  }

  node.inputs.audio = normalizeUploadedFilename(filename);
}

function resolveAsrRepoId(modelSize, asr) {
  const sizes = asr?.modelSizes ?? [];
  const match = sizes.find((size) => size.id === modelSize);
  return match?.repoId ?? sizes[0]?.repoId ?? 'Qwen/Qwen3-ASR-0.6B';
}

function assertAsrWorkflow(workflow, asr) {
  if (!asr?.loadAudioNode) {
    return;
  }

  const loadNode = workflow[asr.loadAudioNode];
  if (!loadNode?.inputs?.audio) {
    throw new Error('Audio file is required for transcription');
  }

  const transcribeInputs = workflow[asr.transcribeNode]?.inputs;
  const audioLink = transcribeInputs?.audio;
  if (!Array.isArray(audioLink) || !workflow[audioLink[0]]) {
    throw new Error('Transcription workflow audio link is broken');
  }

  const outputInputs = workflow[asr.outputNode]?.inputs;
  const textLink = outputInputs?.text;
  if (!Array.isArray(textLink) || !workflow[textLink[0]]) {
    throw new Error('Transcription workflow output link is broken');
  }
}

export async function uploadAudio(file) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('overwrite', 'true');
  formData.append('type', 'input');

  const response = await fetch(`${getComfyUrl()}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Audio upload failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.name) {
    throw new Error('Upload response missing filename');
  }

  if (data.subfolder) {
    return `${data.subfolder}/${data.name}`.replace(/\/+/g, '/');
  }

  return data.name;
}

export async function uploadAudios(audioFiles) {
  const entries = Object.entries(audioFiles ?? {});
  const names = {};

  await Promise.all(
    entries.map(async ([nodeId, file]) => {
      names[nodeId] = await uploadAudio(file);
    }),
  );

  return names;
}

export async function uploadVideos(videoFiles) {
  const entries = Object.entries(videoFiles ?? {});
  const names = {};

  await Promise.all(
    entries.map(async ([nodeId, file]) => {
      names[nodeId] = await uploadImage(file);
    }),
  );

  return names;
}

export async function uploadImages(imageFiles) {
  const entries = Object.entries(imageFiles ?? {});
  const names = {};

  await Promise.all(
    entries.map(async ([nodeId, file]) => {
      names[nodeId] = await uploadImage(file);
    }),
  );

  return names;
}

function stripUnconfiguredLightningLora(workflow, lora) {
  if (lora) {
    return;
  }

  for (const [nodeId, node] of Object.entries(workflow)) {
    if (node?.class_type !== 'LoraLoaderModelOnly') {
      continue;
    }

    const loraName = node.inputs?.lora_name ?? '';
    if (loraName.includes('Lightning') || loraName.includes('lightning')) {
      delete workflow[nodeId];
    }
  }
}

function rewireClipFromLora(workflow, loraNodeId, sourceNodeId) {
  for (const node of Object.values(workflow)) {
    const clip = node?.inputs?.clip;
    if (Array.isArray(clip) && clip[0] === loraNodeId && clip[1] === 1) {
      node.inputs.clip = [sourceNodeId, 1];
    }
  }
}

function applyImageExportSaveNodes(workflow, exportConfig, settings) {
  if (!exportConfig?.saveNodes?.length) {
    return;
  }

  const format = settings?.format ?? exportConfig.defaultFormat ?? 'png';
  for (const save of exportConfig.saveNodes) {
    if (save.format !== format && workflow[save.node]) {
      delete workflow[save.node];
      continue;
    }

    if (save.format !== format || !workflow[save.node]?.inputs) {
      continue;
    }

    if (save.fileTypeField && save.fileType != null) {
      workflow[save.node].inputs[save.fileTypeField] = save.fileType;
    }
    if (save.qualityField && save.quality != null) {
      workflow[save.node].inputs[save.qualityField] = settings?.quality ?? save.quality;
    }
  }
}

export function buildWorkflow(
  baseWorkflow,
  {
    imageName,
    imageNames,
    imageInputs,
    audioNames,
    audioInputs,
    audioNode,
    videoNames,
    prompt,
    negativePrompt,
    promptRequire,
    imageNode,
    promptNode,
    promptField = 'text',
    negativePromptNode,
    negativePromptField = 'text',
    lora,
    loraEnabled = true,
    loraStrength,
    checkpoint,
    video,
    outputSize,
    supportedImageSlots,
    samplerNode,
    clipEncodeNodes,
    sampler,
    layered,
    layeredSettings,
    upscale,
    upscaleSettings,
    asr,
    asrSettings,
    vlm,
    vlmSettings,
    music,
    musicSettings,
    videoExtract,
    audioConvert,
    audioConvertSettings,
    imageConvert,
    imageConvertSettings,
    imageCompress,
    imageCompressSettings,
    videoCompress,
    videoCompressSettings,
    tts,
    ttsSettings,
    multichannel,
    seed = null,
  },
) {
  const workflow = structuredClone(baseWorkflow);

  if (checkpoint?.node && workflow[checkpoint.node]?.inputs) {
    const ckptName = checkpoint.name;
    if (ckptName && ckptName !== '.safetensors' && !ckptName.startsWith('.')) {
      const classType = workflow[checkpoint.node].class_type;
      const field =
        checkpoint.field ??
        (classType === 'CheckpointLoaderSimple' ? 'ckpt_name' : 'unet_name');
      workflow[checkpoint.node].inputs[field] = ckptName;
    } else if (ckptName) {
      throw new Error(`Invalid checkpoint name "${ckptName}"`);
    }
  }

  if (imageInputs?.length) {
    const promptInputs = promptNode ? workflow[promptNode]?.inputs : null;
    if (promptNode && !promptInputs) {
      throw new Error(`Workflow missing prompt node "${promptNode}"`);
    }

    for (const { node, slot } of imageInputs) {
      const name = imageNames?.[node];
      if (name && workflow[node]) {
        workflow[node].inputs.image = name;
      } else {
        delete workflow[node];
        if (promptInputs && slot) {
          delete promptInputs[slot];
        }
      }
    }

    // Multi-image LoadImage wiring only — Qwen edit encode paths are not shipped.
  } else if (imageNode && !isVirtualImageNode(imageNode)) {
    if (!workflow[imageNode]?.inputs) {
      throw new Error(`Workflow missing LoadImage node "${imageNode}"`);
    }
    if (imageName) {
      workflow[imageNode].inputs.image = imageName;
    }
  }

  if (audioInputs?.length) {
    for (const input of audioInputs) {
      const { node, label, required = false } = input;
      const name = audioNames?.[node];
      if (name && workflow[node]) {
        applyAudioFilenameToNode(workflow, node, name);
      } else if (required) {
        throw new Error(`${label ?? 'Audio'} is required`);
      } else if (workflow[node]) {
        delete workflow[node];
      }
    }
  } else if (audioNode) {
    if (!workflow[audioNode]?.inputs) {
      throw new Error(`Workflow missing LoadAudio node "${audioNode}"`);
    }
    if (audioNames?.[audioNode]) {
      applyAudioFilenameToNode(workflow, audioNode, audioNames[audioNode]);
    }
  }

  if (asr?.loadAudioNode && workflow[asr.loadAudioNode]?.inputs) {
    const name = audioNames?.[asr.loadAudioNode];
    if (name) {
      applyAudioFilenameToNode(workflow, asr.loadAudioNode, name);
    }
  }

  if (videoExtract?.loadNode && workflow[videoExtract.loadNode]?.inputs) {
    const videoName = videoNames?.[videoExtract.loadNode];
    if (videoName) {
      workflow[videoExtract.loadNode].inputs.video = videoName;
    }
  }

  // Generic video-input wiring: write each uploaded video filename into its
  // loader node's `video` field.
  if (videoNames) {
    for (const [nodeId, videoName] of Object.entries(videoNames)) {
      if (videoName && workflow[nodeId]?.inputs && 'video' in workflow[nodeId].inputs) {
        workflow[nodeId].inputs.video = normalizeUploadedFilename(videoName);
      }
    }
  }

  if (!promptNode || !workflow[promptNode]?.inputs) {
    // Promptless workflows (e.g. upscale).
  } else if (!(promptField in workflow[promptNode].inputs)) {
    throw new Error(`Workflow missing prompt node "${promptNode}" field "${promptField}"`);
  } else {
    let positive = prompt ?? '';
    if (promptRequire) {
      const token = String(promptRequire).trim();
      if (token) {
        const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (!re.test(positive)) {
          positive = positive.trim() ? `${positive.trim()}, ${token}` : token;
        }
      }
    }
    workflow[promptNode].inputs[promptField] = positive;
  }

  if (negativePromptNode) {
    if (!workflow[negativePromptNode]?.inputs) {
      throw new Error(`Workflow missing negative prompt node "${negativePromptNode}"`);
    }
    if (!(negativePromptField in workflow[negativePromptNode].inputs)) {
      throw new Error(
        `Workflow negative prompt node "${negativePromptNode}" missing field "${negativePromptField}"`,
      );
    }
    const trimmedNegative = (negativePrompt ?? '').trim();
    // Keep workflow JSON defaults when the UI field is empty.
    if (trimmedNegative) {
      workflow[negativePromptNode].inputs[negativePromptField] = trimmedNegative;
    }
  }

  if (lora) {
    const { node, consumerNode, sourceNode, name, strength = 1 } = lora;
    const useLora = loraEnabled !== false;
    const effectiveSource = sourceNode;
    const loraNode = workflow[node];
    const isFullLora = loraNode?.class_type === 'LoraLoader';
    const effectiveStrength = loraStrength ?? strength;

    if (useLora) {
      if (!loraNode?.inputs) {
        throw new Error(`Workflow missing LoRA node "${node}"`);
      }
      workflow[node].inputs.lora_name = name;
      workflow[node].inputs.strength_model = effectiveStrength;
      workflow[node].inputs.model = [effectiveSource, 0];
      if (isFullLora) {
        workflow[node].inputs.strength_clip = effectiveStrength;
        workflow[node].inputs.clip = [effectiveSource, 1];
      }
      workflow[consumerNode].inputs.model = [node, 0];
    } else {
      if (isFullLora) {
        rewireClipFromLora(workflow, node, effectiveSource);
      }
      delete workflow[node];
      workflow[consumerNode].inputs.model = [effectiveSource, 0];
    }
  }

  if (sampler?.node && workflow[sampler.node]?.inputs) {
    const useFast = lora && loraEnabled !== false && sampler.fast;
    const profile = useFast ? { ...sampler, ...sampler.fast } : sampler;
    if (profile.steps != null) {
      workflow[sampler.node].inputs.steps = profile.steps;
    }
    if (profile.cfg != null) {
      if ('guidance_scale' in workflow[sampler.node].inputs) {
        workflow[sampler.node].inputs.guidance_scale = profile.cfg;
      } else {
        workflow[sampler.node].inputs.cfg = profile.cfg;
      }
    }
    if (profile.sampler_name) {
      workflow[sampler.node].inputs.sampler_name = profile.sampler_name;
    }
    if (profile.scheduler) {
      workflow[sampler.node].inputs.scheduler = profile.scheduler;
    }
  }

  stripUnconfiguredLightningLora(workflow, lora);

  if (video) {
    const {
      engine = 'wan',
      wanNode,
      fpsNode,
      width,
      height,
      length,
      fps,
      loras,
      lightx2vEnabled,
      sampler,
    } = video;

    if (engine === 'ltx' || engine === 'director') {
      throw new Error('LTX/director video gen is not shipped in the OSS-safe cut');
    }

    if (!workflow[wanNode]?.inputs) {
      throw new Error(`Workflow missing video latent node "${wanNode}"`);
    }
    workflow[wanNode].inputs.width = width;
    workflow[wanNode].inputs.height = height;
    workflow[wanNode].inputs.length = length;
    if (!imageNode && 'start_image' in workflow[wanNode].inputs) {
      delete workflow[wanNode].inputs.start_image;
    }
    if (fpsNode) {
      if (!workflow[fpsNode]?.inputs) {
        throw new Error(`Workflow missing CreateVideo node "${fpsNode}"`);
      }
      workflow[fpsNode].inputs.fps = fps;
    }

    if (loras?.length && lightx2vEnabled === false) {
      for (const { node, consumerNode, sourceNode } of loras) {
        if (workflow[node]) {
          delete workflow[node];
          workflow[consumerNode].inputs.model = [sourceNode, 0];
        }
      }
    }

    if (sampler && sampler.type !== 'ltx' && sampler.type !== 'director') {
      const { highNoiseNode, lowNoiseNode, steps, splitStep, cfg } = sampler;
      for (const nodeId of [highNoiseNode, lowNoiseNode]) {
        if (!workflow[nodeId]?.inputs) {
          throw new Error(`Workflow missing sampler node "${nodeId}"`);
        }
      }
      workflow[highNoiseNode].inputs.steps = steps;
      workflow[highNoiseNode].inputs.cfg = cfg;
      workflow[highNoiseNode].inputs.end_at_step = splitStep;
      workflow[lowNoiseNode].inputs.steps = steps;
      workflow[lowNoiseNode].inputs.cfg = cfg;
      workflow[lowNoiseNode].inputs.start_at_step = splitStep;
    }
  }

  if (outputSize) {
    const { node, alsoNodes = [], width, height } = outputSize;
    const sizeNodes = [node, ...alsoNodes];
    for (const sizeNode of sizeNodes) {
      if (!workflow[sizeNode]?.inputs) {
        throw new Error(`Workflow missing output size node "${sizeNode}"`);
      }
      workflow[sizeNode].inputs.width = width;
      workflow[sizeNode].inputs.height = height;
    }
  }

  if (layered) {
    const { scaleNode, maxDimension, layersNode, samplerNode: layeredSamplerNode } = layered;
    const layers = layeredSettings?.layers ?? layered.defaultLayers ?? 4;

    if (scaleNode && maxDimension != null && workflow[scaleNode]?.inputs) {
      workflow[scaleNode].inputs.largest_size = maxDimension;
    }

    if (layersNode && workflow[layersNode]?.inputs) {
      workflow[layersNode].inputs.layers = layers;
    }

    if (layeredSamplerNode && workflow[layeredSamplerNode]?.inputs && layered.sampler) {
      const profile = layered.sampler;
      if (profile.steps != null) {
        workflow[layeredSamplerNode].inputs.steps = profile.steps;
      }
      if (profile.cfg != null) {
        workflow[layeredSamplerNode].inputs.cfg = profile.cfg;
      }
      if (profile.sampler_name) {
        workflow[layeredSamplerNode].inputs.sampler_name = profile.sampler_name;
      }
      if (profile.scheduler) {
        workflow[layeredSamplerNode].inputs.scheduler = profile.scheduler;
      }
    }
  }

  if (tts?.node && workflow[tts.node]?.inputs) {
    const ttsMode = tts.mode ?? 'customVoice';
    const ttsClassType = workflow[tts.node].class_type;

    if (ttsMode === 'voiceClone' || ttsClassType === 'FB_Qwen3TTSVoiceClone') {
      const pauseStyle =
        ttsSettings?.pauseStyle ?? resolveSpeakPauseStyle('');
      const speakText = prepareSpeakText(
        prompt ??
          workflow[tts.node].inputs.target_text ??
          workflow[tts.node].inputs[promptField] ??
          '',
        { style: pauseStyle },
      );

      workflow[tts.node].inputs.target_text = speakText;
      const refText = (ttsSettings?.refText ?? '').trim();
      workflow[tts.node].inputs.ref_text = refText;
      workflow[tts.node].inputs.x_vector_only = !refText;
      workflow[tts.node].inputs.language = ttsSettings?.language ?? tts.defaultLanguage ?? 'Auto';
      workflow[tts.node].inputs.model_choice = tts.modelChoice ?? '1.7B';
      workflow[tts.node].inputs.unload_model_after_generate = ttsSettings?.unloadModels ?? true;

      if ('max_new_tokens' in workflow[tts.node].inputs) {
        workflow[tts.node].inputs.max_new_tokens = estimateTtsMaxNewTokens(speakText);
      }

      if (ttsSettings?.seed != null) {
        workflow[tts.node].inputs.seed = ttsSettings.seed;
      } else {
        workflow[tts.node].inputs.seed = Math.floor(Math.random() * 1_000_000_000_000);
      }
    } else {
      const pauseStyle =
        ttsSettings?.pauseStyle ?? resolveSpeakPauseStyle(ttsSettings?.instruct ?? '');
      const speakText = prepareSpeakText(
        prompt ?? workflow[tts.node].inputs.text ?? workflow[tts.node].inputs[promptField] ?? '',
        { style: pauseStyle },
      );

      if (promptField in workflow[tts.node].inputs) {
        workflow[tts.node].inputs[promptField] = speakText;
      } else if ('text' in workflow[tts.node].inputs) {
        workflow[tts.node].inputs.text = speakText;
      }

      workflow[tts.node].inputs.language = ttsSettings?.language ?? tts.defaultLanguage ?? 'Auto';
      workflow[tts.node].inputs.unload_model_after_generate = ttsSettings?.unloadModels ?? true;

      if (ttsMode === 'voiceDesign' || ttsClassType === 'FB_Qwen3TTSVoiceDesign') {
        const instructField = tts.voiceInstructField ?? 'instruct';
        workflow[tts.node].inputs[instructField] = ttsSettings?.voiceInstruct ?? '';
        workflow[tts.node].inputs.model_choice = '1.7B';
      } else {
        workflow[tts.node].inputs.speaker = resolveTtsSpeaker(
          ttsSettings?.speaker ?? tts.defaultSpeaker ?? 'Ryan',
        );
        workflow[tts.node].inputs.model_choice = tts.modelChoice ?? '1.7B';
        workflow[tts.node].inputs.instruct = ttsSettings?.instruct ?? '';
      }

      if ('max_new_tokens' in workflow[tts.node].inputs) {
        workflow[tts.node].inputs.max_new_tokens = estimateTtsMaxNewTokens(speakText);
      }

      if (ttsSettings?.seed != null) {
        workflow[tts.node].inputs.seed = ttsSettings.seed;
      } else {
        workflow[tts.node].inputs.seed = Math.floor(Math.random() * 1_000_000_000_000);
      }
    }
  }

  if (tts?.saveNode && workflow[tts.saveNode]?.inputs) {
    wireTtsSaveNode(workflow, tts);
  }

  if (upscale?.scaleNode && workflow[upscale.scaleNode]?.inputs) {
    const factor = upscaleSettings?.scale ?? upscale.defaultScale ?? 2;
    const sourceWidth = upscaleSettings?.sourceWidth;
    const sourceHeight = upscaleSettings?.sourceHeight;

    if (sourceWidth > 0 && sourceHeight > 0) {
      workflow[upscale.scaleNode].inputs.width = Math.round(sourceWidth * factor);
      workflow[upscale.scaleNode].inputs.height = Math.round(sourceHeight * factor);
    }

    // Lanczos-only upscale — no face-restore / CodeFormer path in the OSS-safe cut.
    if (upscale.saveNode && upscale.scaleNode && workflow[upscale.saveNode]?.inputs) {
      workflow[upscale.saveNode].inputs.images = [upscale.scaleNode, 0];
    }
    if (upscale.faceRestoreNode) {
      delete workflow[upscale.faceRestoreNode];
    }
  }

  if (imageCompress?.scaleNode && workflow[imageCompress.scaleNode]?.inputs) {
    workflow[imageCompress.scaleNode].inputs.scale_by =
      imageCompressSettings?.scale ?? imageCompress.defaultScale ?? 1;
  }

  if (videoCompress?.scaleNode && workflow[videoCompress.scaleNode]?.inputs) {
    workflow[videoCompress.scaleNode].inputs.scale_by =
      videoCompressSettings?.scale ?? videoCompress.defaultScale ?? 1;
  }

  if (videoCompress?.combineNode && workflow[videoCompress.combineNode]?.inputs) {
    const formatKey =
      videoCompressSettings?.format ?? videoCompress.defaultFormat ?? 'mp4';
    const formatValue =
      videoCompress.formatMap?.[formatKey] ??
      (formatKey.startsWith('video/') ? formatKey : `video/${formatKey}`);
    const crf = videoCompressSettings?.crf ?? videoCompress.defaultCrf ?? 28;
    const combine = workflow[videoCompress.combineNode].inputs;
    combine.format = formatValue;
    if ('crf' in combine || crf != null) {
      combine.crf = crf;
    }
    if ('save_metadata' in combine) {
      combine.save_metadata = false;
    }
  }

  if (asr?.loaderNode && workflow[asr.loaderNode]?.inputs) {
    workflow[asr.loaderNode].inputs.repo_id = resolveAsrRepoId(
      asrSettings?.modelSize ?? asr.defaultModelSize,
      asr,
    );
    workflow[asr.loaderNode].inputs.precision =
      asrSettings?.precision ?? asr.defaultPrecision ?? 'bf16';
  }

  if (asr?.transcribeNode && workflow[asr.transcribeNode]?.inputs) {
    workflow[asr.transcribeNode].inputs.language =
      asrSettings?.language ?? asr.defaultLanguage ?? 'auto';
  }

  if (vlm?.inferNode && workflow[vlm.inferNode]?.inputs) {
    const inferInputs = workflow[vlm.inferNode].inputs;
    const isPromptEnhancer =
      workflow[vlm.inferNode]?.class_type === 'AILab_QwenVL_PromptEnhancer';
    if (vlm.model) {
      inferInputs.model_name = vlm.model;
    }
    const selectedMode = (vlm.modes ?? []).find(
      (mode) => mode.id === (vlmSettings?.mode ?? vlm.defaultMode),
    );
    const instruction = (vlmSettings?.instruction ?? selectedMode?.instruction ?? '').trim();

    if (isPromptEnhancer) {
      const userText = (inferInputs.prompt_text ?? '').trim();
      if (vlm.promptRole === 'content') {
        inferInputs.prompt_text = userText;
        if (instruction) {
          inferInputs.custom_system_prompt = instruction;
        }
      } else if (!userText && instruction) {
        inferInputs.custom_system_prompt = instruction;
      }
    } else {
      // AILab_QwenVL: prompt node already wrote the user's text into custom_prompt.
      // Legacy placeholder "." (from requiresPrompt:false) must not block analysis modes.
      const rawUserText = (inferInputs.custom_prompt ?? '').trim();
      const userText = rawUserText === '.' ? '' : rawUserText;
      if (vlm.promptRole === 'content') {
        inferInputs.custom_prompt = userText
          ? instruction
            ? `${instruction}\n\n${userText}`
            : userText
          : instruction;
      } else if (!userText) {
        if (selectedMode?.instruction) {
          inferInputs.custom_prompt = selectedMode.instruction;
        } else if (selectedMode?.preset) {
          inferInputs.custom_prompt = '';
          inferInputs.preset_prompt = selectedMode.preset;
        }
      } else {
        inferInputs.custom_prompt = userText;
      }
    }
  }

  if (music?.engine === 'redrob-tune') {
    const seconds = musicSettings?.seconds ?? music.defaultSeconds ?? 60;
    const resolvedSeed =
      seed != null && Number.isFinite(Number(seed))
        ? Number(seed)
        : Math.floor(Math.random() * 1_000_000_000_000);
    const model = resolveRedrobTuneModel(
      musicSettings?.modelVersion ?? music.defaultModelVersion ?? 'redrob-tune-fast',
    );
    const hasRef = Boolean(
      music.refAudioNode && audioNames?.[music.refAudioNode] && workflow[music.refAudioNode],
    );
    const refTrimSeconds = Number(music.refTrimSeconds ?? 30);

    if (music.unetNode && workflow[music.unetNode]?.inputs) {
      workflow[music.unetNode].inputs.unet_name = model.unetName;
    }

    if (music.samplingNode && workflow[music.samplingNode]?.inputs) {
      workflow[music.samplingNode].inputs.shift = Number(
        musicSettings?.auraShift ?? model.auraShift ?? 3.0,
      );
    }

    // Pro: APG + ~CFG 1 (ComfyUI #12322 — native KSampler CFG compresses audio).
    // Fast: skip APG, plain AuraFlow → KSampler CFG 1.
    const useApg = Boolean(model.useApg && music.apgNode);
    if (useApg) {
      if (!workflow[music.apgNode]) {
        workflow[music.apgNode] = {
          class_type: 'APG',
          inputs: {},
          _meta: { title: 'APG (Pro guidance)' },
        };
      }
      const apg = workflow[music.apgNode].inputs;
      apg.model = [String(music.samplingNode), 0];
      apg.eta = Number(musicSettings?.apgEta ?? model.apgEta ?? 1.0);
      apg.norm_threshold = Number(
        musicSettings?.apgNormThreshold ?? model.apgNormThreshold ?? 7,
      );
      apg.momentum = Number(musicSettings?.apgMomentum ?? model.apgMomentum ?? 0);
    } else if (music.apgNode) {
      delete workflow[music.apgNode];
    }

    if (music.encodeNode && workflow[music.encodeNode]?.inputs) {
      const encode = workflow[music.encodeNode].inputs;
      if (prompt != null) {
        encode.tags = String(prompt);
      }
      encode.lyrics = musicSettings?.lyrics ?? '';
      encode.seed = resolvedSeed;
      encode.bpm = Number(musicSettings?.bpm ?? music.defaultBpm ?? 120);
      encode.duration = seconds;
      encode.timesignature = String(
        musicSettings?.timeSignature ?? music.defaultTimeSignature ?? '4',
      );
      encode.language = musicSettings?.language ?? music.defaultLanguage ?? 'en';
      encode.keyscale = musicSettings?.keyScale ?? music.defaultKeyScale ?? 'E minor';
      // Always use CoT audio codes (LM structure planning).
      encode.generate_audio_codes = true;
      encode.cfg_scale = Number(musicSettings?.lmCfg ?? music.defaultLmCfg ?? 2);
      encode.temperature = Number(
        musicSettings?.temperature ?? music.defaultTemperature ?? 0.85,
      );
      // Pro uses top_p=1.0; Fast uses 0.9.
      encode.top_p = Number(musicSettings?.topP ?? model.topP ?? music.defaultTopP ?? 0.9);
      encode.top_k = Number(musicSettings?.topK ?? 0);
      encode.min_p = Number(musicSettings?.minP ?? 0);
    }

    if (music.latentNode && workflow[music.latentNode]?.inputs) {
      workflow[music.latentNode].inputs.seconds = seconds;
    }

    if (hasRef) {
      // Timbre path only: trim → encode → ReferenceTimbreAudio on conditioning.
      // Do NOT use the encoded ref as KSampler latent (partial denoise mutes new lyrics).
      if (music.refTrimNode && workflow[music.refTrimNode]?.inputs) {
        workflow[music.refTrimNode].inputs.start_index = 0;
        workflow[music.refTrimNode].inputs.duration = refTrimSeconds;
        if (music.refAudioNode) {
          workflow[music.refTrimNode].inputs.audio = [String(music.refAudioNode), 0];
        }
      }
      if (music.refEncodeNode && workflow[music.refEncodeNode]?.inputs && music.refTrimNode) {
        workflow[music.refEncodeNode].inputs.audio = [String(music.refTrimNode), 0];
      }
    } else {
      for (const nodeId of [
        music.refAudioNode,
        music.refTrimNode,
        music.refEncodeNode,
        music.refTimbreNode,
      ]) {
        if (nodeId) {
          delete workflow[nodeId];
        }
      }
    }

    if (music.samplerNode && workflow[music.samplerNode]?.inputs) {
      const sampler = workflow[music.samplerNode].inputs;
      sampler.seed = resolvedSeed;
      sampler.steps = Number(musicSettings?.steps ?? model.steps);
      // 1.05 (not exactly 1.0) so Comfy still computes uncond and APG can run.
      sampler.cfg = Number(musicSettings?.cfg ?? model.samplerCfg ?? (useApg ? 1.05 : 1));
      sampler.sampler_name = musicSettings?.samplerName ?? 'euler';
      sampler.scheduler = musicSettings?.scheduler ?? 'simple';
      sampler.denoise = 1;
      sampler.model = useApg
        ? [String(music.apgNode), 0]
        : [String(music.samplingNode ?? music.unetNode), 0];
      sampler.latent_image = [String(music.latentNode), 0];

      if (hasRef && music.refTimbreNode && workflow[music.refTimbreNode]) {
        sampler.positive = [String(music.refTimbreNode), 0];
      } else {
        sampler.positive = [String(music.encodeNode), 0];
      }
    }

    // Save as redrob-tune-{variant} (e.g. redrob-tune-fast_00001_.mp3).
    if (music.saveNode && workflow[music.saveNode]?.inputs) {
      const save = workflow[music.saveNode];
      save.inputs.filename_prefix = model.id;
      if (save.class_type === 'SaveAudioMP3') {
        save.inputs.quality = musicSettings?.saveQuality ?? 'V0';
      }
    }
  }

  if (multichannel) {
    const { channelSelectorNode, channelSelectorField = 'value', channel } = multichannel;
    if (!workflow[channelSelectorNode]?.inputs) {
      throw new Error(`Workflow missing channel selector node "${channelSelectorNode}"`);
    }
    workflow[channelSelectorNode].inputs[channelSelectorField] = channel - 1;
  }

  if (audioConvert?.saveNodes?.length) {
    const format = audioConvertSettings?.format ?? audioConvert.defaultFormat ?? 'mp3';
    for (const save of audioConvert.saveNodes) {
      if (save.format !== format && workflow[save.node]) {
        delete workflow[save.node];
      } else if (save.format === format && workflow[save.node]) {
        if (save.qualityField && save.quality != null) {
          workflow[save.node].inputs[save.qualityField] = save.quality;
        }
        if (save.formatField && save.fileFormat != null) {
          workflow[save.node].inputs[save.formatField] = save.fileFormat;
        }
      }
    }
  }

  if (imageConvert?.saveNodes?.length) {
    applyImageExportSaveNodes(workflow, imageConvert, imageConvertSettings);
  }

  if (imageCompress?.saveNodes?.length) {
    applyImageExportSaveNodes(workflow, imageCompress, imageConvertSettings);
  }

  if (asr) {
    assertAsrWorkflow(workflow, asr);
  }

  // Image create / edit workflows ship fixed seeds; randomize unless a seed is provided (eval).
  const resolvedSeed =
    seed != null && Number.isFinite(Number(seed))
      ? Number(seed)
      : Math.floor(Math.random() * 1_000_000_000_000);
  for (const node of Object.values(workflow)) {
    if (!node?.inputs) continue;
    if (
      (        node.class_type === 'KSampler' ||
        node.class_type === 'KSamplerAdvanced') &&
      'seed' in node.inputs
    ) {
      node.inputs.seed = resolvedSeed;
    } else if (node.class_type === 'RandomNoise' && 'noise_seed' in node.inputs) {
      node.inputs.noise_seed = resolvedSeed;
    }
  }

  return workflow;
}

/** Shared / image defaults. Music overrides apply only when the workflow is Tune. */
const EXECUTING_PHASE_LABELS = {
  CheckpointLoaderSimple: 'Loading model…',
  UNETLoader: 'Loading diffusion model…',
  CLIPLoader: 'Loading text encoder…',
  DualCLIPLoader: 'Loading text encoders…',
  VAELoader: 'Loading VAE…',
  LoraLoaderModelOnly: 'Preparing model…',
  LoraLoader: 'Preparing model…',
  KSampler: 'Sampling…',
  KSamplerAdvanced: 'Sampling…',
  SamplerCustomAdvanced: 'Sampling…',
  DualModelGuider: 'Guiding…',
  CFGOverride: 'Preparing model…',
  VAEDecode: 'Decoding image…',
  CLIPTextEncode: 'Encoding prompt…',
  ReferenceLatent: 'Preparing reference…',
  ConditioningZeroOut: 'Preparing conditioning…',
  EmptySD3LatentImage: 'Creating latent…',
  EmptyFlux2LatentImage: 'Creating latent…',
  ModelSamplingAuraFlow: 'Preparing model…',
  CFGGuider: 'Preparing sampler…',
  Flux2Scheduler: 'Preparing scheduler…',
  FluxKontextImageScale: 'Preparing image…',
  ImageScaleToTotalPixels: 'Scaling image…',
  ImageScaleToMaxDimension: 'Scaling image…',
  ImageScale: 'Resizing…',
  ImageScaleBy: 'Resizing image…',
  GetImageSize: 'Reading image size…',
  EmptyQwenImageLayeredLatentImage: 'Preparing layers…',
  LatentCutToBatch: 'Preparing layers…',
  CFGNorm: 'Preparing model…',
  UnetLoaderGGUF: 'Loading diffusion model…',
  WanImageToVideo: 'Preparing video…',
  ModelSamplingSD3: 'Preparing model…',
  CreateVideo: 'Creating video…',
  SaveVideo: 'Saving video…',
  FB_Qwen3TTSCustomVoice: 'Generating speech…',
  FB_Qwen3TTSVoiceClone: 'Cloning voice…',
  FB_Qwen3TTSVoiceDesign: 'Designing voice…',
  AILab_QwenVL: 'Reading image…',
  AILab_QwenVL_PromptEnhancer: 'Enhancing prompt…',
  ImageBlur: 'Blurring image…',
  Qwen3ASRLoader: 'Loading speech model…',
  Qwen3ASRTranscribe: 'Transcribing…',
  ShowText: 'Saving transcription…',
  'TextEncodeAceStepAudio1.5': 'Planning with Tune…',
  'EmptyAceStep1.5LatentAudio': 'Preparing audio…',
  ReferenceTimbreAudio: 'Applying reference timbre…',
  TrimAudioDuration: 'Trimming reference…',
  VAEEncodeAudio: 'Encoding reference audio…',
  VAEDecodeAudio: 'Decoding audio…',
  APG: 'Tuning guidance…',
  SaveAudio: 'Saving audio…',
  SaveAudioMP3: 'Saving audio…',
  SaveAudioOpus: 'Saving audio…',
  EmptyLatentAudio: 'Preparing audio…',
  LoadAudio: 'Loading reference audio…',
  WanVideoSampler: 'Generating video…',
  WanVideoImageToVideoMultiTalk: 'Preparing lip sync…',
  MultiTalkWav2VecEmbeds: 'Analyzing speech…',
  TextGenerateLTX2Prompt: 'Enhancing prompt…',
  LTXVAudioVAEEncode: 'Analyzing speech…',
  LTXVLatentUpsampler: 'Upscaling video…',
  VAEDecodeTiled: 'Decoding video…',
  VHS_VideoCombine: 'Saving video…',
  VHS_LoadVideo: 'Loading video…',
  VHS_VideoInfo: 'Reading video…',
  SaveWEBP: 'Saving image…',
  SaveImagePlus: 'Saving image…',
  SaveImage: 'Saving image…',
};

/** Labels for shared nodes when the active workflow is Redrob Tune / ACE. */
const TUNE_PHASE_LABEL_OVERRIDES = {
  UNETLoader: 'Loading Tune…',
  DualCLIPLoader: 'Loading Tune text encoders…',
  KSampler: 'Composing with Tune…',
  ModelSamplingAuraFlow: 'Configuring sampler…',
  VAEDecode: 'Decoding audio…',
};

function isTuneWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    return false;
  }
  for (const node of Object.values(workflow)) {
    const type = node?.class_type;
    if (!type) continue;
    if (
      type.includes('AceStep') ||
      type === 'VAEDecodeAudio' ||
      type === 'VAEEncodeAudio' ||
      type === 'EmptyLatentAudio' ||
      type === 'SaveAudio' ||
      type === 'SaveAudioMP3' ||
      type === 'SaveAudioOpus' ||
      type === 'ReferenceTimbreAudio'
    ) {
      return true;
    }
  }
  return false;
}

const USER_ERROR_TECH_PATTERNS = [
  /\bComfyUI\b/gi,
  /\bReActor\w*/gi,
  /\bHyperSwap\b/gi,
  /\bCodeFormer\b/gi,
  // Include `.` so names like Qwen2.5-VL strip fully (otherwise leftovers like ".5-VL").
  /\bQwen[\w.-]*/gi,
  /\bACE-?Step[\w.-]*/gi,
  /\bLTX[\w-]*/gi,
  /\bRMBG[\w-]*/gi,
  /\bLoRA\b/gi,
  /\bUltraSharp\b/gi,
  /\bretinaface[\w_.]*/gi,
  /\bhyperswap[\w_.]*/gi,
  /\bEmptyQwenImageLayeredLatentImage\b/gi,
  /\buserdata\.sh\b/gi,
  /\btransformers\b/gi,
  /\bONNX\b/gi,
];

function sanitizeUserErrorText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let message = text.trim();
  for (const pattern of USER_ERROR_TECH_PATTERNS) {
    message = message.replace(pattern, '');
  }

  return message.replace(/\s{2,}/g, ' ').replace(/^:\s*/, '').trim();
}

function getGpuOutOfMemoryMessage(rawMessage, nodeType = null) {
  if (!/allocation on device|out of memory|cuda error/i.test(rawMessage)) {
    return null;
  }

  if (nodeType === 'FB_Qwen3TTSCustomVoice' || nodeType === 'FB_Qwen3TTSVoiceClone' || nodeType === 'FB_Qwen3TTSVoiceDesign') {
    return 'GPU memory ran out while generating speech. Wait a few seconds and try again — especially if you used image or video tools earlier. A shorter script can also help.';
  }

  return 'GPU memory ran out. Wait a moment and try again.';
}

function getQwenTtsImportErrorMessage(rawMessage) {
  if (
    /qwen_tts.*failed to import/i.test(rawMessage) ||
    /Model class is not loaded because/i.test(rawMessage) ||
    /Critical Import Error/i.test(rawMessage)
  ) {
    return 'Speech failed to load locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.';
  }
  if (/check_model_inputs/i.test(rawMessage)) {
    return 'Speech needs a dependency fix locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.';
  }
  if (/Numba needs NumPy/i.test(rawMessage)) {
    return 'Speech needs a dependency fix locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.';
  }
  return null;
}

export function formatUserFacingError(rawMessage, nodeType = null) {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'Something went wrong. Please try again.';
  }

  const ttsImportMessage = getQwenTtsImportErrorMessage(rawMessage);
  if (ttsImportMessage) {
    return ttsImportMessage;
  }

  if (
    rawMessage === REDROB_TUNE_MISSING_NODE_MESSAGE ||
    /ACE-?Step/i.test(rawMessage) ||
    /^Music generation is not available/i.test(rawMessage) ||
    /^Redrob Tune is not available/i.test(rawMessage)
  ) {
    return REDROB_TUNE_MISSING_NODE_MESSAGE;
  }

  if (
    rawMessage === MULTICHANNEL_MISSING_NODE_MESSAGE ||
    /^Multi-channel routing is not available/i.test(rawMessage) ||
    /Master Image Switch \(lazy\)/i.test(rawMessage)
  ) {
    return MULTICHANNEL_MISSING_NODE_MESSAGE;
  }

  if (
    rawMessage === AUDIO_MISSING_NODE_MESSAGE ||
    /^Speech tools are not available/i.test(rawMessage) ||
    /^Speech is not available/i.test(rawMessage) ||
    /^Redrob Voice(?:\s·\s(?:Speak|Clone|Design))? is not available/i.test(rawMessage) ||
    /^Voice (?:cloning|design) is not available/i.test(rawMessage)
  ) {
    return AUDIO_MISSING_NODE_MESSAGE;
  }

  if (
    rawMessage === QWENVL_MISSING_NODE_MESSAGE ||
    /^Vision is not available/i.test(rawMessage) ||
    /^Image-to-text is not available/i.test(rawMessage) ||
    /\.5-VL is not available/i.test(rawMessage) ||
    /Qwen2\.5-VL is not available/i.test(rawMessage) ||
    /AILab_QwenVL/i.test(rawMessage)
  ) {
    return QWENVL_MISSING_NODE_MESSAGE;
  }

  if (
    rawMessage === LAYERED_MISSING_NODE_MESSAGE ||
    /EmptyQwenImageLayeredLatentImage|outdated nodes_qwen|layered latent/i.test(rawMessage)
  ) {
    return LAYERED_MISSING_NODE_MESSAGE;
  }

  const oomMessage = getGpuOutOfMemoryMessage(rawMessage, nodeType);
  if (oomMessage) {
    return oomMessage;
  }

  if (/comfyui workflow execution failed/i.test(rawMessage)) {
    return 'Generation failed. Please try again.';
  }

  const colonMatch = rawMessage.match(/^([^:]+):\s*([\s\S]+)$/);
  let node = nodeType;
  let detail = rawMessage;

  if (colonMatch) {
    const possibleNode = colonMatch[1].trim();
    if (EXECUTING_PHASE_LABELS[possibleNode] || /^[A-Z][A-Za-z0-9]+$/.test(possibleNode)) {
      node = possibleNode;
      detail = colonMatch[2];
    }
  }

  const phaseLabel = node ? EXECUTING_PHASE_LABELS[node] : null;
  const sanitized = sanitizeUserErrorText(detail);

  if (phaseLabel) {
    const step = phaseLabel.replace(/…$/, '').toLowerCase();
    const phaseOomMessage = getGpuOutOfMemoryMessage(detail, node);
    if (phaseOomMessage) {
      return phaseOomMessage;
    }
    if (sanitized && sanitized.length > 3 && !/^execution failed$/i.test(sanitized)) {
      return `Error while ${step}: ${sanitized}`;
    }
    return `Error while ${step}. Please try again.`;
  }

  const cleaned = sanitizeUserErrorText(rawMessage);
  if (cleaned && cleaned.length > 3) {
    return cleaned;
  }

  return 'Something went wrong. Please try again.';
}

export function getExecutingPhaseLabel(nodeId, workflow) {
  if (nodeId === null) {
    return null;
  }
  const node = workflow[nodeId];
  if (!node) {
    return 'Running…';
  }
  const classType = node.class_type;
  if (isTuneWorkflow(workflow) && TUNE_PHASE_LABEL_OVERRIDES[classType]) {
    return TUNE_PHASE_LABEL_OVERRIDES[classType];
  }
  return (
    EXECUTING_PHASE_LABELS[classType] ??
    `Running ${node._meta?.title ?? classType}…`
  );
}

/**
 * `phase.*` message key for the node the server is executing, or null when the
 * label is derived from the node title and has no translation.
 */
export function getExecutingPhaseKey(nodeId, workflow) {
  if (nodeId === null) {
    return null;
  }
  const node = workflow?.[nodeId];
  if (!node) {
    return 'running';
  }
  const classType = node.class_type;
  if (isTuneWorkflow(workflow) && TUNE_PHASE_LABEL_OVERRIDES[classType]) {
    return `tune.${toKeySegment(classType)}`;
  }
  return EXECUTING_PHASE_LABELS[classType] ? toKeySegment(classType) : null;
}

/** Fewer steps / smaller latents so preload mainly pays the model-load cost. */
export function warmupWorkflow(workflow) {
  const copy = structuredClone(workflow);

  for (const node of Object.values(copy)) {
    if (!node?.inputs) {
      continue;
    }

    const { class_type: classType, inputs } = node;

    if (typeof inputs.steps === 'number') {
      inputs.steps = 1;
    }

    if (classType === 'EmptySD3LatentImage' || classType === 'EmptyFlux2LatentImage' || classType === 'EmptyLatentImage') {
      if (typeof inputs.width === 'number') {
        inputs.width = 512;
      }
      if (typeof inputs.height === 'number') {
        inputs.height = 512;
      }
    }

    if (classType === 'PrimitiveInt') {
      const title = node._meta?.title ?? '';
      if (title === 'Width' || title === 'Height') {
        inputs.value = 512;
      }
      if (title === 'Steps' || title === 'Stpes') {
        inputs.value = 1;
      }
    }

    if (classType === 'PrimitiveFloat' && node._meta?.title === 'CFG') {
      inputs.value = 1;
    }
  }

  return copy;
}

export function getVideoHistoryTimeoutMs({ length, fps }) {
  if (!length || !fps) {
    return 600_000;
  }
  const seconds = length / fps;
  return Math.max(600_000, Math.ceil(seconds * 120_000));
}

async function runComfyWorkflow({
  workflow,
  onProgress,
  onExecuting,
  signal,
  requireOutput = true,
  outputType = 'image',
  unloadAfter = false,
  freeBeforeRun = false,
  historyTimeoutMs = 600_000,
  textOutputNodeId = null,
  clientId: providedClientId = null,
}) {
  acquireLock();

  const clientId = providedClientId || createClientId();
  const stopController = new AbortController();
  let disconnect = () => {};
  let executionFinished = false;
  let promptId = null;

  const abortIfRequested = () => {
    if (stopController.signal.aborted) {
      throw new GenerationStoppedError();
    }
  };

  const requestStop = () => {
    if (stopController.signal.aborted) {
      return;
    }
    stopController.abort();
    stopGeneration(promptId).catch(() => {});
  };

  signal?.addEventListener('abort', requestStop);

  const executionFinishedPromise = new Promise((resolve, reject) => {
    disconnect = connectProgressWebSocket(clientId, {
      onProgress: (value, max) => onProgress?.({ value, max }),
      onExecuting: (nodeId) => onExecuting?.(nodeId),
      onExecutionFinished: () => {
        executionFinished = true;
        resolve();
      },
      onInterrupted: (interruptedPromptId) => {
        if (!promptId || interruptedPromptId === promptId) {
          requestStop();
          reject(new GenerationStoppedError());
        }
      },
      onError: (error) => {
        onProgress?.({ error });
        reject(error);
      },
    });
  });

  try {
    abortIfRequested();

    if (freeBeforeRun) {
      await freeMemory();
    }

    // Default wait is 120s — large UNET unload/reload can exceed a short timeout.
    await waitForIdle();
    abortIfRequested();

    promptId = await queuePrompt(workflow, clientId);
    abortIfRequested();

    const historyPromise = waitForHistory(promptId, {
      signal: stopController.signal,
      timeoutMs: historyTimeoutMs,
      requireOutput,
      outputType,
    });

    try {
      await Promise.race([
        executionFinishedPromise,
        historyPromise.then(() => {
          executionFinished = true;
        }),
      ]);
    } catch (error) {
      if (error instanceof GenerationStoppedError) {
        throw error;
      }
      throw error;
    }

    abortIfRequested();

    const history = await historyPromise;

    const executionError = getHistoryExecutionError(history);
    if (executionError) {
      throw new Error(executionError);
    }

    if (outputType === 'video') {
      const videos = extractOutputVideos(history);
      if (requireOutput && videos.length === 0) {
        throw new Error('No output videos found in workflow history');
      }
      const video = videos[videos.length - 1];
      return {
        promptId,
        outputType: 'video',
        video,
        image: video,
        url: video
          ? getImageViewUrl({
              filename: video.filename,
              subfolder: video.subfolder ?? '',
              type: video.type ?? 'output',
            })
          : null,
      };
    }

    if (outputType === 'audio') {
      const audios = extractOutputAudio(history);
      if (requireOutput && audios.length === 0) {
        throw new Error('No output audio found in workflow history');
      }
      const audio = audios[audios.length - 1];
      return {
        promptId,
        outputType: 'audio',
        audio,
        image: audio,
        url: audio
          ? getImageViewUrl({
              filename: audio.filename,
              subfolder: audio.subfolder ?? '',
              type: audio.type ?? 'output',
            })
          : null,
      };
    }

    if (outputType === 'text') {
      let text = extractOutputText(history, textOutputNodeId);
      if (!text) {
        const textFile = extractOutputTextFile(history, textOutputNodeId);
        if (textFile) {
          text = await fetchOutputTextFile(textFile);
        }
      }
      if (requireOutput && !text?.trim()) {
        throw new Error('No text output found in workflow history');
      }
      return {
        promptId,
        outputType: 'text',
        text: text?.trim() ?? '',
        url: null,
      };
    }

    const images = extractOutputImages(history);

    if (requireOutput && images.length === 0) {
      throw new Error('No output images found in workflow history');
    }

    const imagesWithUrls = images.map((image) => ({
      ...image,
      url: getImageViewUrl({
        filename: image.filename,
        subfolder: image.subfolder ?? '',
        type: image.type ?? 'output',
      }),
    }));

    const image = imagesWithUrls[imagesWithUrls.length - 1] ?? null;
    return {
      promptId,
      outputType: 'image',
      images: imagesWithUrls,
      image,
      url: image?.url ?? null,
    };
  } catch (error) {
    if (stopController.signal.aborted) {
      throw new GenerationStoppedError();
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', requestStop);
    if (!executionFinished) {
      disconnect();
    } else {
      setTimeout(disconnect, 250);
    }
    if (unloadAfter) {
      await freeMemory();
    }
    releaseLock();
  }
}

export async function preloadModel(options) {
  if (typeof window !== 'undefined') {
    if (!options?.workflowId) {
      throw new Error('workflowId is required for preload');
    }
    const response = await fetch('/api/comfy/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'preload',
        workflowId: options.workflowId,
        // Pass non-graph settings only; server loads the template.
        requiresImage: options.requiresImage,
        requiresAudio: options.requiresAudio,
        requiresVideo: options.requiresVideo,
        imageNode: options.imageNode,
        imageInputs: options.imageInputs,
        audioNode: options.audioNode,
        audioInputs: options.audioInputs,
        videoInputs: options.videoInputs,
        promptNode: options.promptNode,
        promptField: options.promptField,
        negativePromptNode: options.negativePromptNode,
        negativePromptField: options.negativePromptField,
        lora: options.lora,
        loraEnabled: options.loraEnabled,
        loraStrength: options.loraStrength,
        checkpoint: options.checkpoint,
        video: options.video,
        outputSize: options.outputSize,
        supportedImageSlots: options.supportedImageSlots,
        samplerNode: options.samplerNode,
        clipEncodeNodes: options.clipEncodeNodes,
        sampler: options.sampler,
        upscale: options.upscale,
        upscaleSettings: options.upscaleSettings,
        asr: options.asr,
        asrSettings: options.asrSettings,
        vlm: options.vlm,
        vlmSettings: options.vlmSettings,
        music: options.music,
        musicSettings: options.musicSettings,
        videoExtract: options.videoExtract,
        audioConvert: options.audioConvert,
        audioConvertSettings: options.audioConvertSettings,
        imageConvert: options.imageConvert,
        imageConvertSettings: options.imageConvertSettings,
        imageCompress: options.imageCompress,
        imageCompressSettings: options.imageCompressSettings,
        videoCompress: options.videoCompress,
        videoCompressSettings: options.videoCompressSettings,
        tts: options.tts,
        ttsSettings: options.ttsSettings,
        freeBeforeRun: options.freeBeforeRun,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Preload failed (${response.status})`);
    }
    return;
  }

  return preloadModelOnServer(options);
}

export async function preloadModelOnServer({
  file,
  imageFiles,
  imageInputs,
  audioFiles,
  audioInputs,
  audioNode,
  videoFiles,
  videoInputs,
  baseWorkflow,
  imageNode,
  promptNode,
  promptField = 'text',
  negativePromptNode,
  negativePromptField = 'text',
  requiresImage = true,
  requiresAudio = false,
  requiresVideo = false,
  lora,
  loraEnabled = true,
  loraStrength,
  checkpoint,
  video,
  outputSize,
  supportedImageSlots,
  samplerNode,
  clipEncodeNodes,
  sampler,
  layered,
  layeredSettings,
  upscale,
  upscaleSettings,
  asr,
  asrSettings,
  vlm,
  vlmSettings,
  music,
  musicSettings,
  videoExtract,
  audioConvert,
  audioConvertSettings,
  imageConvert,
  imageConvertSettings,
  imageCompress,
  imageCompressSettings,
  videoCompress,
  videoCompressSettings,
  tts,
  ttsSettings,
  multichannel,
  onProgress,
  onExecuting,
  signal,
  freeBeforeRun = false,
}) {
  let imageName;
  let resolvedImageNames = imageFiles ? await uploadImages(imageFiles) : null;
  let resolvedAudioNames = audioFiles ? await uploadAudios(audioFiles) : null;
  let resolvedVideoNames = videoFiles ? await uploadVideos(videoFiles) : null;

  if (requiresImage) {
    if (imageInputs?.length) {
      const missingRequired = imageInputs.find(
        (input) => input.required && !resolvedImageNames?.[input.node],
      );
      if (missingRequired) {
        throw new Error(`${missingRequired.label} image is required`);
      }
    } else if (imageNode && resolvedImageNames?.[imageNode]) {
      imageName = resolvedImageNames[imageNode];
    } else if (file) {
      imageName = await uploadImage(file);
    } else {
      throw new Error('Image file is required');
    }
  }

  if (requiresAudio) {
    const audioNodesToCheck =
      audioInputs?.length > 0
        ? audioInputs.filter((input) => input.required)
        : audioNode
          ? [{ node: audioNode, label: 'Reference audio', required: true }]
          : asr?.loadAudioNode
            ? [{ node: asr.loadAudioNode, label: 'Audio', required: true }]
            : [];

    const missingRequired = audioNodesToCheck.find(
      (input) => !resolvedAudioNames?.[input.node],
    );
    if (missingRequired) {
      throw new Error(`${missingRequired.label ?? 'Audio'} is required`);
    }
  }

  if (requiresVideo) {
    if (videoInputs?.length) {
      const missingRequired = videoInputs.find(
        (input) => input.required && !resolvedVideoNames?.[input.node],
      );
      if (missingRequired) {
        throw new Error(`${missingRequired.label} is required`);
      }
    } else if (!resolvedVideoNames || Object.keys(resolvedVideoNames).length === 0) {
      throw new Error('Video file is required');
    }
  }

  const workflow = warmupWorkflow(
    buildWorkflow(baseWorkflow, {
      imageName,
      imageNames: resolvedImageNames,
      imageInputs,
      audioNames: resolvedAudioNames,
      audioInputs,
      audioNode,
      videoNames: resolvedVideoNames,
      prompt: '.',
      negativePrompt: '',
      imageNode,
      promptNode,
      promptField,
      negativePromptNode,
      negativePromptField,
      lora,
      loraEnabled,
      loraStrength,
      checkpoint,
      video,
      outputSize,
      supportedImageSlots,
      samplerNode,
      clipEncodeNodes,
      sampler,
      layered,
      layeredSettings,
      upscale,
      upscaleSettings,
      asr,
      asrSettings,
      vlm,
      vlmSettings,
      music,
      musicSettings,
      videoExtract,
      audioConvert,
      audioConvertSettings,
      imageConvert,
      imageConvertSettings,
      imageCompress,
      imageCompressSettings,
      videoCompress,
      videoCompressSettings,
      tts,
      ttsSettings,
      multichannel,
    }),
  );

  await runComfyWorkflow({
    workflow,
    onProgress,
    onExecuting,
    signal,
    requireOutput: false,
    outputType: tts || audioConvert || videoExtract || music
      ? 'audio'
      : asr || vlm
        ? 'text'
        : videoCompress
          ? 'video'
          : 'image',
    unloadAfter: false,
    freeBeforeRun,
  });
}

export async function queuePrompt(workflow, clientId) {
  if (typeof window !== 'undefined') {
    throw new Error('Direct ComfyUI /prompt from the browser is disabled');
  }

  const response = await fetch(`${getComfyUrl()}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!response.ok) {
    const body = await response.text();
    const promptError = parseComfyPromptErrorBody(body);
    if (promptError) {
      throw new Error(promptError);
    }
    throw new Error(formatUserFacingError(body || `Failed to start generation (${response.status})`));
  }

  const data = await response.json();
  const payloadError = parseComfyPromptErrorPayload(data);
  if (payloadError) {
    throw new Error(payloadError);
  }
  if (data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    throw new Error(formatUserFacingError(errorMessage));
  }
  if (data.node_errors && Object.keys(data.node_errors).length > 0) {
    const nodeError = parseComfyNodeErrors(data.node_errors);
    if (nodeError) {
      throw new Error(nodeError);
    }
    throw new Error(formatUserFacingError(JSON.stringify(data.node_errors)));
  }
  if (!data.prompt_id) {
    throw new Error('Prompt response missing prompt_id');
  }

  return data.prompt_id;
}

export async function getHistory(promptId) {
  const response = await fetch(`${getComfyUrl()}/history/${promptId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch history (${response.status})`);
  }
  return response.json();
}

export function getHistoryExecutionError(historyEntry) {
  const messages = historyEntry?.status?.messages ?? [];

  for (const message of messages) {
    if (!Array.isArray(message) || message.length < 2) {
      continue;
    }

    const [type, data] = message;
    if (type !== 'execution_error' || !data) {
      continue;
    }

    const node = data.node_type ?? data.node_id ?? null;
    const detail = data.exception_message ?? data.message ?? 'Execution failed';
    return formatUserFacingError(detail, node);
  }

  if (historyEntry?.status?.status_str === 'error') {
    return 'Generation failed. Please try again.';
  }

  return null;
}

function historyHasOutputs(historyEntry, outputType = 'image') {
  if (outputType === 'video') {
    return extractOutputVideos(historyEntry).length > 0;
  }
  if (outputType === 'audio') {
    return extractOutputAudio(historyEntry).length > 0;
  }
  if (outputType === 'text') {
    return Boolean(extractOutputText(historyEntry) || extractOutputTextFile(historyEntry));
  }

  return extractOutputImages(historyEntry).length > 0;
}

export async function waitForHistory(
  promptId,
  { intervalMs = 1000, timeoutMs = 600000, signal, requireOutput = false, outputType = 'image' } = {},
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) {
      throw new GenerationStoppedError();
    }

    const history = await getHistory(promptId);
    const entry = history[promptId];
    if (!entry) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    const executionError = getHistoryExecutionError(entry);
    if (executionError) {
      return entry;
    }

    if (!requireOutput || historyHasOutputs(entry, outputType)) {
      return entry;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Generation timed out waiting for history');
}

export function extractOutputText(historyEntry, preferredNodeId = null) {
  const outputs = historyEntry?.outputs ?? {};

  if (preferredNodeId && outputs[preferredNodeId]?.text?.length) {
    return outputs[preferredNodeId].text.join('\n').trim();
  }

  for (const nodeId of Object.keys(outputs)) {
    const chunks = outputs[nodeId]?.text;
    if (Array.isArray(chunks) && chunks.length > 0) {
      const joined = chunks.join('\n').trim();
      if (joined) {
        return joined;
      }
    }
  }

  return '';
}

export function extractOutputTextFile(historyEntry, preferredNodeId = null) {
  const outputs = historyEntry?.outputs ?? {};

  if (preferredNodeId && outputs[preferredNodeId]) {
    for (const file of outputs[preferredNodeId]?.images ?? []) {
      if (file?.filename?.endsWith('.txt')) {
        return file;
      }
    }
  }

  for (const nodeId of Object.keys(outputs)) {
    for (const file of outputs[nodeId]?.images ?? []) {
      const filename = file?.filename ?? '';
      if (filename.endsWith('.txt')) {
        return file;
      }
    }
  }
  return null;
}

export async function fetchOutputTextFile(file) {
  if (!file?.filename) {
    return '';
  }
  const url = getImageViewUrl({
    filename: file.filename,
    subfolder: file.subfolder ?? '',
    type: file.type ?? 'output',
  });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch transcription text');
  }
  return response.text();
}

export function extractOutputImages(historyEntry) {
  const images = [];
  const outputs = historyEntry?.outputs ?? {};

  for (const nodeId of Object.keys(outputs)) {
    for (const image of outputs[nodeId]?.images ?? []) {
      images.push(image);
    }
  }

  return images;
}

export function extractOutputVideos(historyEntry) {
  const videos = [];
  const outputs = historyEntry?.outputs ?? {};

  for (const nodeId of Object.keys(outputs)) {
    const nodeOutput = outputs[nodeId] ?? {};
    for (const video of nodeOutput.videos ?? []) {
      videos.push(video);
    }
    for (const gif of nodeOutput.gifs ?? []) {
      videos.push(gif);
    }
    for (const image of nodeOutput.images ?? []) {
      if (image?.animated || image?.filename?.endsWith('.mp4') || image?.filename?.endsWith('.webm')) {
        videos.push(image);
      }
    }
  }

  return videos;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.opus', '.ogg', '.m4a', '.aac'];

export function extractOutputAudio(historyEntry) {
  const audios = [];
  const outputs = historyEntry?.outputs ?? {};

  for (const nodeId of Object.keys(outputs)) {
    const nodeOutput = outputs[nodeId] ?? {};
    for (const audio of nodeOutput.audio ?? []) {
      audios.push(audio);
    }
    for (const image of nodeOutput.images ?? []) {
      const filename = image?.filename ?? '';
      if (AUDIO_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) {
        audios.push(image);
      }
    }
  }

  return audios;
}

export function getImageViewUrl({ filename, subfolder = '', type = 'output' }) {
  const params = new URLSearchParams({
    filename,
    subfolder,
    type,
  });
  return `${getComfyUrl()}/view?${params.toString()}`;
}

export async function fetchUrlAsImageFile(url, filename = 'output.png') {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch image');
  }
  const blob = await response.blob();
  const type = blob.type?.startsWith('image/') ? blob.type : 'image/png';
  return new File([blob], filename, { type });
}

function handleProgressMessage(message, callbacks) {
  if (message.type === 'progress') {
    callbacks.onProgress?.(message.data.value, message.data.max);
    return;
  }

  if (message.type === 'executing') {
    callbacks.onExecuting?.(message.data?.node ?? null);
    if (message.data?.node === null) {
      callbacks.onExecutionFinished?.();
    }
    return;
  }

  if (message.type === 'execution_error') {
    const detail =
      message.data?.exception_message ||
      message.data?.message ||
      'System execution error';
    callbacks.onError?.(new Error(detail));
    return;
  }

  if (message.type === 'execution_interrupted') {
    callbacks.onInterrupted?.(message.data?.prompt_id);
  }
}

function connectProgressSse(clientId, callbacks = {}) {
  const es = new EventSource(getComfyProgressSseUrl(clientId));

  es.onmessage = (event) => {
    if (typeof event.data !== 'string') {
      return;
    }
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    handleProgressMessage(message, callbacks);
  };

  es.onerror = () => {
    callbacks.onError?.(new Error('Progress stream connection failed'));
  };

  return () => {
    es.close();
  };
}

function connectProgressBackendWs(clientId, callbacks = {}) {
  const raw = process.env.COMFYUI_URL;
  if (!raw) {
    throw new Error('COMFYUI_URL is not set');
  }
  const base = new URL(String(raw).replace(/\/$/, ''));
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/ws';
  base.searchParams.set('clientId', clientId);

  const ws = new WebSocket(base.toString());

  ws.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    handleProgressMessage(message, callbacks);
  });

  ws.addEventListener('error', () => {
    callbacks.onError?.(new Error('WebSocket connection failed'));
  });

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

/** Browser: SSE via Next proxy. Server: direct ComfyUI WebSocket. */
export function connectProgressWebSocket(clientId, callbacks = {}) {
  if (typeof window === 'undefined') {
    return connectProgressBackendWs(clientId, callbacks);
  }
  return connectProgressSse(clientId, callbacks);
}

function appendNamedFiles(formData, prefix, files) {
  if (!files) return;
  for (const [node, file] of Object.entries(files)) {
    if (file) {
      formData.append(`${prefix}${node}`, file);
    }
  }
}

async function generateImageViaBrowserApi(options) {
  const {
    file,
    imageFiles,
    audioFiles,
    videoFiles,
    baseWorkflow: _graph,
    onProgress,
    onExecuting,
    signal,
    workflowId,
    clientId: providedClientId,
    ...meta
  } = options;

  if (!workflowId) {
    throw new Error('workflowId is required (client graphs are not accepted)');
  }

  const clientId = providedClientId || createClientId();
  let disconnect = () => {};

  const progressPromise = new Promise((resolve, reject) => {
    disconnect = connectProgressWebSocket(clientId, {
      onProgress: (value, max) => onProgress?.({ value, max }),
      onExecuting: (nodeId) => onExecuting?.(nodeId),
      onExecutionFinished: () => resolve(),
      onInterrupted: () => reject(new GenerationStoppedError()),
      onError: (error) => {
        onProgress?.({ error });
        // Do not reject here - HTTP response carries the final error.
      },
    });
  });

  const formData = new FormData();
  formData.append(
    'meta',
    JSON.stringify({
      ...meta,
      workflowId,
      clientId,
    }),
  );
  if (file) formData.append('file', file);
  appendNamedFiles(formData, 'imageFiles.', imageFiles);
  appendNamedFiles(formData, 'audioFiles.', audioFiles);
  appendNamedFiles(formData, 'videoFiles.', videoFiles);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      body: formData,
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload.error || `Generation failed (${response.status})`);
      err.code = payload.code;
      throw err;
    }
    // Allow in-flight SSE to settle; generation result is authoritative.
    await Promise.race([progressPromise.catch(() => {}), Promise.resolve()]);
    return rewriteGenerateResultForBrowser(payload.result);
  } finally {
    disconnect();
  }
}

export async function generateImage(options) {
  if (typeof window !== 'undefined') {
    return generateImageViaBrowserApi(options);
  }
  return generateImageOnServerRuntime(options);
}

async function generateImageOnServerRuntime({
  file,
  imageFiles,
  imageInputs,
  audioFiles,
  audioInputs,
  audioNode,
  videoFiles,
  videoInputs,
  prompt,
  negativePrompt,
  promptRequire,
  baseWorkflow,
  imageNode,
  promptNode,
  promptField = 'text',
  negativePromptNode,
  negativePromptField = 'text',
  requiresImage = true,
  requiresAudio = false,
  requiresVideo = false,
  lora,
  loraEnabled = true,
  loraStrength,
  checkpoint,
  video,
  outputSize,
  supportedImageSlots,
  samplerNode,
  clipEncodeNodes,
  sampler,
  layered,
  layeredSettings,
  upscale,
  upscaleSettings,
  asr,
  asrSettings,
  vlm,
  vlmSettings,
  music,
  musicSettings,
  videoExtract,
  audioConvert,
  audioConvertSettings,
  imageConvert,
  imageConvertSettings,
  imageCompress,
  imageCompressSettings,
  videoCompress,
  videoCompressSettings,
  tts,
  ttsSettings,
  multichannel,
  seed = null,
  onProgress,
  onExecuting,
  signal,
  unloadAfter = false,
  freeBeforeRun = false,
  outputType = 'image',
  historyTimeoutMs,
  clientId,
}) {
  let imageName;
  let resolvedImageNames = imageFiles ? await uploadImages(imageFiles) : null;
  let resolvedAudioNames = audioFiles ? await uploadAudios(audioFiles) : null;
  let resolvedVideoNames = videoFiles ? await uploadVideos(videoFiles) : null;

  if (requiresImage) {
    if (imageInputs?.length) {
      const missingRequired = imageInputs.find(
        (input) => input.required && !resolvedImageNames?.[input.node],
      );
      if (missingRequired) {
        throw new Error(`${missingRequired.label} image is required`);
      }
    } else if (imageNode && resolvedImageNames?.[imageNode]) {
      imageName = resolvedImageNames[imageNode];
    } else if (file) {
      imageName = await uploadImage(file);
    } else {
      throw new Error('Image file is required');
    }
  }

  if (requiresAudio) {
    const audioNodesToCheck =
      audioInputs?.length > 0
        ? audioInputs.filter((input) => input.required)
        : audioNode
          ? [{ node: audioNode, label: 'Reference audio', required: true }]
          : asr?.loadAudioNode
            ? [{ node: asr.loadAudioNode, label: 'Audio', required: true }]
            : [];

    const missingRequired = audioNodesToCheck.find(
      (input) => !resolvedAudioNames?.[input.node],
    );
    if (missingRequired) {
      throw new Error(`${missingRequired.label ?? 'Audio'} is required`);
    }
  }

  if (requiresVideo) {
    if (videoInputs?.length) {
      const missingRequired = videoInputs.find(
        (input) => input.required && !resolvedVideoNames?.[input.node],
      );
      if (missingRequired) {
        throw new Error(`${missingRequired.label} is required`);
      }
    } else if (!resolvedVideoNames || Object.keys(resolvedVideoNames).length === 0) {
      throw new Error('Video file is required');
    }
  }

  const workflow = buildWorkflow(baseWorkflow, {
    imageName,
    imageNames: resolvedImageNames,
    imageInputs,
    audioNames: resolvedAudioNames,
    audioInputs,
    audioNode,
    videoNames: resolvedVideoNames,
    prompt,
    negativePrompt,
    promptRequire,
    imageNode,
    promptNode,
    promptField,
    negativePromptNode,
    negativePromptField,
    lora,
    loraEnabled,
    loraStrength,
    checkpoint,
    video,
    outputSize,
    supportedImageSlots,
    samplerNode,
    clipEncodeNodes,
    sampler,
    layered,
    layeredSettings,
    upscale,
    upscaleSettings,
    asr,
    asrSettings,
    vlm,
    vlmSettings,
    music,
    musicSettings,
    videoExtract,
    audioConvert,
    audioConvertSettings,
    imageConvert,
    imageConvertSettings,
    imageCompress,
    imageCompressSettings,
    videoCompress,
    videoCompressSettings,
    tts,
    ttsSettings,
    multichannel,
    seed,
  });

  const resolvedHistoryTimeoutMs =
    historyTimeoutMs ??
    (outputType === 'video'
      ? (videoCompress?.historyTimeoutMs ??
        getVideoHistoryTimeoutMs(video ?? {}))
      : outputType === 'audio'
        ? (tts?.historyTimeoutMs ??
          music?.historyTimeoutMs ??
          videoExtract?.historyTimeoutMs ??
          audioConvert?.historyTimeoutMs ??
          300_000)
        : outputType === 'text'
          ? (asr?.historyTimeoutMs ?? vlm?.historyTimeoutMs ?? 300_000)
          : 600_000);

  return runComfyWorkflow({
    workflow,
    onProgress,
    onExecuting,
    signal,
    requireOutput: true,
    outputType,
    unloadAfter,
    freeBeforeRun,
    historyTimeoutMs: resolvedHistoryTimeoutMs,
    textOutputNodeId: asr?.outputNode ?? vlm?.outputNode ?? null,
    clientId,
  });
}
