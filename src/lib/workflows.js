import audioConvert from '@/workflows/audio-convert.json';
import redrobTuneMusic from '@/workflows/redrob-tune-music.json';
import imageCompress from '@/workflows/image-compress.json';
import imageConvert from '@/workflows/image-convert.json';
import vision from '@/workflows/vision.json';
import imageUpscale from '@/workflows/image-upscale.json';
import manifest from '@/workflows/manifest.json';
import redrobImageGenerate from '@/workflows/redrob-image-generate.json';
import qwen3TtsSpeak from '@/workflows/qwen3-tts-speak.json';
import qwen3TtsVoiceClone from '@/workflows/qwen3-tts-voice-clone.json';
import qwen3TtsVoiceDesign from '@/workflows/qwen3-tts-voice-design.json';
import videoExtractAudio from '@/workflows/video-extract-audio.json';
import qwen3AsrTranscribe from '@/workflows/qwen3-asr-transcribe.json';
const LEGACY_ACTION_TO_TASK = {
  create: 'create',
};

function normalizeTask(taskOrAction) {
  return LEGACY_ACTION_TO_TASK[taskOrAction] ?? taskOrAction;
}

function isOptionalStyleLoraNode(node) {
  return node?.class_type === 'LoraLoaderModelOnly' || node?.class_type === 'LoraLoader';
}

export function isVirtualImageNode(nodeId) {
  return typeof nodeId === 'string' && nodeId.startsWith('_');
}

function parseImageExportConfig(entry, workflow, entryId) {
  if (!entry?.saveNodes?.length) {
    return null;
  }

  for (const save of entry.saveNodes) {
    const node = workflow[save.node];
    if (!node) {
      throw new Error(`Workflow "${entryId}" missing image export node "${save.node}"`);
    }
    if (save.fileTypeField && !(save.fileTypeField in (node.inputs ?? {}))) {
      throw new Error(
        `Workflow "${entryId}" missing ${save.fileTypeField} on image export node "${save.node}"`,
      );
    }
  }

  return {
    defaultFormat: entry.defaultFormat ?? 'png',
    formats: entry.formats ?? ['png'],
    saveNodes: entry.saveNodes.map(save => ({
      node: save.node,
      format: save.format,
      fileTypeField: save.fileTypeField ?? null,
      fileType: save.fileType ?? null,
      qualityField: save.qualityField ?? null,
      quality: save.quality ?? null,
    })),
  };
}

function parseOutputSizeConfig(workflow, entryId, outputSizeEntry) {
  if (!outputSizeEntry) {
    return null;
  }

  const {
    node,
    alsoNodes = [],
    baseSize,
    step = 8,
    min = 512,
    max = 1536,
    aspectRatios,
    defaultAspectRatio,
    squareSize,
  } = outputSizeEntry;
  const sizeInputs = workflow[node]?.inputs;
  if (!sizeInputs || sizeInputs.width == null || sizeInputs.height == null) {
    throw new Error(`Workflow "${entryId}" missing output size node "${node}"`);
  }

  return {
    node,
    alsoNodes: Array.isArray(alsoNodes) ? alsoNodes : [],
    baseSize: baseSize ?? sizeInputs.width,
    step,
    min,
    max,
    squareSize: squareSize ?? null,
    defaultAspectRatio: defaultAspectRatio ?? '1:1',
    aspectRatios: aspectRatios ?? [{ id: '1:1', label: '1:1' }],
    width: sizeInputs.width,
    height: sizeInputs.height,
    sourceNode: outputSizeEntry.sourceNode ?? null,
  };
}

const workflowByFile = {
  'audio-convert.json': audioConvert,
  'redrob-tune-music.json': redrobTuneMusic,
  'image-compress.json': imageCompress,
  'image-convert.json': imageConvert,
  'vision.json': vision,
  'image-upscale.json': imageUpscale,
  'redrob-image-generate.json': redrobImageGenerate,
  'qwen3-tts-speak.json': qwen3TtsSpeak,
  'qwen3-tts-voice-clone.json': qwen3TtsVoiceClone,
  'qwen3-tts-voice-design.json': qwen3TtsVoiceDesign,
  'video-extract-audio.json': videoExtractAudio,
  'qwen3-asr-transcribe.json': qwen3AsrTranscribe,
};

