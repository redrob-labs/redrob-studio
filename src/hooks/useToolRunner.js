'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStudio } from '@/context/StudioContext';
import {
  fetchUrlAsImageFile,
  formatUserFacingError,
  freeMemory,
  generateImage,
  GenerationInProgressError,
  GenerationStoppedError,
  getExecutingPhaseKey,
  getExecutingPhaseLabel,
  isGenerating as isComfyGenerating,
  preloadModel,
  dimensionsFromAspectRatio,
  readAudioFileDuration,
  readVideoFileDuration,
  readImageFileDimensions,
} from '@/lib/comfyui';
import {
  buildSpeakInstruct,
  DEFAULT_SPEAK_PAUSE_STYLE,
  DEFAULT_SPEAK_SPEED,
} from '@/lib/audio-prompt';
import { PAGE_TITLE } from '@/lib/studio/constants';
import { getPageTitle } from '@/lib/studio/page-title';
import { getWorkflowOptions } from '@/lib/workflows';
import {
  getAvailableTasks,
  getTaskMeta,
  inferCreateSelectionFromTask,
  isCreateStyleTask,
  resolveCreateWorkflowTask,
  resolveWorkflow,
} from '@/lib/workflow-catalog';

export function useToolRunner(modality, task, options = {}) {
  const { initialCreateStyle } = options;
  const {
    comfyOnline,
    audioCapabilities,
  } = useStudio();

  const workflowOptions = useMemo(() => getWorkflowOptions(), []);

  const inputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [videoFiles, setVideoFiles] = useState({});
  const [videoPreviewUrls, setVideoPreviewUrls] = useState({});
  const [videoDurations, setVideoDurations] = useState({});
  const [audioOutputFormat, setAudioOutputFormat] = useState('mp3');
  const [imageOutputFormat, setImageOutputFormat] = useState('png');
  const [compressScale, setCompressScale] = useState(1);
  const [imageFiles, setImageFiles] = useState({});
  const [audioFiles, setAudioFiles] = useState({});
  const [imagePreviewUrls, setImagePreviewUrls] = useState({});
  const [audioPreviewUrls, setAudioPreviewUrls] = useState({});
  const [activeImageNode, setActiveImageNode] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runningAction, setRunningAction] = useState(null);
  const [loadedWorkflowId, setLoadedWorkflowId] = useState(null);
  const [activityPhase, setActivityPhase] = useState(null);
  const [activityPhaseKey, setActivityPhaseKey] = useState(null);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputImages, setOutputImages] = useState([]);
  const [outputFilename, setOutputFilename] = useState(null);
  const [generationMs, setGenerationMs] = useState(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);
  const [error, setError] = useState(null);
  const [loraEnabled, setLoraEnabled] = useState(false);
  const [loraStrength, setLoraStrength] = useState(1);
  const [upscaleScale, setUpscaleScale] = useState(2);
  const [ttsSpeaker, setTtsSpeaker] = useState('Ryan');
  const [ttsLanguage, setTtsLanguage] = useState('Auto');
  const [ttsInstruct, setTtsInstruct] = useState('');
  const [ttsSpeed, setTtsSpeed] = useState(DEFAULT_SPEAK_SPEED);
  const [voiceDesignInstruct, setVoiceDesignInstruct] = useState('');
  const [voiceCloneRefText, setVoiceCloneRefText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [outputType, setOutputType] = useState('image');
  const [outputText, setOutputText] = useState('');
  const [asrLanguage, setAsrLanguage] = useState('auto');
  const [asrModelSize, setAsrModelSize] = useState('0.6B');
  const [vlmMode, setVlmMode] = useState('detailed');
  const [musicLyrics, setMusicLyrics] = useState('');
  const [musicSeconds, setMusicSeconds] = useState(60);
  const [musicModel, setMusicModel] = useState('redrob-tune-fast');
  const [musicBpm, setMusicBpm] = useState(120);
  const [musicKeyScale, setMusicKeyScale] = useState('E minor');
  const [musicTimeSignature, setMusicTimeSignature] = useState('4');
  const [musicLanguage, setMusicLanguage] = useState('en');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageDimensions, setImageDimensions] = useState({});
  const [audioDurations, setAudioDurations] = useState({});
  const [useAsInputTarget, setUseAsInputTarget] = useState(null);
  const [useOutputAsInputLoading, setUseOutputAsInputLoading] = useState(false);
  const generationStartRef = useRef(null);
  const prevWorkflowIdRef = useRef(null);
  const catalogSelectionRef = useRef('');
  const lastRunWorkflowIdRef = useRef(null);
  const canGenerateRef = useRef(false);
  const handleGenerateRef = useRef(() => {});

  const availableTasks = useMemo(
    () => getAvailableTasks(modality),
    [modality]
  );

  const resolvedTask = useMemo(() => {
    return availableTasks.some(entry => entry.id === task)
      ? task
      : (availableTasks[0]?.id ?? task);
  }, [availableTasks, task]);

  const isVideoMode = modality === 'video';
  const isAudioMode = modality === 'audio';

  const initialCreateSelection = inferCreateSelectionFromTask(
    initialCreateStyle ?? (isCreateStyleTask(task) ? task : 'create'),
  );

  const [createBaseModel, setCreateBaseModel] = useState(initialCreateSelection.baseModel);
  const [createStyleVariant, setCreateStyleVariant] = useState(initialCreateSelection.styleVariant);

  useEffect(() => {
    if (initialCreateStyle && resolvedTask === 'create') {
      const selection = inferCreateSelectionFromTask(initialCreateStyle);
      setCreateBaseModel(selection.baseModel);
      setCreateStyleVariant(selection.styleVariant);
    }
  }, [initialCreateStyle, resolvedTask]);

  const workflowTask = useMemo(() => {
    if (resolvedTask === 'create') {
      return resolveCreateWorkflowTask(createBaseModel, createStyleVariant);
    }
    return resolvedTask;
  }, [resolvedTask, createBaseModel, createStyleVariant]);

  const engine = resolvedTask === 'music' ? 'redrob-tune' : 'quality';

  const selectedWorkflow = useMemo(() => {
    return resolveWorkflow({ modality, task: workflowTask, engine });
  }, [modality, workflowTask, engine]);


  const resolvedPromptNode = selectedWorkflow?.promptNode ?? null;
  const resolvedPromptField = selectedWorkflow?.promptField ?? 'text';
  const resolvedNegativePromptNode = selectedWorkflow?.negativePromptNode ?? null;
  const resolvedNegativePromptField = selectedWorkflow?.negativePromptField ?? 'text';
  const showNegativePrompt = Boolean(resolvedNegativePromptNode);

  const currentTaskMeta = useMemo(
    () => getTaskMeta(modality, resolvedTask),
    [modality, resolvedTask]
  );

  const isUpscaleTask = resolvedTask === 'upscale';
  const isCompressImageTask = resolvedTask === 'compress-image';
  const isTranscribeTask = resolvedTask === 'transcribe';
  const isMusicTask = resolvedTask === 'music';
  const isExtractAudioTask = resolvedTask === 'extract-audio';
  const isConvertAudioTask = resolvedTask === 'convert-audio';
  const isConvertImageTask = resolvedTask === 'convert-image';
  const isSpeakTask = resolvedTask === 'speak';
  const isVoiceCloneTask = resolvedTask === 'voice-clone';
  const isVoiceDesignTask = resolvedTask === 'voice-design';
  const isVisionTask = resolvedTask === 'vision';
  const isAudioTtsTask = isSpeakTask || isVoiceCloneTask || isVoiceDesignTask;
  const currentAudioSupported = useMemo(() => {
    if (!audioCapabilities) {
      return null;
    }
    if (isSpeakTask) {
      return audioCapabilities.speak;
    }
    if (isVoiceCloneTask) {
      return audioCapabilities.voiceClone;
    }
    if (isVoiceDesignTask) {
      return audioCapabilities.voiceDesign;
    }
    return true;
  }, [audioCapabilities, isSpeakTask, isVoiceCloneTask, isVoiceDesignTask]);
  const isPhotoTask = Boolean(selectedWorkflow?.requiresImage && !isVideoMode && !isAudioMode);
  const imageUploadOptional = false;
  const needsImageUpload = Boolean(selectedWorkflow?.requiresImage);
  const imageUploadRequired = Boolean(selectedWorkflow?.requiresImage);
  const needsAudioUpload = Boolean(selectedWorkflow?.requiresAudio);
  const needsVideoUpload = Boolean(selectedWorkflow?.requiresVideo);
  const hidePrompt = Boolean(selectedWorkflow?.ui?.hidePrompt);
  const hideAspectRatio = Boolean(selectedWorkflow?.ui?.hideAspectRatio);
  const requiresPrompt = selectedWorkflow?.requiresPrompt !== false;

  const isModelReady = loadedWorkflowId === selectedWorkflow?.id;

  const generationPrompt = useMemo(() => {
    if (!requiresPrompt) {
      // Optional-prompt tools (vision, etc.): pass the user's text through.
      // Do not inject a placeholder — VLM analysis modes only apply when custom_prompt is empty.
      return String(prompt ?? '').trim();
    }

    return String(prompt ?? '').trim();
  }, [requiresPrompt, prompt]);

  const clearError = useCallback(() => setError(null), []);

  const primaryImageNode =
    selectedWorkflow?.imageInputs?.find(input => input.required)?.node ??
    selectedWorkflow?.imageNode ??
    null;

  const primaryAudioNode =
    selectedWorkflow?.audioInputs?.find(input => input.required)?.node ??
    selectedWorkflow?.audioNode ??
    null;

  const primaryVideoNode = selectedWorkflow?.videoInputs?.[0]?.node ?? null;

  const primaryAudioInputs = useMemo(
    () => selectedWorkflow?.audioInputs ?? (primaryAudioNode ? [{ node: primaryAudioNode, label: 'Reference audio', required: true }] : []),
    [selectedWorkflow?.audioInputs, primaryAudioNode],
  );

  const primaryVideoInputs = useMemo(
    () => selectedWorkflow?.videoInputs ?? (primaryVideoNode ? [{ node: primaryVideoNode, label: 'Video', required: true }] : []),
    [selectedWorkflow?.videoInputs, primaryVideoNode],
  );

  const dimensionSourceNode = selectedWorkflow?.outputSize?.sourceNode ?? primaryImageNode;

  const dimensionSourceSize = dimensionSourceNode
    ? (imageDimensions[dimensionSourceNode] ?? null)
    : null;

  const upscaleScaleOptions = useMemo(
    () => selectedWorkflow?.upscale?.scales ?? [2, 3, 4],
    [selectedWorkflow?.upscale?.scales],
  );

  const upscaleOutputSize = useMemo(() => {
    if (!isUpscaleTask || !dimensionSourceSize) {
      return null;
    }

    return {
      width: Math.round(dimensionSourceSize.width * upscaleScale),
      height: Math.round(dimensionSourceSize.height * upscaleScale),
    };
  }, [isUpscaleTask, dimensionSourceSize, upscaleScale]);

  const buildUpscaleSettings = useCallback(
    (sourceSize = dimensionSourceSize) => {
      if (!selectedWorkflow?.upscale) {
        return undefined;
      }

      const width = sourceSize?.width ?? dimensionSourceSize?.width;
      const height = sourceSize?.height ?? dimensionSourceSize?.height;

      if (!width || !height) {
        return {
          scale: upscaleScale,
        };
      }

      return {
        scale: upscaleScale,
        sourceWidth: width,
        sourceHeight: height,
      };
    },
    [
      selectedWorkflow?.upscale,
      dimensionSourceSize,
      upscaleScale,
    ],
  );

  const buildTtsSettings = useCallback(() => {
    if (!selectedWorkflow?.tts) {
      return undefined;
    }

    const mode = selectedWorkflow.tts.mode ?? 'customVoice';

    if (mode === 'voiceDesign') {
      return {
        language: ttsLanguage,
        voiceInstruct: voiceDesignInstruct,
        pauseStyle: DEFAULT_SPEAK_PAUSE_STYLE,
        unloadModels: false,
      };
    }

    if (mode === 'voiceClone') {
      return {
        language: ttsLanguage,
        refText: voiceCloneRefText,
        pauseStyle: DEFAULT_SPEAK_PAUSE_STYLE,
        unloadModels: false,
      };
    }

    return {
      speaker: ttsSpeaker,
      language: ttsLanguage,
      instruct: buildSpeakInstruct({
        speedId: ttsSpeed,
        toneInstruct: ttsInstruct,
        pauseStyle: DEFAULT_SPEAK_PAUSE_STYLE,
      }),
      pauseStyle: DEFAULT_SPEAK_PAUSE_STYLE,
      unloadModels: false,
    };
  }, [
    selectedWorkflow?.tts,
    ttsSpeaker,
    ttsLanguage,
    ttsInstruct,
    ttsSpeed,
    voiceDesignInstruct,
    voiceCloneRefText,
  ]);

  const buildImageExportSettings = useCallback(() => {
    const exportConfig = selectedWorkflow?.imageConvert ?? selectedWorkflow?.imageCompress;
    if (!exportConfig) {
      return undefined;
    }

    return { format: imageOutputFormat };
  }, [selectedWorkflow, imageOutputFormat]);

  const buildCompressSettings = useCallback(() => {
    if (!selectedWorkflow?.imageCompress) {
      return undefined;
    }

    return { scale: compressScale };
  }, [selectedWorkflow?.imageCompress, compressScale]);

  const buildAsrSettings = useCallback(() => {
    if (!selectedWorkflow?.asr) {
      return undefined;
    }

    return {
      modelSize: asrModelSize,
      language: asrLanguage,
    };
  }, [selectedWorkflow?.asr, asrModelSize, asrLanguage]);

  const buildVlmSettings = useCallback(() => {
    if (!selectedWorkflow?.vlm) {
      return undefined;
    }

    return {
      mode: vlmMode,
    };
  }, [selectedWorkflow?.vlm, vlmMode]);

  const buildMusicSettings = useCallback(() => {
    if (!selectedWorkflow?.music) {
      return undefined;
    }

    return {
      lyrics: musicLyrics,
      seconds: musicSeconds,
      modelVersion: musicModel,
      bpm: musicBpm,
      keyScale: musicKeyScale,
      timeSignature: musicTimeSignature,
      language: musicLanguage,
    };
  }, [
    selectedWorkflow?.music,
    musicLyrics,
    musicSeconds,
    musicModel,
    musicBpm,
    musicKeyScale,
    musicTimeSignature,
    musicLanguage,
  ]);

  const hasRequiredAudio = useMemo(() => {
    if (!selectedWorkflow?.requiresAudio) {
      return true;
    }

    if (selectedWorkflow.audioInputs?.length) {
      return selectedWorkflow.audioInputs
        .filter(input => input.required)
        .every(input => audioFiles[input.node]);
    }

    return Boolean(primaryAudioNode && audioFiles[primaryAudioNode]);
  }, [selectedWorkflow, audioFiles, primaryAudioNode]);

  const hasRequiredImages = useMemo(() => {
    if (!selectedWorkflow?.requiresImage) {
      return true;
    }

    if (selectedWorkflow.imageInputs?.length) {
      return selectedWorkflow.imageInputs
        .filter(input => input.required)
        .every(input => imageFiles[input.node]);
    }

    return Boolean(primaryImageNode && imageFiles[primaryImageNode]);
  }, [selectedWorkflow, imageFiles, primaryImageNode]);

  const getImageFilesForRun = useCallback(() => {
    if (!selectedWorkflow?.requiresImage) {
      return undefined;
    }

    if (selectedWorkflow.imageInputs?.length) {
      return Object.fromEntries(
        selectedWorkflow.imageInputs
          .filter(({ node }) => imageFiles[node])
          .map(({ node }) => [node, imageFiles[node]])
      );
    }

    if (primaryImageNode && imageFiles[primaryImageNode]) {
      return { [primaryImageNode]: imageFiles[primaryImageNode] };
    }

    return undefined;
  }, [selectedWorkflow, imageFiles, primaryImageNode]);

  const getAudioFilesForRun = useCallback(() => {
    // Collect declared audio inputs even when audio is optional, so an uploaded
    // file is still sent to ComfyUI.
    if (selectedWorkflow?.audioInputs?.length) {
      const files = Object.fromEntries(
        selectedWorkflow.audioInputs
          .filter(({ node }) => audioFiles[node])
          .map(({ node }) => [node, audioFiles[node]]),
      );
      return Object.keys(files).length > 0 ? files : undefined;
    }

    if (!selectedWorkflow?.requiresAudio) {
      return undefined;
    }

    const fallbackNode =
      primaryAudioNode ?? selectedWorkflow.asr?.loadAudioNode ?? selectedWorkflow.audioNode;
    if (fallbackNode && audioFiles[fallbackNode]) {
      return { [fallbackNode]: audioFiles[fallbackNode] };
    }

    return undefined;
  }, [selectedWorkflow, audioFiles, primaryAudioNode]);

  const hasRequiredVideo = useMemo(() => {
    if (!selectedWorkflow?.requiresVideo) {
      return true;
    }
    if (selectedWorkflow.videoInputs?.length) {
      return selectedWorkflow.videoInputs
        .filter(input => input.required)
        .every(input => videoFiles[input.node]);
    }
    return Boolean(primaryVideoNode && videoFiles[primaryVideoNode]);
  }, [selectedWorkflow, videoFiles, primaryVideoNode]);

  const getVideoFilesForRun = useCallback(() => {
    if (selectedWorkflow?.videoInputs?.length) {
      return Object.fromEntries(
        selectedWorkflow.videoInputs
          .filter(({ node }) => videoFiles[node])
          .map(({ node }) => [node, videoFiles[node]]),
      );
    }
    if (primaryVideoNode && videoFiles[primaryVideoNode]) {
      return { [primaryVideoNode]: videoFiles[primaryVideoNode] };
    }
    return undefined;
  }, [selectedWorkflow, videoFiles, primaryVideoNode]);

  const setVideoForNode = useCallback(
    (nodeId, nextFile) => {
      if (!isVideoUploadFile(nextFile)) {
        setError('error.videoFileRequired');
        return;
      }

      clearError();
      setVideoFiles(current => ({ ...current, [nodeId]: nextFile }));
      setVideoPreviewUrls(current => {
        if (current[nodeId]) {
          URL.revokeObjectURL(current[nodeId]);
        }
        return { ...current, [nodeId]: URL.createObjectURL(nextFile) };
      });
      setVideoDurations(current => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
      readVideoFileDuration(nextFile)
        .then(duration => {
          if (duration) {
            setVideoDurations(current => ({ ...current, [nodeId]: duration }));
          }
        })
        .catch(() => {});
      setOutputUrl(null);
      setOutputFilename(null);
      setOutputType('image');
      setGenerationMs(null);
    },
    [clearError],
  );

  const removeVideoForNode = useCallback(nodeId => {
    setVideoFiles(current => {
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
    setVideoPreviewUrls(current => {
      if (current[nodeId]) {
        URL.revokeObjectURL(current[nodeId]);
      }
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
    setVideoDurations(current => {
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, []);

  const clearAllVideo = useCallback(() => {
    setVideoPreviewUrls(prev => {
      Object.values(prev).forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
      return {};
    });
    setVideoFiles({});
    setVideoDurations({});
  }, []);

  const clearAllAudio = useCallback(() => {
    setAudioFiles({});
    setAudioPreviewUrls(current => {
      Object.values(current).forEach(url => URL.revokeObjectURL(url));
      return {};
    });
  }, []);

  const isAudioUploadFile = file =>
    Boolean(
      file?.type?.startsWith('audio/') ||
        /\.(wav|mp3|m4a|flac|ogg|aac|webm)$/i.test(file?.name ?? ''),
    );

  const isVideoUploadFile = file =>
    Boolean(
      file?.type?.startsWith('video/') ||
        /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file?.name ?? ''),
    );

  const setAudioForNode = useCallback(
    (nodeId, nextFile) => {
      if (!isAudioUploadFile(nextFile)) {
        setError('error.audioFileRequired');
        return;
      }

      clearError();
      setAudioFiles(current => ({ ...current, [nodeId]: nextFile }));
      setAudioPreviewUrls(current => {
        if (current[nodeId]) {
          URL.revokeObjectURL(current[nodeId]);
        }
        return { ...current, [nodeId]: URL.createObjectURL(nextFile) };
      });
      setAudioDurations(current => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
      readAudioFileDuration(nextFile)
        .then(duration => {
          if (duration) {
            setAudioDurations(current => ({ ...current, [nodeId]: duration }));
          }
        })
        .catch(() => {});
      setOutputUrl(null);
      setOutputFilename(null);
      setOutputType('image');
      setGenerationMs(null);
    },
    [clearError],
  );

  const removeAudioForNode = useCallback(nodeId => {
    setAudioFiles(current => {
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
    setAudioPreviewUrls(current => {
      if (current[nodeId]) {
        URL.revokeObjectURL(current[nodeId]);
      }
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
    setAudioDurations(current => {
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, []);

  const clearAllImages = useCallback(() => {
    setImageFiles({});
    setImageDimensions({});
    setImagePreviewUrls(current => {
      Object.values(current).forEach(url => URL.revokeObjectURL(url));
      return {};
    });
  }, []);

  const setImageForNode = useCallback(
    (nodeId, nextFile) => {
      if (!nextFile?.type?.startsWith('image/')) {
        setError('error.imageFileRequired');
        return;
      }

      clearError();
      setImageFiles(current => ({ ...current, [nodeId]: nextFile }));
      setImagePreviewUrls(current => {
        if (current[nodeId]) {
          URL.revokeObjectURL(current[nodeId]);
        }
        return { ...current, [nodeId]: URL.createObjectURL(nextFile) };
      });

      setImageDimensions(current => {
        const next = { ...current };
        delete next[nodeId];
        return next;
      });
      readImageFileDimensions(nextFile)
        .then(size => {
          setImageDimensions(current => ({ ...current, [nodeId]: size }));
        })
        .catch(() => {});

      setOutputUrl(null);
      setOutputFilename(null);
      setOutputType('image');
      setGenerationMs(null);
    },
    [clearError]
  );

  const removeImageForNode = useCallback(nodeId => {
    setImageFiles(current => {
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
    setImagePreviewUrls(current => {
      if (current[nodeId]) {
        URL.revokeObjectURL(current[nodeId]);
      }
      const next = { ...current };
      delete next[nodeId];
      return next;
    });

    setImageDimensions(current => {
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, []);

  const getDimensionsForConfig = useCallback(
    (config, sourceSize = dimensionSourceSize, baseSizeOverride) => {
      if (!config) {
        return null;
      }

      return dimensionsFromAspectRatio(aspectRatio, {
        baseSize: baseSizeOverride ?? config.baseSize,
        step: config.step,
        min: config.min ?? config.widthMin,
        max: config.max ?? config.widthMax ?? 1280,
        squareSize: config.squareSize,
        sourceWidth: sourceSize?.width,
        sourceHeight: sourceSize?.height,
      });
    },
    [aspectRatio, dimensionSourceSize]
  );

  const resolveDimensionSourceSize = useCallback(async () => {
    if (!dimensionSourceNode) {
      return null;
    }

    const cached = imageDimensions[dimensionSourceNode];
    if (cached) {
      return cached;
    }

    const file = imageFiles[dimensionSourceNode];
    if (!file) {
      return null;
    }

    try {
      const size = await readImageFileDimensions(file);
      setImageDimensions(current => ({ ...current, [dimensionSourceNode]: size }));
      return size;
    } catch {
      return null;
    }
  }, [dimensionSourceNode, imageDimensions, imageFiles]);

  const buildOutputSizeConfig = useCallback(
    (sourceSize = dimensionSourceSize, prompt = '') => {
      const sizeConfig = selectedWorkflow?.outputSize ?? null;
      if (!sizeConfig || isVideoMode || isAudioMode) {
        return undefined;
      }

      const baseSize = sizeConfig.baseSize;
      const { width, height } = getDimensionsForConfig(sizeConfig, sourceSize, baseSize);

      return {
        node: sizeConfig.node,
        alsoNodes: sizeConfig.alsoNodes ?? [],
        width,
        height,
      };
    },
    [
      selectedWorkflow,
      isVideoMode,
      isAudioMode,
      getDimensionsForConfig,
      dimensionSourceSize,
    ]
  );

  const buildVideoRunConfig = useCallback(() => undefined, []);

  const aspectRatioConfig = selectedWorkflow?.outputSize ?? null;

  const outputDimensions = aspectRatioConfig ? getDimensionsForConfig(aspectRatioConfig) : null;

  const commitVideoInputs = () => {};

  const visibleImageInputs = useMemo(() => {
    return selectedWorkflow?.imageInputs ?? [];
  }, [selectedWorkflow]);

  const primaryImageInputs = useMemo(() => {
    const layout = selectedWorkflow?.ui?.imageLayout;
    if (layout === 'dual-peer') {
      return visibleImageInputs.filter(input => input.required);
    }
    if (layout === 'single-primary' && visibleImageInputs.length > 0) {
      return visibleImageInputs.filter(input => input.required);
    }
    // "multi" and other layouts: show every slot (optional extras included).
    if (visibleImageInputs.length > 0) {
      return visibleImageInputs;
    }
    return [];
  }, [selectedWorkflow, visibleImageInputs]);

  const useAsInputOptions = useMemo(() => {
    if (visibleImageInputs.length > 0) {
      return visibleImageInputs;
    }

    if (primaryImageNode) {
      return [{ node: primaryImageNode, label: 'Primary' }];
    }

    return [];
  }, [visibleImageInputs, primaryImageNode]);

  useEffect(() => {
    const defaultTarget =
      useAsInputOptions.find(input => input.required)?.node ?? useAsInputOptions[0]?.node ?? null;
    setUseAsInputTarget(defaultTarget);
  }, [selectedWorkflow?.id, useAsInputOptions]);

  const workflowRunOptions = (sourceSize = dimensionSourceSize, { imageFilesOverride, prompt } = {}) => ({
    workflowId: selectedWorkflow.id,
    imageFiles: imageFilesOverride ?? getImageFilesForRun(),
    imageInputs: selectedWorkflow.imageInputs ?? undefined,
    audioFiles: getAudioFilesForRun(),
    audioInputs: selectedWorkflow.audioInputs ?? undefined,
    audioNode:
      selectedWorkflow.audioNode ??
      selectedWorkflow.asr?.loadAudioNode ??
      undefined,
    videoFiles: getVideoFilesForRun(),
    videoInputs: selectedWorkflow.videoInputs ?? undefined,
    // baseWorkflow kept for server-side callers; browser generate strips graphs.
    baseWorkflow: selectedWorkflow.workflow,
    imageNode: selectedWorkflow.imageNode,
    promptNode: resolvedPromptNode,
    promptField: resolvedPromptField,
    negativePromptNode: resolvedNegativePromptNode ?? undefined,
    negativePromptField: resolvedNegativePromptField,
    requiresImage: selectedWorkflow.requiresImage,
    requiresAudio: selectedWorkflow.requiresAudio ?? false,
    requiresVideo: selectedWorkflow.requiresVideo ?? false,
    lora: selectedWorkflow.lora,
    loraEnabled: selectedWorkflow.lora ? loraEnabled : undefined,
    loraStrength: selectedWorkflow.lora && loraEnabled ? loraStrength : undefined,
    checkpoint: selectedWorkflow.checkpoint ?? undefined,
    video: buildVideoRunConfig(sourceSize),
    outputSize: buildOutputSizeConfig(sourceSize, prompt),
    samplerNode: selectedWorkflow.samplerNode ?? undefined,
    clipEncodeNodes: selectedWorkflow.clipEncodeNodes ?? undefined,
    sampler: selectedWorkflow.sampler ?? undefined,
    upscale: selectedWorkflow.upscale ?? undefined,
    upscaleSettings: buildUpscaleSettings(sourceSize),
    tts: selectedWorkflow.tts ?? undefined,
    ttsSettings: buildTtsSettings(),
    asr: selectedWorkflow.asr ?? undefined,
    asrSettings: buildAsrSettings(),
    vlm: selectedWorkflow.vlm ?? undefined,
    vlmSettings: buildVlmSettings(),
    music: selectedWorkflow.music ?? undefined,
    musicSettings: buildMusicSettings(),
    videoExtract: selectedWorkflow.videoExtract ?? undefined,
    audioConvert: selectedWorkflow.audioConvert ?? undefined,
    audioConvertSettings: { format: audioOutputFormat },
    imageConvert: selectedWorkflow.imageConvert ?? undefined,
    imageConvertSettings: buildImageExportSettings(),
    imageCompress: selectedWorkflow.imageCompress ?? undefined,
    imageCompressSettings: buildCompressSettings(),
    historyTimeoutMs:
      selectedWorkflow.tts?.historyTimeoutMs ??
      selectedWorkflow.asr?.historyTimeoutMs ??
      selectedWorkflow.vlm?.historyTimeoutMs ??
      selectedWorkflow.music?.historyTimeoutMs ??
      selectedWorkflow.videoExtract?.historyTimeoutMs,
    onProgress: ({ value, max, error: progressError }) => {
      if (progressError) {
        return;
      }
      if (typeof value === 'number' && typeof max === 'number' && max > 0) {
        setProgress(Math.min(100, Math.round((value / max) * 100)));
      }
    },
    onExecuting: nodeId => {
      if (nodeId === null) {
        setActivityPhase(null);
        setActivityPhaseKey(null);
        return;
      }
      setActivityPhase(getExecutingPhaseLabel(nodeId, selectedWorkflow.workflow));
      setActivityPhaseKey(getExecutingPhaseKey(nodeId, selectedWorkflow.workflow));
    },
  });

  const beginRun = action => {
    clearError();
    setIsRunning(true);
    setRunningAction(action);
    setProgress(0);
    setActivityPhase(null);
    setActivityPhaseKey(null);
    generationStartRef.current = performance.now();
    setLiveElapsedMs(0);
  };

  const endRun = () => {
    abortControllerRef.current = null;
    setIsRunning(false);
    setRunningAction(null);
    setActivityPhase(null);
    setActivityPhaseKey(null);
  };

  const applyWorkflow = (nextWorkflow, { clearImages = false, preservePrompt = false, preserveNegativePrompt = false, preserveAspectRatio = false } = {}) => {
    if (!nextWorkflow) {
      return;
    }

    if (!preservePrompt) {
      setPrompt(nextWorkflow.defaultPrompt ?? '');
    }
    if (!preserveNegativePrompt) {
      setNegativePrompt(nextWorkflow.defaultNegativePrompt ?? '');
    }
    if (nextWorkflow.outputSize) {
      const allowed = (nextWorkflow.outputSize.aspectRatios ?? []).map(entry => entry.id);
      const keepCurrent =
        preserveAspectRatio &&
        Boolean(aspectRatio) &&
        (allowed.length === 0 || allowed.includes(aspectRatio));
      if (!keepCurrent) {
        setAspectRatio(nextWorkflow.outputSize.defaultAspectRatio);
      }
    }
    if (clearImages) {
      clearAllImages();
      clearAllAudio();
      clearAllVideo();
    }
    clearError();
    setOutputUrl(null);
    setOutputImages([]);
    setOutputFilename(null);
    setOutputText('');
    setOutputType('image');
    setGenerationMs(null);

    if (nextWorkflow.tts) {
      const mode = nextWorkflow.tts.mode ?? 'customVoice';
      if (mode === 'voiceDesign') {
        setTtsLanguage(nextWorkflow.tts.defaultLanguage ?? 'Auto');
        setVoiceDesignInstruct('');
      } else if (mode === 'voiceClone') {
        setTtsLanguage(nextWorkflow.tts.defaultLanguage ?? 'Auto');
        setVoiceCloneRefText('');
      } else {
        setTtsSpeaker(nextWorkflow.tts.defaultSpeaker ?? 'Ryan');
        setTtsLanguage(nextWorkflow.tts.defaultLanguage ?? 'Auto');
        setTtsInstruct('');
        setTtsSpeed(DEFAULT_SPEAK_SPEED);
      }
    }

    if (nextWorkflow.imageConvert?.defaultFormat) {
      setImageOutputFormat(nextWorkflow.imageConvert.defaultFormat);
    } else if (nextWorkflow.imageCompress?.defaultFormat) {
      setImageOutputFormat(nextWorkflow.imageCompress.defaultFormat);
    }

    if (nextWorkflow.audioConvert?.defaultFormat) {
      setAudioOutputFormat(nextWorkflow.audioConvert.defaultFormat);
    }

    if (nextWorkflow.imageCompress?.defaultScale != null) {
      setCompressScale(nextWorkflow.imageCompress.defaultScale);
    }

    if (!nextWorkflow.requiresImage) {
      setImageDimensions({});
    }
  };

  const handleAudioDrop = useCallback(
    (event, targetNode = null) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (!dropped) {
        return;
      }

      const nodeId =
        targetNode ??
        primaryAudioNode ??
        selectedWorkflow?.audioInputs?.[0]?.node ??
        selectedWorkflow?.audioNode;
      if (nodeId) {
        setAudioForNode(nodeId, dropped);
      }
    },
    [primaryAudioNode, selectedWorkflow, setAudioForNode],
  );

  const handleVideoDrop = useCallback(
    (event, targetNode = null) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (!dropped) {
        return;
      }

      const nodeId =
        targetNode ??
        primaryVideoNode ??
        selectedWorkflow?.videoInputs?.[0]?.node;
      if (nodeId) {
        setVideoForNode(nodeId, dropped);
      }
    },
    [primaryVideoNode, selectedWorkflow, setVideoForNode],
  );

  const handleDrop = useCallback(
    (event, targetNode = null) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (!dropped) {
        return;
      }

      const nodeId =
        targetNode ??
        primaryImageNode ??
        selectedWorkflow?.imageInputs?.[0]?.node ??
        selectedWorkflow?.imageNode;
      if (nodeId) {
        setImageForNode(nodeId, dropped);
      }
    },
    [primaryImageNode, selectedWorkflow, setImageForNode]
  );

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleUseOutputAsInput = async () => {
    const targetNodeId = useAsInputTarget ?? primaryImageNode;
    if (!outputUrl || outputType !== 'image' || !targetNodeId) {
      return;
    }

    clearError();
    setUseOutputAsInputLoading(true);

    try {
      const file = await fetchUrlAsImageFile(outputUrl, outputFilename ?? 'edited-output.png');
      setImageForNode(targetNodeId, file);
    } catch (err) {
      setError(formatUserFacingError(err instanceof Error ? err.message : 'Could not use output as input.'));
    } finally {
      setUseOutputAsInputLoading(false);
    }
  };

  const handlePreload = async () => {
    if (!selectedWorkflow) {
      setError('error.noWorkflow');
      return;
    }
    if (imageUploadRequired && !hasRequiredImages) {
      setError('error.uploadPhoto');
      return;
    }
    if (selectedWorkflow.requiresAudio && !hasRequiredAudio) {
      setError(isTranscribeTask ? 'error.uploadAudioTranscribe' : 'error.uploadReferenceVoice');
      return;
    }
    if (selectedWorkflow.requiresVideo && !hasRequiredVideo) {
      setError('error.uploadVideo');
      return;
    }

    commitVideoInputs();

    const sourceSize =
      aspectRatio === 'original' ? await resolveDimensionSourceSize() : dimensionSourceSize;

    beginRun('preload');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await preloadModel({
        ...workflowRunOptions(sourceSize),
        signal: controller.signal,
        freeBeforeRun: true,
      });
      setLoadedWorkflowId(selectedWorkflow.id);
      setProgress(100);
    } catch (err) {
      if (err instanceof GenerationInProgressError || err?.name === 'GenerationInProgressError') {
        setError('error.runInProgress');
      } else if (err instanceof GenerationStoppedError || err?.name === 'GenerationStoppedError') {
        setError('error.preparationStopped');
      } else {
        setError(formatUserFacingError(err instanceof Error ? err.message : 'Preparation failed.'));
      }
      setProgress(0);
    } finally {
      endRun();
    }
  };

  const handleGenerate = async () => {
    if (!selectedWorkflow) {
      setError('error.noWorkflow');
      return;
    }
    if (imageUploadRequired && !hasRequiredImages) {
      setError('error.uploadPhoto');
      return;
    }
    if (selectedWorkflow.requiresAudio && !hasRequiredAudio) {
      setError(isTranscribeTask ? 'error.uploadAudioTranscribe' : 'error.uploadReferenceVoice');
      return;
    }
    if (selectedWorkflow.requiresVideo && !hasRequiredVideo) {
      setError('error.uploadVideo');
      return;
    }
    if (requiresPrompt && !generationPrompt) {
      setError('error.enterPrompt');
      return;
    }
    if (isAudioTtsTask && currentAudioSupported === false) {
      setError(`error.audioMissingNode.${resolvedTask}`);
      return;
    }
    if (isVoiceDesignTask && !voiceDesignInstruct.trim()) {
      setError('error.describeVoice');
      return;
    }
    if (isVoiceCloneTask && !voiceCloneRefText.trim()) {
      setError('error.enterReferenceTranscript');
      return;
    }

    commitVideoInputs();

    const sourceSize =
      aspectRatio === 'original' ? await resolveDimensionSourceSize() : dimensionSourceSize;

    const shouldFreeBeforeRun =
      lastRunWorkflowIdRef.current !== null &&
      lastRunWorkflowIdRef.current !== selectedWorkflow.id;

    beginRun('generate');
    setOutputUrl(null);
    setOutputImages([]);
    setOutputFilename(null);
    setOutputText('');
    setOutputType('image');
    setGenerationMs(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const outputModality = selectedWorkflow.outputType ?? 'image';

    try {
      let runPrompt = generationPrompt;

      const result = await generateImage({
        ...workflowRunOptions(sourceSize, { prompt: runPrompt }),
        prompt: runPrompt,
        negativePrompt: negativePrompt.trim(),
        signal: controller.signal,
        outputType: outputModality,
        freeBeforeRun: shouldFreeBeforeRun,
        // Keep video/audio models resident between consecutive runs of the same tool so
        // re-renders don't reload large checkpoints each time. Switching tools
        // still frees via freeBeforeRun. Image runs unload as before.
        unloadAfter: outputModality === 'image',
      });

      if (shouldFreeBeforeRun) {
        setLoadedWorkflowId(null);
      }

      const resultType = result.outputType ?? outputModality;
      setOutputType(resultType);
      if (resultType === 'text') {
        setOutputText(result.text ?? '');
        setOutputUrl(null);
        setOutputImages([]);
        setOutputFilename(null);
      } else {
        setOutputText('');
        setOutputUrl(result.url);
        setOutputImages(result.images ?? (result.url ? [{ url: result.url, filename: result.image?.filename }] : []));
        setOutputFilename(result.image?.filename ?? result.video?.filename ?? result.audio?.filename ?? null);
      }
      setLoadedWorkflowId(selectedWorkflow.id);
      lastRunWorkflowIdRef.current = selectedWorkflow.id;
      setProgress(100);
      if (generationStartRef.current !== null) {
        setGenerationMs(performance.now() - generationStartRef.current);
      }
    } catch (err) {
      if (err instanceof GenerationInProgressError || err?.name === 'GenerationInProgressError') {
        setError('error.generationInProgress');
      } else if (err instanceof GenerationStoppedError || err?.name === 'GenerationStoppedError') {
        setError('error.generationStopped');
      } else {
        setError(formatUserFacingError(err instanceof Error ? err.message : 'Generation failed.'));
      }
      setProgress(0);
    } finally {
      endRun();
    }
  };

  const canRun =
    comfyOnline === true && Boolean(selectedWorkflow) && !isRunning && !isComfyGenerating();

  const canPreload =
    canRun &&
    !isModelReady &&
    (!imageUploadRequired || hasRequiredImages) &&
    (!selectedWorkflow?.requiresAudio || hasRequiredAudio) &&
    (!selectedWorkflow?.requiresVideo || hasRequiredVideo);

  const canGenerate =
    canRun &&
    (!requiresPrompt || Boolean(generationPrompt)) &&
    (!isVoiceDesignTask || Boolean(voiceDesignInstruct.trim())) &&
    (!isVoiceCloneTask || Boolean(voiceCloneRefText.trim())) &&
    (!imageUploadRequired || hasRequiredImages) &&
    (!selectedWorkflow?.requiresAudio || hasRequiredAudio) &&
    (!selectedWorkflow?.requiresVideo || hasRequiredVideo) &&
    (!isAudioTtsTask || currentAudioSupported !== false);

  canGenerateRef.current = canGenerate;
  handleGenerateRef.current = handleGenerate;

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      if (canGenerateRef.current) {
        void handleGenerateRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isRunning || generationStartRef.current === null) {
      return;
    }

    const tick = () => {
      setLiveElapsedMs(performance.now() - generationStartRef.current);
    };

    tick();
    const intervalId = setInterval(tick, 100);
    return () => clearInterval(intervalId);
  }, [isRunning]);

  useEffect(() => {
    setLoraEnabled(selectedWorkflow?.lora?.defaultEnabled ?? false);
    setLoraStrength(selectedWorkflow?.lora?.strength ?? 1);
    setUpscaleScale(selectedWorkflow?.upscale?.defaultScale ?? 2);
    setAsrLanguage(selectedWorkflow?.asr?.defaultLanguage ?? 'auto');
    setAsrModelSize(selectedWorkflow?.asr?.defaultModelSize ?? '0.6B');
    setVlmMode(selectedWorkflow?.vlm?.defaultMode ?? 'detailed');
    setMusicLyrics('');
    setMusicSeconds(selectedWorkflow?.music?.defaultSeconds ?? 60);
    setMusicModel(selectedWorkflow?.music?.defaultModelVersion ?? 'redrob-tune-fast');
    setMusicBpm(selectedWorkflow?.music?.defaultBpm ?? 120);
    setMusicKeyScale(selectedWorkflow?.music?.defaultKeyScale ?? 'E minor');
    setMusicTimeSignature(selectedWorkflow?.music?.defaultTimeSignature ?? '4');
    setMusicLanguage(selectedWorkflow?.music?.defaultLanguage ?? 'en');
    setTtsSpeaker(selectedWorkflow?.tts?.defaultSpeaker ?? 'Ryan');
    setTtsLanguage(selectedWorkflow?.tts?.defaultLanguage ?? 'Auto');
    setTtsInstruct('');
    setTtsSpeed(DEFAULT_SPEAK_SPEED);
  }, [selectedWorkflow?.id, selectedWorkflow?.lora?.strength, selectedWorkflow?.lora?.defaultEnabled, selectedWorkflow?.upscale?.defaultScale, selectedWorkflow?.tts?.defaultSpeaker, selectedWorkflow?.tts?.defaultLanguage]);

  useEffect(() => {
    if (!selectedWorkflow) {
      return;
    }

    const selectionKey = `${modality}:${resolvedTask}:${workflowTask}:${engine}`;
    const workflowChanged =
      catalogSelectionRef.current !== '' && catalogSelectionRef.current !== selectionKey;
    const wasCreate =
      resolvedTask === 'create' &&
      catalogSelectionRef.current.startsWith(`${modality}:create:`);
    catalogSelectionRef.current = selectionKey;

    applyWorkflow(selectedWorkflow, {
      clearImages: workflowChanged,
      preservePrompt: wasCreate && workflowChanged,
      preserveNegativePrompt: wasCreate && workflowChanged,
      preserveAspectRatio: wasCreate && workflowChanged,
    });
  }, [selectedWorkflow?.id, modality, resolvedTask, workflowTask, engine]);

  useEffect(() => {
    setLoadedWorkflowId(null);
  }, [
    loraEnabled,
    loraStrength,
    upscaleScale,
    ttsSpeaker,
    ttsLanguage,
    ttsInstruct,
    ttsSpeed,
    compressScale,
    asrLanguage,
    asrModelSize,
    musicLyrics,
    musicSeconds,
    musicModel,
    musicBpm,
    musicKeyScale,
    musicTimeSignature,
    musicLanguage,
    selectedWorkflow?.id,
  ]);

  useEffect(() => {
    const workflowId = selectedWorkflow?.id;
    if (!workflowId || prevWorkflowIdRef.current === workflowId) {
      return;
    }

    if (prevWorkflowIdRef.current) {
      void freeMemory();
    }
    prevWorkflowIdRef.current = workflowId;
    setLoadedWorkflowId(null);
  }, [selectedWorkflow?.id]);

  useEffect(() => {
    if (comfyOnline === false) {
      setLoadedWorkflowId(null);
    }
  }, [comfyOnline]);

  useEffect(() => {
    document.title = getPageTitle({
      isRunning,
      runningAction,
      activityPhase,
      progress,
      runningLabel: currentTaskMeta?.runningLabel,
      isVideoMode,
      isAudioMode,
      comfyOnline,
    });

    return () => {
      document.title = PAGE_TITLE;
    };
  }, [isRunning, runningAction, activityPhase, progress, currentTaskMeta, isVideoMode, isAudioMode, comfyOnline]);

  return {
    workflowOptions,
    modality,
    resolvedTask,
    createBaseModel,
    setCreateBaseModel,
    createStyleVariant,
    setCreateStyleVariant,
    selectedWorkflow,
    currentTaskMeta,
    isVideoMode,
    isAudioMode,
    isUpscaleTask,
    isCompressImageTask,
    isTranscribeTask,
    isMusicTask,
    isExtractAudioTask,
    isConvertAudioTask,
    isConvertImageTask,
    isSpeakTask,
    isVoiceCloneTask,
    isVoiceDesignTask,
    isVisionTask,
    isAudioTtsTask,
    currentAudioSupported,
    isPhotoTask,
    needsImageUpload,
    imageUploadOptional,
    imageUploadRequired,
    needsAudioUpload,
    needsVideoUpload,
    hidePrompt,
    hideAspectRatio,
    showNegativePrompt,
    requiresPrompt,
    isModelReady,
    generationPrompt,
    clearError,
    primaryImageNode,
    primaryAudioNode,
    primaryVideoNode,
    primaryAudioInputs,
    primaryVideoInputs,
    dimensionSourceNode,
    dimensionSourceSize,
    upscaleScaleOptions,
    upscaleOutputSize,
    aspectRatioConfig,
    outputDimensions,
    visibleImageInputs,
    primaryImageInputs,
    useAsInputOptions,
    commitVideoInputs,
    inputRef,
    audioInputRef,
    videoInputRef,
    videoFiles,
    videoPreviewUrls,
    audioOutputFormat,
    setAudioOutputFormat,
    imageOutputFormat,
    setImageOutputFormat,
    compressScale,
    setCompressScale,
    imageFiles,
    audioFiles,
    imagePreviewUrls,
    audioPreviewUrls,
    activeImageNode,
    setActiveImageNode,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    isRunning,
    runningAction,
    activityPhase,
    activityPhaseKey,
    progress,
    outputUrl,
    outputImages,
    outputFilename,
    generationMs,
    liveElapsedMs,
    error,
    loraEnabled,
    setLoraEnabled,
    loraStrength,
    setLoraStrength,
    upscaleScale,
    setUpscaleScale,
    ttsSpeaker,
    setTtsSpeaker,
    ttsLanguage,
    setTtsLanguage,
    ttsInstruct,
    setTtsInstruct,
    ttsSpeed,
    setTtsSpeed,
    voiceDesignInstruct,
    setVoiceDesignInstruct,
    voiceCloneRefText,
    setVoiceCloneRefText,
    isDragging,
    setIsDragging,
    outputType,
    outputText,
    asrLanguage,
    setAsrLanguage,
    asrModelSize,
    setAsrModelSize,
    vlmMode,
    setVlmMode,
    musicLyrics,
    setMusicLyrics,
    musicSeconds,
    setMusicSeconds,
    musicModel,
    setMusicModel,
    musicBpm,
    setMusicBpm,
    musicKeyScale,
    setMusicKeyScale,
    musicTimeSignature,
    setMusicTimeSignature,
    musicLanguage,
    setMusicLanguage,
    aspectRatio,
    setAspectRatio,
    useAsInputTarget,
    setUseAsInputTarget,
    useOutputAsInputLoading,
    setImageForNode,
    removeImageForNode,
    setAudioForNode,
    removeAudioForNode,
    setVideoForNode,
    removeVideoForNode,
    handleAudioDrop,
    handleVideoDrop,
    handleDrop,
    handleStop,
    handleUseOutputAsInput,
    handlePreload,
    handleGenerate,
    canPreload,
    canGenerate,
    comfyOnline,
  };
}