export function getWorkflowOptions() {
  return manifest.workflows.map((entry) => {
    const workflow = workflowByFile[entry.file];
    if (!workflow) {
      throw new Error(`Workflow file not registered: ${entry.file}`);
    }

    const requiresImage =
      entry.requiresImage ??
      (Boolean(entry.imageNode) || Boolean(entry.imageInputs?.length));
    const requiresAudio = entry.requiresAudio ?? false;
    const requiresVideo = entry.requiresVideo ?? false;
    const requiresPrompt = entry.requiresPrompt ?? Boolean(entry.promptNode);
    const promptField = entry.promptField ?? 'text';
    const promptNode = entry.promptNode ?? null;
    const negativePromptNode = entry.negativePromptNode ?? null;
    const negativePromptField = entry.negativePromptField ?? 'text';

    if (requiresPrompt && promptNode) {
      if (!(promptField in (workflow[promptNode]?.inputs ?? {}))) {
        throw new Error(
          `Workflow "${entry.id}" prompt node "${promptNode}" missing field "${promptField}"`,
        );
      }
    }

    if (requiresImage) {
      if (entry.imageInputs?.length) {
        for (const input of entry.imageInputs) {
          const { node, slot } = input;
          if (!workflow[node] || workflow[node].class_type !== 'LoadImage') {
            throw new Error(`Workflow "${entry.id}" missing LoadImage node "${node}"`);
          }
          if (requiresPrompt && promptNode && slot) {
            const promptInputs = workflow[promptNode]?.inputs ?? {};
            if (!(slot in promptInputs)) {
              throw new Error(
                `Workflow "${entry.id}" prompt node "${promptNode}" missing slot "${slot}"`,
              );
            }
          }
        }
      } else {
        const imageNode = entry.imageNode;
        if (!imageNode || !workflow[imageNode]?.inputs?.image) {
          throw new Error(`Workflow "${entry.id}" missing LoadImage node "${imageNode}"`);
        }
      }
    }

    if (requiresAudio) {
      const isAudioLoaderNode = (node) => node?.class_type === 'LoadAudio';

      if (entry.audioInputs?.length) {
        for (const input of entry.audioInputs) {
          const { node } = input;
          if (!workflow[node] || !isAudioLoaderNode(workflow[node])) {
            throw new Error(`Workflow "${entry.id}" missing audio loader node "${node}"`);
          }
        }
      } else {
        const audioNode = entry.audioNode;
        if (!audioNode || !isAudioLoaderNode(workflow[audioNode])) {
          throw new Error(`Workflow "${entry.id}" missing audio loader node "${audioNode}"`);
        }
      }
    }

    if (requiresVideo) {
      if (entry.videoInputs?.length) {
        for (const input of entry.videoInputs) {
          const { node } = input;
          if (!workflow[node] || workflow[node].class_type !== 'VHS_LoadVideo') {
            throw new Error(`Workflow "${entry.id}" missing VHS_LoadVideo node "${node}"`);
          }
        }
      }
    }

    if (negativePromptNode) {
      if (!(negativePromptField in (workflow[negativePromptNode]?.inputs ?? {}))) {
        throw new Error(
          `Workflow "${entry.id}" negative prompt node "${negativePromptNode}" missing field "${negativePromptField}"`,
        );
      }
    }

    if (entry.reactorNode || entry.faceSwap) {
      throw new Error(
        `Workflow "${entry.id}" uses face-swap / ReActor — not shipped in the OSS-safe cut`,
      );
    }

    if (entry.lora) {
      const { node, consumerNode, sourceNode, name } = entry.lora;
      if (!workflow[node] || !isOptionalStyleLoraNode(workflow[node])) {
        throw new Error(`Workflow "${entry.id}" missing LoRA node "${node}"`);
      }
      if (!workflow[consumerNode]?.inputs?.model) {
        throw new Error(`Workflow "${entry.id}" missing LoRA consumer node "${consumerNode}"`);
      }
      if (!workflow[sourceNode]) {
        throw new Error(`Workflow "${entry.id}" missing LoRA source node "${sourceNode}"`);
      }
      if (!name) {
        throw new Error(`Workflow "${entry.id}" LoRA missing name`);
      }
    }

    let video = null;
    if (entry.video) {
      const engine = entry.video.engine ?? 'wan';
      if (engine === 'ltx' || engine === 'director') {
        throw new Error(
          `Workflow "${entry.id}" uses LTX/director video gen — not shipped in the OSS-safe cut`,
        );
      }

      const { wanNode, fpsNode } = entry.video;
      const wanInputs = workflow[wanNode]?.inputs;
      const fpsInputs = workflow[fpsNode]?.inputs;
      const VIDEO_LATENT_NODE_TYPES = ['WanImageToVideo', 'EmptyHunyuanLatentVideo'];
      if (!wanInputs || !VIDEO_LATENT_NODE_TYPES.includes(workflow[wanNode].class_type)) {
        throw new Error(
          `Workflow "${entry.id}" missing video latent node "${wanNode}" (expected WanImageToVideo or EmptyHunyuanLatentVideo)`,
        );
      }
      if (!fpsInputs || workflow[fpsNode].class_type !== 'CreateVideo') {
        throw new Error(`Workflow "${entry.id}" missing CreateVideo node "${fpsNode}"`);
      }
      if (
        wanInputs.width == null ||
        wanInputs.height == null ||
        wanInputs.length == null ||
        fpsInputs.fps == null
      ) {
        throw new Error(`Workflow "${entry.id}" video nodes missing width, height, length, or fps`);
      }

      const step = entry.video.step ?? 16;
      const samplerConfig = entry.video.sampler;
      let sampler = null;
      if (samplerConfig?.type === 'ltx' || samplerConfig?.type === 'director') {
        throw new Error(
          `Workflow "${entry.id}" uses LTX/director video gen — not shipped in the OSS-safe cut`,
        );
      }
      if (samplerConfig) {
        const { highNoiseNode, lowNoiseNode, fast, quality, highCfg = 4 } = samplerConfig;
        if (
          !workflow[highNoiseNode] ||
          workflow[highNoiseNode].class_type !== 'KSamplerAdvanced' ||
          !workflow[lowNoiseNode] ||
          workflow[lowNoiseNode].class_type !== 'KSamplerAdvanced'
        ) {
          throw new Error(`Workflow "${entry.id}" missing KSamplerAdvanced sampler nodes`);
        }
        sampler = {
          highNoiseNode,
          lowNoiseNode,
          highCfg,
          fast: {
            steps: fast?.steps ?? workflow[highNoiseNode].inputs.steps,
            splitStep: fast?.splitStep ?? workflow[highNoiseNode].inputs.end_at_step,
            cfg: fast?.cfg ?? workflow[highNoiseNode].inputs.cfg,
          },
          quality: {
            steps: quality?.steps ?? 24,
            splitStep: quality?.splitStep ?? 12,
            cfg: quality?.cfg ?? 1,
          },
        };
      }

      const loras = (entry.video.loras ?? []).map((lora) => {
        if (!workflow[lora.node] || workflow[lora.node].class_type !== 'LoraLoaderModelOnly') {
          throw new Error(`Workflow "${entry.id}" missing LoRA node "${lora.node}"`);
        }
        if (!workflow[lora.consumerNode]?.inputs?.model) {
          throw new Error(
            `Workflow "${entry.id}" missing LoRA consumer node "${lora.consumerNode}"`,
          );
        }
        if (!workflow[lora.sourceNode]) {
          throw new Error(`Workflow "${entry.id}" missing LoRA source node "${lora.sourceNode}"`);
        }
        return {
          node: lora.node,
          consumerNode: lora.consumerNode,
          sourceNode: lora.sourceNode,
          label: lora.label ?? 'LoRA',
        };
      });

      video = {
        engine: entry.video.engine ?? 'wan',
        wanNode,
        audioLatentNode: entry.video.audioLatentNode ?? null,
        conditioningNode: entry.video.conditioningNode ?? null,
        cfgNode: entry.video.cfgNode ?? sampler?.cfgNode ?? null,
        checkpointNode: entry.video.checkpointNode ?? null,
        distilledLora: entry.video.distilledLora ?? null,
        fpsNode,
        fps: fpsInputs.fps,
        width: wanInputs.width,
        height: wanInputs.height,
        length: wanInputs.length,
        baseSize: entry.video.baseSize ?? Math.max(wanInputs.width, wanInputs.height),
        defaultAspectRatio: entry.video.defaultAspectRatio ?? '9:16',
        aspectRatios: entry.video.aspectRatios ?? [],
        widthMin: entry.video.widthMin ?? step,
        widthMax: entry.video.widthMax ?? 1280,
        heightMin: entry.video.heightMin ?? step,
        heightMax: entry.video.heightMax ?? 1280,
        step,
        secondsMin: entry.video.secondsMin ?? 1,
        secondsMax: entry.video.secondsMax ?? 30,
        secondsStep: entry.video.secondsStep ?? 0.25,
        defaultSeconds: entry.video.defaultSeconds ?? 5,
        sampler,
        loras,
      };
    }

    let outputSize = null;
    if (entry.outputSize) {
      outputSize = parseOutputSizeConfig(workflow, entry.id, entry.outputSize);
    }

    let multichannel = null;
    if (entry.multichannel) {
      const { channelSelectorNode, channelSelectorField = 'value', defaultChannel = 1, channels } =
        entry.multichannel;
      if (!channelSelectorNode || !workflow[channelSelectorNode]?.inputs) {
        throw new Error(
          `Workflow "${entry.id}" missing channel selector node "${channelSelectorNode}"`,
        );
      }
      if (!channels?.length) {
        throw new Error(`Workflow "${entry.id}" multichannel config requires channels`);
      }

      multichannel = {
        channelSelectorNode,
        channelSelectorField,
        defaultChannel,
        warmupWorkflow: entry.warmupFile ? workflowByFile[entry.warmupFile] ?? null : null,
        channels: channels.map((channel) => {
          const promptNodeId = channel.promptNode;
          const promptFieldName = channel.promptField ?? 'text';
          if (!promptNodeId || !(promptFieldName in (workflow[promptNodeId]?.inputs ?? {}))) {
            throw new Error(
              `Workflow "${entry.id}" channel ${channel.id} missing prompt node "${promptNodeId}"`,
            );
          }

          const negativePromptNodeId = channel.negativePromptNode ?? null;
          const negativePromptFieldName = channel.negativePromptField ?? 'text';
          if (
            negativePromptNodeId &&
            !(negativePromptFieldName in (workflow[negativePromptNodeId]?.inputs ?? {}))
          ) {
            throw new Error(
              `Workflow "${entry.id}" channel ${channel.id} missing negative prompt node "${negativePromptNodeId}"`,
            );
          }

          return {
            id: channel.id,
            label: channel.label ?? `Channel ${channel.id}`,
            description: channel.description ?? '',
            mature: Boolean(channel.mature),
            promptNode: promptNodeId,
            promptField: promptFieldName,
            negativePromptNode: negativePromptNodeId,
            negativePromptField: negativePromptFieldName,
            defaultPrompt: channel.defaultPrompt ?? workflow[promptNodeId]?.inputs?.[promptFieldName] ?? '',
            defaultNegativePrompt:
              channel.defaultNegativePrompt ??
              (negativePromptNodeId
                ? workflow[negativePromptNodeId]?.inputs?.[negativePromptFieldName]
                : '') ??
              '',
            outputSize: parseOutputSizeConfig(workflow, entry.id, channel.outputSize),
          };
        }),
      };
    }

    let upscale = null;
    if (entry.upscale) {
      const { scaleNode, faceRestoreNode, saveNode } = entry.upscale;
      if (!scaleNode || workflow[scaleNode]?.class_type !== 'ImageScale') {
        throw new Error(`Workflow "${entry.id}" missing ImageScale upscale node "${scaleNode}"`);
      }
      if (faceRestoreNode || entry.upscale.faceRestore) {
        throw new Error(
          `Workflow "${entry.id}" uses face restore / CodeFormer — not shipped in the OSS-safe cut`,
        );
      }
      if (saveNode && !workflow[saveNode]) {
        throw new Error(`Workflow "${entry.id}" missing upscale save node "${saveNode}"`);
      }

      upscale = {
        scaleNode,
        faceRestoreNode: null,
        saveNode: saveNode ?? null,
        defaultScale: entry.upscale.defaultScale ?? 2,
        scales: entry.upscale.scales ?? [2, 3, 4],
        faceRestore: null,
      };
    }

    let tts = null;
    if (entry.tts) {
      const { node, saveNode } = entry.tts;
      const ttsClassType = workflow[node]?.class_type;
      const supportedTtsNodes = [
        'FB_Qwen3TTSCustomVoice',
        'FB_Qwen3TTSVoiceClone',
        'FB_Qwen3TTSVoiceDesign',
      ];
      if (!node || !supportedTtsNodes.includes(ttsClassType)) {
        throw new Error(
          `Workflow "${entry.id}" missing a supported Qwen TTS node at "${node}"`,
        );
      }

      if (saveNode && workflow[saveNode]?.class_type !== 'SaveAudioMP3') {
        throw new Error(`Workflow "${entry.id}" missing SaveAudioMP3 node "${saveNode}"`);
      }

      const mode =
        entry.tts.mode ??
        (ttsClassType === 'FB_Qwen3TTSVoiceDesign'
          ? 'voiceDesign'
          : ttsClassType === 'FB_Qwen3TTSVoiceClone'
            ? 'voiceClone'
            : 'customVoice');

      tts = {
        node,
        saveNode: saveNode ?? null,
        mode,
        loadAudioNode: entry.tts.loadAudioNode ?? null,
        modelChoice: entry.tts.modelChoice ?? '1.7B',
        defaultSpeaker: entry.tts.defaultSpeaker ?? 'Ryan',
        defaultLanguage: entry.tts.defaultLanguage ?? 'Auto',
        voiceInstructField: entry.tts.voiceInstructField ?? 'instruct',
        speakers: entry.tts.speakers ?? [],
        languages: entry.tts.languages ?? [],
        historyTimeoutMs: entry.tts.historyTimeoutMs ?? 300_000,
      };
    }

    if (entry.bgRemove) {
      throw new Error(
        `Workflow "${entry.id}" uses RMBG / remove-background — not shipped in the OSS-safe cut`,
      );
    }

    let imageConvert = null;
    if (entry.imageConvert) {
      imageConvert = parseImageExportConfig(entry.imageConvert, workflow, entry.id);
    }

    let imageCompress = null;
    if (entry.imageCompress) {
      const { scaleNode, defaultScale = 1, scaleMin = 0.25, scaleMax = 1, scaleStep = 0.05 } =
        entry.imageCompress;
      if (!scaleNode || workflow[scaleNode]?.class_type !== 'ImageScaleBy') {
        throw new Error(`Workflow "${entry.id}" missing ImageScaleBy node "${scaleNode}"`);
      }

      imageCompress = {
        scaleNode,
        defaultScale,
        scaleMin,
        scaleMax,
        scaleStep,
        ...parseImageExportConfig(entry.imageCompress, workflow, entry.id),
      };
    }

    let asr = null;
    if (entry.asr) {
      const { loaderNode, transcribeNode, outputNode } = entry.asr;
      if (!loaderNode || workflow[loaderNode]?.class_type !== 'Qwen3ASRLoader') {
        throw new Error(`Workflow "${entry.id}" missing Qwen3ASRLoader node "${loaderNode}"`);
      }
      if (!transcribeNode || workflow[transcribeNode]?.class_type !== 'Qwen3ASRTranscribe') {
        throw new Error(
          `Workflow "${entry.id}" missing Qwen3ASRTranscribe node "${transcribeNode}"`,
        );
      }
      const resolvedOutputNode = outputNode ?? transcribeNode;
      if (workflow[resolvedOutputNode]?.class_type !== 'ShowText') {
        throw new Error(`Workflow "${entry.id}" missing ShowText node "${resolvedOutputNode}"`);
      }
      if (entry.asr.loadAudioNode) {
        const loadNode = workflow[entry.asr.loadAudioNode];
        if (!loadNode || loadNode.class_type !== 'LoadAudio') {
          throw new Error(
            `Workflow "${entry.id}" missing LoadAudio node "${entry.asr.loadAudioNode}"`,
          );
        }
      }

      const modelSizes = (entry.asr.modelSizes ?? []).map((size) =>
        typeof size === 'string'
          ? { id: size, label: size, repoId: size }
          : {
              id: size.id,
              label: size.label ?? size.id,
              repoId: size.repoId ?? size.id,
            },
      );

      asr = {
        loadAudioNode: entry.asr.loadAudioNode ?? null,
        loaderNode,
        transcribeNode,
        outputNode: resolvedOutputNode,
        defaultModelSize: entry.asr.defaultModelSize ?? modelSizes[0]?.id ?? '0.6B',
        modelSizes,
        defaultPrecision: entry.asr.defaultPrecision ?? 'bf16',
        defaultLanguage: entry.asr.defaultLanguage ?? 'auto',
        languages: entry.asr.languages ?? [{ value: 'auto', label: 'Auto-detect' }],
        historyTimeoutMs: entry.asr.historyTimeoutMs ?? 300_000,
      };
    }

    let vlm = null;
    if (entry.vlm) {
      const { inferNode, outputNode } = entry.vlm;
      const inferClass = workflow[inferNode]?.class_type;
      const supportedInfer =
        inferClass === 'AILab_QwenVL' || inferClass === 'AILab_QwenVL_PromptEnhancer';
      if (!inferNode || !supportedInfer) {
        throw new Error(
          `Workflow "${entry.id}" missing text / vision language node "${inferNode}"`,
        );
      }
      const resolvedOutputNode = outputNode ?? inferNode;
      if (workflow[resolvedOutputNode]?.class_type !== 'ShowText') {
        throw new Error(`Workflow "${entry.id}" missing ShowText node "${resolvedOutputNode}"`);
      }

      const modes = (entry.vlm.modes ?? []).map((mode) => ({
        id: mode.id,
        label: mode.label ?? mode.id,
        preset: mode.preset ?? null,
        instruction: mode.instruction ?? null,
      }));

      vlm = {
        inferNode,
        outputNode: resolvedOutputNode,
        model: entry.vlm.model ?? null,
        promptRole: entry.vlm.promptRole ?? 'question',
        defaultMode: entry.vlm.defaultMode ?? modes[0]?.id ?? null,
        modes,
        historyTimeoutMs: entry.vlm.historyTimeoutMs ?? 300_000,
      };
    }

    let music = null;
    if (entry.music) {
      const engine = entry.music.engine ?? entry.engine ?? 'redrob-tune';
      const { saveNode } = entry.music;

      if (saveNode) {
        const saveType = workflow[saveNode]?.class_type;
        if (saveType !== 'SaveAudio' && saveType !== 'SaveAudioMP3') {
          throw new Error(
            `Workflow "${entry.id}" missing SaveAudio/SaveAudioMP3 node "${saveNode}"`,
          );
        }
      }

      if (engine !== 'redrob-tune') {
        throw new Error(`Workflow "${entry.id}" unsupported music engine "${engine}"`);
      }

      const {
        unetNode,
        samplingNode,
        apgNode,
        encodeNode,
        latentNode,
        samplerNode,
        refAudioNode,
        refTrimNode,
        refEncodeNode,
        refTimbreNode,
      } = entry.music;
      if (!encodeNode || workflow[encodeNode]?.class_type !== 'TextEncodeAceStepAudio1.5') {
        throw new Error(
          `Workflow "${entry.id}" missing TextEncodeAceStepAudio1.5 node "${encodeNode}"`,
        );
      }
      if (!samplerNode || workflow[samplerNode]?.class_type !== 'KSampler') {
        throw new Error(`Workflow "${entry.id}" missing KSampler node "${samplerNode}"`);
      }
      if (!latentNode || workflow[latentNode]?.class_type !== 'EmptyAceStep1.5LatentAudio') {
        throw new Error(
          `Workflow "${entry.id}" missing EmptyAceStep1.5LatentAudio node "${latentNode}"`,
        );
      }
      if (unetNode && workflow[unetNode]?.class_type !== 'UNETLoader') {
        throw new Error(`Workflow "${entry.id}" missing UNETLoader node "${unetNode}"`);
      }
      if (apgNode && workflow[apgNode]?.class_type !== 'APG') {
        throw new Error(`Workflow "${entry.id}" missing APG node "${apgNode}"`);
      }
      if (refTrimNode && workflow[refTrimNode]?.class_type !== 'TrimAudioDuration') {
        throw new Error(`Workflow "${entry.id}" missing TrimAudioDuration node "${refTrimNode}"`);
      }
      music = {
        engine: 'redrob-tune',
        unetNode: unetNode ?? null,
        samplingNode: samplingNode ?? null,
        apgNode: apgNode ?? null,
        encodeNode,
        latentNode,
        samplerNode,
        saveNode: saveNode ?? null,
        refAudioNode: refAudioNode ?? null,
        refTrimNode: refTrimNode ?? null,
        refEncodeNode: refEncodeNode ?? null,
        refTimbreNode: refTimbreNode ?? null,
        defaultSeconds: entry.music.defaultSeconds ?? 60,
        secondsMin: entry.music.secondsMin ?? 10,
        secondsMax: entry.music.secondsMax ?? 600,
        defaultModelVersion: entry.music.defaultModelVersion ?? 'redrob-tune-fast',
        defaultBpm: entry.music.defaultBpm ?? 120,
        defaultKeyScale: entry.music.defaultKeyScale ?? 'E minor',
        defaultTimeSignature: entry.music.defaultTimeSignature ?? '4',
        defaultLanguage: entry.music.defaultLanguage ?? 'en',
        defaultGenerateAudioCodes: true,
        defaultLmCfg: entry.music.defaultLmCfg ?? 2,
        defaultTemperature: entry.music.defaultTemperature ?? 0.85,
        refTrimSeconds: entry.music.refTrimSeconds ?? 30,
        models: (entry.music.models ?? []).map(model => ({
          id: model.id,
          label: model.label ?? model.id,
          description: model.description ?? '',
        })),
        historyTimeoutMs: entry.music.historyTimeoutMs ?? 900_000,
      };
    }

    if (entry.lipsync) {
      throw new Error(
        `Workflow "${entry.id}" uses lipsync — not shipped in the OSS-safe cut`,
      );
    }

    const imageInputs = (entry.imageInputs ?? []).map((input) => ({
      node: input.node,
      slot: input.slot,
      label: input.label ?? input.slot,
      required: input.required ?? false,
    }));

    const audioInputs = (entry.audioInputs ?? []).map((input) => ({
      node: input.node,
      label: input.label ?? 'Reference audio',
      required: input.required ?? false,
    }));

    const videoInputs = (entry.videoInputs ?? []).map((input) => ({
      node: input.node,
      label: input.label ?? 'Video',
      required: input.required ?? false,
    }));

    let videoExtract = null;
    if (entry.videoExtract) {
      const { loadNode, saveNode } = entry.videoExtract;
      if (!workflow[loadNode] || workflow[loadNode].class_type !== 'VHS_LoadVideo') {
        throw new Error(`Workflow "${entry.id}" missing VHS_LoadVideo node "${loadNode}"`);
      }
      if (saveNode && workflow[saveNode]?.class_type !== 'SaveAudioMP3') {
        throw new Error(`Workflow "${entry.id}" missing SaveAudioMP3 node "${saveNode}"`);
      }
      videoExtract = {
        loadNode,
        saveNode: saveNode ?? null,
        historyTimeoutMs: entry.videoExtract.historyTimeoutMs ?? 300_000,
      };
    }

    let audioConvert = null;
    if (entry.audioConvert) {
      audioConvert = {
        defaultFormat: entry.audioConvert.defaultFormat ?? 'mp3',
        formats: entry.audioConvert.formats ?? ['mp3'],
        saveNodes: entry.audioConvert.saveNodes ?? [],
      };
    }

    const legacyAction =
      entry.action ??
      (entry.outputType === 'audio'
        ? 'speak'
        : entry.outputType === 'text'
          ? 'transcribe'
          : entry.requiresImage
            ? 'edit'
            : 'create');
    const task = normalizeTask(entry.task ?? legacyAction);

    return {
      id: entry.id,
      name: entry.name,
      file: entry.file,
      modality:
        entry.modality ??
        (entry.outputType === 'audio' ? 'audio' : entry.outputType === 'text' ? 'text' : 'image'),
      task,
      action: task,
      engine: entry.engine ?? null,
      ui: entry.ui ?? null,
      actionDescription: entry.actionDescription ?? null,
      imageNode:
        entry.imageNode ??
        imageInputs.find((input) => input.required)?.node ??
        null,
      imageInputs: imageInputs.length > 0 ? imageInputs : null,
      audioNode: entry.audioNode ?? audioInputs.find((input) => input.required)?.node ?? null,
      audioInputs: audioInputs.length > 0 ? audioInputs : null,
      requiresAudio,
      requiresVideo,
      videoInputs: videoInputs.length > 0 ? videoInputs : null,
      promptNode,
      promptField,
      negativePromptNode,
      negativePromptField,
      requiresImage,
      requiresPrompt,
      promptRewrite: entry.promptRewrite ?? null,
      promptRequire: entry.promptRequire ?? null,
      defaultPrompt:
        entry.defaultPrompt ??
        (promptNode ? (workflow[promptNode]?.inputs?.[promptField] ?? '') : ''),
      promptPlaceholder: entry.promptPlaceholder ?? null,
      defaultNegativePrompt:
        entry.defaultNegativePrompt ??
        (negativePromptNode ? workflow[negativePromptNode]?.inputs?.[negativePromptField] : '') ??
        '',
      lora: entry.lora
        ? {
            id: entry.lora.id ?? 'style-lora',
            node: entry.lora.node,
            consumerNode: entry.lora.consumerNode,
            sourceNode: entry.lora.sourceNode,
            name: entry.lora.name,
            strength: entry.lora.strength ?? 1,
            strengthMin: entry.lora.strengthMin ?? 0,
            strengthMax: entry.lora.strengthMax ?? 2,
            strengthStep: entry.lora.strengthStep ?? 0.05,
            label: entry.lora.label ?? 'LoRA',
            defaultEnabled: entry.lora.defaultEnabled ?? true,
          }
        : null,
      checkpoint: entry.checkpoint
        ? (() => {
            const { node, name, field: fieldOverride } = entry.checkpoint;
            const classType = workflow[node]?.class_type;
            const supported =
              classType === 'CheckpointLoaderSimple' ||
              classType === 'UNETLoader' ||
              classType === 'OTUNetLoaderW8A8';
            if (!workflow[node] || !supported) {
              throw new Error(
                `Workflow "${entry.id}" missing CheckpointLoaderSimple / UNETLoader / OTUNetLoaderW8A8 node "${node}"`,
              );
            }
            if (!name) {
              throw new Error(`Workflow "${entry.id}" checkpoint missing name`);
            }
            const field =
              fieldOverride ??
              (classType === 'CheckpointLoaderSimple' ? 'ckpt_name' : 'unet_name');
            return {
              node,
              name,
              field,
            };
          })()
        : null,
      outputType: entry.outputType ?? 'image',
      accessPassword: entry.accessPassword ?? null,
      video,
      outputSize,
      samplerNode: entry.samplerNode ?? null,
      clipEncodeNodes: entry.clipEncodeNodes ?? null,
      sampler: entry.sampler ?? null,
      upscale,
      bgRemove: null,
      asr,
      vlm,
      music,
      lipsync: null,
      faceSwap: null,
      tts,
      videoExtract,
      audioConvert,
      imageConvert,
      imageCompress,
      multiOutput: entry.multiOutput ?? false,
      multichannel,
      keepModelsResident: Boolean(entry.keepModelsResident),
      workflow,
    };
  });
}
