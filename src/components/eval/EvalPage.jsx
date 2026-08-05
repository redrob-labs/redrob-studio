'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import StudioHeader from '@/components/studio/StudioHeader';
import { Button } from '@/components/ui/button';
import { useStudio } from '@/context/StudioContext';
import {
  fetchImageBlob,
  generateEvalMedia,
  moderateEvalImage,
  persistEvalMedia,
  persistEvalRatings,
  persistEvalText,
  resolveEvalWorkflow,
  SAFETY_OUTCOMES,
} from '@/lib/eval/client';
import {
  emptyPreferenceRatings,
  emptySafetyRatings,
} from '@/lib/eval/ratings';
import {
  isAudioEvalWorkflow,
  isTextEvalWorkflow,
  isToolEvalSuite,
  isVideoEvalWorkflow,
  isVoiceDesignEvalSuite,
  listEvalWorkflowsForSuite,
  resolveSuiteWorkflows,
} from '@/lib/eval/workflows';
import { resolveEvalRunInputs } from '@/lib/eval/run-inputs';
import { cn } from '@/lib/utils';

function resultIsVideo(result) {
  if (result?.kind === 'video') {
    return true;
  }
  const url = result?.url ?? '';
  return (
    /\.(mp4|webm)(?:\?|$)/i.test(url) ||
    /[?&]file=[^&]*\.(mp4|webm)(?:&|$)/i.test(url) ||
    isVideoEvalWorkflow(result?.workflow)
  );
}

function resultIsAudio(result) {
  if (result?.kind === 'audio') {
    return true;
  }
  if (result?.kind === 'text') {
    return false;
  }
  const url = result?.url ?? '';
  return (
    /\.(mp3|wav|flac|ogg)(?:\?|$)/i.test(url) ||
    /[?&]file=[^&]*\.(mp3|wav|flac|ogg)(?:&|$)/i.test(url) ||
    isAudioEvalWorkflow(result?.workflow)
  );
}

function resultIsText(result) {
  return result?.kind === 'text' || Boolean(result?.text);
}

function mediaKindForWorkflow(workflow, outputType) {
  if (outputType === 'text' || isTextEvalWorkflow(workflow)) {
    return 'text';
  }
  if (outputType === 'audio' || isAudioEvalWorkflow(workflow)) {
    return 'audio';
  }
  if (outputType === 'video' || isVideoEvalWorkflow(workflow)) {
    return 'video';
  }
  return 'image';
}

function evalFixtureUrl(relativePath) {
  if (!relativePath) {
    return null;
  }
  const cleaned = String(relativePath)
    .replace(/^[/\\]+/, '')
    .replace(/^fixtures[/\\]/i, '');
  const segments = cleaned.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  return `/api/eval/fixtures/${segments.map(encodeURIComponent).join('/')}`;
}

function EvalPromptBody({ prompt }) {
  if (!prompt) {
    return null;
  }
  const hasPrompt = Boolean(prompt.prompt);
  const hasTags = Boolean(prompt.styleTags);
  const hasLyrics = Boolean(prompt.lyrics);
  const audioUrl = evalFixtureUrl(prompt.audioFixture ?? prompt.audio ?? prompt.refAudio);
  const imageUrl = evalFixtureUrl(
    prompt.fixture ?? prompt.imageFixture ?? prompt.image ?? prompt.startImage,
  );
  const donorUrl = evalFixtureUrl(prompt.donorFixture ?? prompt.faceFixture);
  const videoUrl = evalFixtureUrl(prompt.videoFixture ?? prompt.video);
  const expectedText = prompt.expectedText ?? null;
  if (
    !hasPrompt &&
    !hasTags &&
    !hasLyrics &&
    !audioUrl &&
    !imageUrl &&
    !videoUrl &&
    !expectedText
  ) {
    return null;
  }
  return (
    <div className="text-muted-foreground space-y-2 text-sm">
      {(audioUrl || imageUrl || videoUrl) && (
        <div className="flex flex-wrap items-start gap-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${prompt.id} fixture`}
              className="h-24 w-24 rounded-md border object-cover"
            />
          ) : null}
          {donorUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={donorUrl}
              alt={`${prompt.id} donor`}
              className="h-24 w-24 rounded-md border object-cover"
            />
          ) : null}
          {audioUrl ? (
            <div className="min-w-56 flex-1 space-y-1">
              <p className="text-foreground text-xs font-medium">Input audio</p>
              <audio src={audioUrl} className="w-full" controls preload="metadata" />
            </div>
          ) : null}
          {videoUrl ? (
            <div className="min-w-56 flex-1 space-y-1">
              <p className="text-foreground text-xs font-medium">Input video</p>
              <video src={videoUrl} className="max-h-32 w-full rounded-md border" controls preload="metadata" />
            </div>
          ) : null}
        </div>
      )}
      {expectedText ? (
        <div>
          <p className="text-foreground text-xs font-medium">Expected text</p>
          <p className="mt-0.5 leading-relaxed">{expectedText}</p>
        </div>
      ) : null}
      {(hasPrompt || hasTags || hasLyrics) && (
        <details open={hasLyrics || Boolean(audioUrl && hasPrompt)}>
          <summary className="cursor-pointer select-none">
            {hasLyrics ? 'Prompt & lyrics' : 'Prompt'}
          </summary>
          {hasPrompt ? <p className="mt-1 leading-relaxed">{prompt.prompt}</p> : null}
          {hasTags ? (
            <p className="mt-2">
              <span className="text-foreground font-medium">Style tags · </span>
              <span className="font-mono text-xs">{prompt.styleTags}</span>
            </p>
          ) : null}
          {hasLyrics ? (
            <pre className="bg-muted/50 mt-2 max-h-64 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">
              {prompt.lyrics}
            </pre>
          ) : null}
        </details>
      )}
    </div>
  );
}

function EvalMediaThumb({ url, alt, className, isVideo, isAudio, blur }) {
  if (!url) {
    return null;
  }
  if (isAudio) {
    return (
      <audio
        src={url}
        className={cn('w-full', className)}
        controls
        preload="metadata"
        onClick={(event) => event.stopPropagation()}
      />
    );
  }
  if (isVideo) {
    return (
      <video
        src={url}
        className={cn(className, blur && 'scale-110 blur-2xl')}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={cn(className, blur && 'scale-110 blur-2xl')}
      loading="lazy"
    />
  );
}

function moderationTone(outcome) {
  if (outcome === 'safe-output') return 'text-emerald-600 dark:text-emerald-400';
  if (outcome === 'fail-suggestive') return 'text-amber-600 dark:text-amber-400';
  if (outcome === 'fail-explicit') return 'text-destructive';
  return 'text-muted-foreground';
}

function EvalPageContent() {
  const { comfyOnline } = useStudio();
  const abortRef = useRef(null);

  const [suites, setSuites] = useState([]);
  const [runs, setRuns] = useState([]);
  const [suiteId, setSuiteId] = useState('');
  const [selectedWorkflows, setSelectedWorkflows] = useState([]);
  const [useModeration, setUseModeration] = useState(false);
  const [seed, setSeed] = useState(42);
  const [loadError, setLoadError] = useState(null);

  const [runId, setRunId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [results, setResults] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [statusError, setStatusError] = useState(null);
  const [saveNote, setSaveNote] = useState(null);
  const [viewMode, setViewMode] = useState('prompts'); // gallery | prompts
  const [thumbSize, setThumbSize] = useState('sm'); // sm | md | lg
  const [blurContents, setBlurContents] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { promptId, workflow } | null
  const [filterBase, setFilterBase] = useState('all');
  const [promptFilter, setPromptFilter] = useState('all');

  const suite = useMemo(
    () => suites.find((entry) => entry.suite === suiteId) ?? null,
    [suites, suiteId],
  );

  // Optional blur is a viewer preference (privacy while comparing), not suite-driven.
  const setBlurContentsPersist = useCallback((next) => {
    setBlurContents(next);
  }, []);
  const isSafety =
    suite?.intent === 'safety-test-sfw-only' ||
    suite?.intent === 'safety-test-full-matrix' ||
    suite?.scoring === 'safety';

  const isVideoSuite = suite?.modality === 'video';
  const isAudioSuite = suite?.modality === 'audio';
  const isTextSuite = suite?.modality === 'text';
  const isToolSuite = isToolEvalSuite(suite);
  const isVoiceDesignSuite = isVoiceDesignEvalSuite(suite);

  useEffect(() => {
    if (isTextSuite || suite?.task === 'transcribe' || suite?.task === 'vision') {
      setViewMode('prompts');
    }
  }, [suite?.suite, isTextSuite, suite?.task]);
  const catalogWorkflows = useMemo(
    () => listEvalWorkflowsForSuite(suite),
    [suite?.suite, suite?.modality, suite?.task, suite?.family, suite?.tool],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [suitesRes, runsRes] = await Promise.all([
          fetch('/api/eval/suites'),
          fetch('/api/eval/runs'),
        ]);
        const suitesData = await suitesRes.json();
        const runsData = await runsRes.json();
        if (!suitesRes.ok) {
          throw new Error(suitesData.error || 'Failed to load suites');
        }
        if (cancelled) {
          return;
        }
        setSuites(suitesData.suites ?? []);
        setRuns(runsData.runs ?? []);
        const preferred =
          (suitesData.suites ?? []).find((entry) => entry.suite === 'image-comparison') ??
          (suitesData.suites ?? [])[0];
        if (preferred?.suite) {
          setSuiteId(preferred.suite);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load eval data');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!suite) {
      return;
    }
    setSelectedWorkflows(resolveSuiteWorkflows(suite));
    // QwenVL is opt-in; force off for video/audio (image-only).
    if (suite.modality === 'video' || suite.modality === 'audio') {
      setUseModeration(false);
    }
  }, [suite?.suite]);

  const toggleWorkflow = useCallback((task) => {
    setSelectedWorkflows((prev) =>
      prev.includes(task) ? prev.filter((item) => item !== task) : [...prev, task],
    );
  }, []);

  // Workflow-first: finish every prompt on one checkpoint before switching models
  // (cuts ComfyUI unload/reload thrash vs prompt×workflow interleaving).
  // Full cartesian product: every selected workflow × every suite prompt.
  const jobs = useMemo(() => {
    if (!suite || selectedWorkflows.length === 0) {
      return [];
    }
    const list = [];
    for (const workflow of selectedWorkflows) {
      for (const prompt of suite.prompts ?? []) {
        list.push({ prompt, workflow });
      }
    }
    return list;
  }, [suite, selectedWorkflows]);

  const stopRun = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const startRun = useCallback(async () => {
    if (!suite || selectedWorkflows.length === 0 || isRunning || comfyOnline === false) {
      return;
    }

    setStatusError(null);
    setSaveNote(null);
    setIsRunning(true);
    setResults([]);
    setProgressLabel('Creating run…');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const createRes = await fetch('/api/eval/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite,
          seed: Number(seed),
          workflows: selectedWorkflows,
          includeControl: false,
          controlWorkflows: [],
          moderation: useModeration,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to create run');
      }

      const nextRunId = createData.runId;
      setRunId(nextRunId);
      setRatings(
        isSafety
          ? emptySafetyRatings(suite, selectedWorkflows)
          : emptyPreferenceRatings(suite, selectedWorkflows),
      );

      const nextResults = [];
      const fixtureCache = new Map();
      let liveRatings = isSafety
        ? emptySafetyRatings(suite, selectedWorkflows)
        : emptyPreferenceRatings(suite, selectedWorkflows);

      for (let index = 0; index < jobs.length; index += 1) {
        if (controller.signal.aborted) {
          break;
        }
        const { prompt, workflow } = jobs[index];
        setProgressLabel(
          `${index + 1}/${jobs.length} · ${workflow} · ${prompt.id}`,
        );

        try {
          let imageFile = null;
          let imageFiles = null;
          let audioFiles = null;
          let videoFiles = null;
          const resolvedWorkflow = resolveEvalWorkflow(workflow);

          if (
            isToolSuite ||
            prompt.fixture ||
            prompt.audioFixture ||
            prompt.videoFixture ||
            prompt.donorFixture ||
            prompt.imageFixtures ||
            prompt.fixtures
          ) {
            const inputs = await resolveEvalRunInputs(prompt, resolvedWorkflow, {
              cache: fixtureCache,
              onProgress: (label) =>
                setProgressLabel(`${index + 1}/${jobs.length} · ${label}`),
            });
            imageFiles = inputs.imageFiles ?? null;
            audioFiles = inputs.audioFiles ?? null;
            videoFiles = inputs.videoFiles ?? null;
          }

          const useSuitePrompt =
            isAudioSuite ||
            isVoiceDesignSuite ||
            isToolSuite ||
            isTextSuite ||
            resolvedWorkflow?.tts ||
            resolvedWorkflow?.asr ||
            resolvedWorkflow?.vlm ||
            resolvedWorkflow?.music;

          const startedAt = performance.now();
          const generated = await generateEvalMedia(workflow, {
            prompt: useSuitePrompt ? undefined : prompt.prompt,
            suitePrompt: useSuitePrompt ? prompt : undefined,
            seed: Number(seed),
            signal: controller.signal,
            imageFile: imageFile ?? undefined,
            imageFiles: imageFiles ?? undefined,
            audioFiles: audioFiles ?? undefined,
            videoFiles: videoFiles ?? undefined,
            aspectRatio: prompt.aspectRatio ?? undefined,
          });
          const generationSeconds =
            Math.round(((performance.now() - startedAt) / 1000) * 10) / 10;
          const mediaUrl = generated.url;
          const outputText = generated.text ?? null;
          const mediaKind = mediaKindForWorkflow(workflow, generated.outputType);
          let savedPath = null;
          let imageBlob = null;
          let persistedKind = mediaKind;
          if (mediaKind === 'text' && outputText != null) {
            try {
              const saved = await persistEvalText({
                runId: nextRunId,
                workflow,
                promptId: prompt.id,
                seed: Number(seed),
                text: outputText,
              });
              savedPath = saved.relativePath;
              persistedKind = 'text';
            } catch (persistError) {
              console.error(persistError);
            }
          } else if (mediaUrl) {
            try {
              const saved = await persistEvalMedia({
                runId: nextRunId,
                workflow,
                promptId: prompt.id,
                seed: Number(seed),
                mediaUrl,
              });
              savedPath = saved.relativePath;
              imageBlob = saved.blob ?? null;
              persistedKind = saved.kind ?? mediaKind;
            } catch (persistError) {
              console.error(persistError);
            }
          }

          let moderation = null;
          if (useModeration && mediaUrl && mediaKind === 'image') {
            setProgressLabel(
              `${index + 1}/${jobs.length} · QwenVL moderate · ${prompt.id}`,
            );
            try {
              if (!imageBlob) {
                imageBlob = await fetchImageBlob(mediaUrl);
              }
              moderation = await moderateEvalImage(imageBlob, {
                signal: controller.signal,
              });
              if (isSafety && moderation.outcome) {
                liveRatings = liveRatings.map((row) =>
                  row.prompt_id === prompt.id && row.workflow === workflow
                    ? {
                        ...row,
                        outcome: moderation.outcome,
                        notes: moderation.rationale ?? row.notes,
                        moderation,
                        generationSeconds,
                      }
                    : row,
                );
                setRatings([...liveRatings]);
              }
            } catch (modError) {
              if (
                modError?.name === 'AbortError' ||
                modError?.name === 'GenerationStoppedError' ||
                controller.signal.aborted
              ) {
                throw modError;
              }
              moderation = {
                outcome: null,
                confidence: null,
                rationale: modError instanceof Error ? modError.message : 'Moderation failed',
                parseError: true,
              };
            }
          }

          nextResults.push({
            key: `${prompt.id}::${workflow}`,
            promptId: prompt.id,
            workflow,
            status: 'ok',
            url: mediaUrl,
            text: outputText,
            kind: persistedKind,
            savedPath,
            error: null,
            moderation,
            generationSeconds,
          });
        } catch (error) {
          if (
            error?.name === 'AbortError' ||
            error?.name === 'GenerationStoppedError' ||
            controller.signal.aborted
          ) {
            nextResults.push({
              key: `${prompt.id}::${workflow}`,
              promptId: prompt.id,
              workflow,
              status: 'aborted',
              url: null,
              kind: mediaKindForWorkflow(workflow),
              savedPath: null,
              error: 'Stopped',
              moderation: null,
              generationSeconds: null,
            });
            break;
          }
          const message = error instanceof Error ? error.message : 'Generation failed';
          nextResults.push({
            key: `${prompt.id}::${workflow}`,
            promptId: prompt.id,
            workflow,
            status: 'error',
            url: null,
            kind: mediaKindForWorkflow(workflow),
            savedPath: null,
            error: message,
            moderation: null,
            generationSeconds: null,
          });
          // Auto-mark blocked when the pipeline refused/errored for safety suites.
          if (isSafety) {
            liveRatings = liveRatings.map((row) =>
              row.prompt_id === prompt.id && row.workflow === workflow && !row.outcome
                ? { ...row, outcome: 'blocked', notes: message }
                : row,
            );
            setRatings([...liveRatings]);
          }
        }

        setResults([...nextResults]);
      }

      if (useModeration || isSafety) {
        try {
          await persistEvalRatings(nextRunId, liveRatings);
        } catch (persistRatingsError) {
          console.error(persistRatingsError);
        }
      }

      setRuns((prev) => [
        {
          runId: nextRunId,
          suite: suite.suite,
          seed: Number(seed),
          workflows: selectedWorkflows,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setProgressLabel(controller.signal.aborted ? 'Stopped' : 'Complete');
      setSaveNote(`Saved under eval/runs/${nextRunId}`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Eval run failed');
      setProgressLabel('');
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [
    suite,
    selectedWorkflows,
    isRunning,
    comfyOnline,
    seed,
    jobs,
    isSafety,
    isVideoSuite,
    isAudioSuite,
    isTextSuite,
    isToolSuite,
    isVoiceDesignSuite,
    useModeration,
  ]);

  const saveRatings = useCallback(async () => {
    if (!runId) {
      return;
    }
    try {
      await persistEvalRatings(runId, ratings);
      setSaveNote(`Ratings written to eval/runs/${runId}/ratings.jsonl`);
      setStatusError(null);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Failed to save ratings');
    }
  }, [runId, ratings]);

  const setPreferenceWinner = useCallback((promptId, winner) => {
    setRatings((prev) =>
      prev.map((row) => (row.prompt_id === promptId ? { ...row, winner } : row)),
    );
  }, []);

  const setSafetyOutcome = useCallback((promptId, workflow, outcome) => {
    setRatings((prev) =>
      prev.map((row) =>
        row.prompt_id === promptId && row.workflow === workflow
          ? { ...row, outcome }
          : row,
      ),
    );
  }, []);

  const setRatingNotes = useCallback((promptId, notes) => {
    setRatings((prev) =>
      prev.map((row) => (row.prompt_id === promptId && 'winner' in row ? { ...row, notes } : row)),
    );
  }, []);

  const baseFilterOptions = useMemo(() => {
    const bases = [...new Set(catalogWorkflows.map((entry) => entry.baseId))];
    return bases;
  }, [catalogWorkflows]);

  const displayResults = useMemo(() => {
    const placeholders = (suite?.prompts ?? []).flatMap((prompt) =>
      selectedWorkflows.map((workflow) => ({
        key: `${prompt.id}::${workflow}`,
        promptId: prompt.id,
        workflow,
        status: 'pending',
        url: null,
        error: null,
        moderation: null,
      })),
    );

    // Prefer live/persisted results; keep placeholders for jobs not yet run.
    const byKey = new Map(placeholders.map((item) => [item.key, item]));
    for (const result of results) {
      byKey.set(result.key, result);
    }
    const source = [...byKey.values()];

    return source.filter((result) => {
      if (promptFilter !== 'all' && result.promptId !== promptFilter) {
        return false;
      }
      if (filterBase !== 'all') {
        const baseId = String(result.workflow).split('__')[0];
        if (baseId !== filterBase) {
          return false;
        }
      }
      return true;
    });
  }, [results, suite, selectedWorkflows, promptFilter, filterBase]);

  const lightboxIndex = useMemo(() => {
    if (!lightbox) {
      return -1;
    }
    return displayResults.findIndex(
      (result) =>
        result.promptId === lightbox.promptId && result.workflow === lightbox.workflow,
    );
  }, [lightbox, displayResults]);

  const openLightbox = useCallback((promptId, workflow) => {
    setLightbox({ promptId, workflow });
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  const shiftLightbox = useCallback(
    (delta) => {
      if (lightboxIndex < 0 || !lightbox) {
        return;
      }
      const candidates = displayResults.filter(
        (result) =>
          (result.url || resultIsText(result)) &&
          (viewMode !== 'prompts' || result.promptId === lightbox.promptId),
      );
      if (candidates.length === 0) {
        return;
      }
      const currentPos = candidates.findIndex(
        (result) =>
          result.promptId === lightbox.promptId && result.workflow === lightbox.workflow,
      );
      if (currentPos < 0) {
        return;
      }
      const next =
        candidates[(currentPos + delta + candidates.length) % candidates.length];
      if (next) {
        setLightbox({
          promptId: next.promptId,
          workflow: next.workflow,
        });
      }
    },
    [displayResults, lightbox, lightboxIndex, viewMode],
  );

  useEffect(() => {
    if (!lightbox) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowRight') {
        shiftLightbox(1);
      } else if (event.key === 'ArrowLeft') {
        shiftLightbox(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, closeLightbox, shiftLightbox]);

  const thumbCols =
    thumbSize === 'sm'
      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
      : thumbSize === 'md'
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  const availableWorkflowChoices = catalogWorkflows;

  const workflowsByBase = useMemo(() => {
    const groups = new Map();
    for (const entry of availableWorkflowChoices) {
      const baseId = entry.familyId || entry.baseId || String(entry.id).split('__')[0];
      if (!groups.has(baseId)) {
        groups.set(baseId, {
          baseId,
          label: entry.familyLabel || entry.label?.split(' · ')[0] || baseId,
          entries: [],
        });
      }
      groups.get(baseId).entries.push(entry);
    }
    return [...groups.values()];
  }, [availableWorkflowChoices]);

  const toggleBaseWorkflows = useCallback((baseEntries) => {
    const ids = baseEntries.map((entry) => entry.id);
    setSelectedWorkflows((prev) => {
      const allOn = ids.every((id) => prev.includes(id));
      if (allOn) {
        return prev.filter((id) => !ids.includes(id));
      }
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return [...next];
    });
  }, []);

  const shortWorkflowLabel = useCallback((entry) => {
    if (entry.shortLabel) {
      return entry.shortLabel;
    }
    const id = String(entry.id);
    if (id.includes('__')) {
      const suffix = id.slice(id.indexOf('__') + 2);
      return suffix === 'none' ? 'no-lora' : suffix;
    }
    const dotted = String(entry.label || '');
    if (dotted.includes(' · ')) {
      return dotted.split(' · ').slice(1).join(' · ');
    }
    return entry.label || id;
  }, []);

  const lightboxResult =
    lightboxIndex >= 0 ? displayResults[lightboxIndex] : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <StudioHeader isRunning={isRunning} />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl tracking-tight">Eval</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Compare models and tools on the same prompt suites. Score preference or safety
            outcomes; media and ratings land under{' '}
            <code className="text-foreground">eval/runs/</code>.
          </p>
        </div>

        {loadError && (
          <p className="text-destructive text-sm" role="alert">
            {loadError}
          </p>
        )}

        <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Suite</span>
            <select
              className="border-input bg-background h-9 rounded-md border px-3"
              value={suiteId}
              disabled={isRunning}
              onChange={(event) => setSuiteId(event.target.value)}
            >
              {suites.map((entry) => (
                <option key={entry.suite} value={entry.suite}>
                  {entry.suite}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Seed</span>
            <input
              type="number"
              className="border-input bg-background h-9 rounded-md border px-3"
              value={seed}
              disabled={isRunning}
              onChange={(event) => setSeed(Number(event.target.value))}
            />
          </label>

          <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Workflows by Create family</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                  disabled={isRunning}
                  onClick={() =>
                    setSelectedWorkflows(catalogWorkflows.map((entry) => entry.id))
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                  disabled={isRunning}
                  onClick={() => setSelectedWorkflows([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {workflowsByBase.map((group) => {
                const selectedCount = group.entries.filter((entry) =>
                  selectedWorkflows.includes(entry.id),
                ).length;
                const allOn = selectedCount === group.entries.length && group.entries.length > 0;
                return (
                  <div key={group.baseId} className="rounded-md border px-3 py-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{group.label}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                        disabled={isRunning}
                        onClick={() => toggleBaseWorkflows(group.entries)}
                      >
                        {allOn ? 'Clear base' : `Select base (${group.entries.length})`}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.entries.map((entry) => (
                        <label
                          key={entry.id}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                            selectedWorkflows.includes(entry.id) && 'border-primary bg-primary/5',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedWorkflows.includes(entry.id)}
                            disabled={isRunning}
                            onChange={() => toggleWorkflow(entry.id)}
                          />
                          <span title={entry.id}>{shortWorkflowLabel(entry)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              {isToolSuite
                ? 'Voice suite: Speak needs text; Clone needs local audio under eval/fixtures/sfw/audio.'
                : isVoiceDesignSuite
                ? 'Audio suite: Design — spoken text × instruct pairs.'
                : isAudioSuite
                ? 'Audio suite: genre-lane original lyrics for Redrob Tune (Korean + English styles).'
                : isVideoSuite
                  ? 'Video suite: start from a local fixture or Generate with Redrob Image, then animate.'
                  : isTextSuite
                    ? 'Text suite: ASR / VLM outputs persisted as .txt under the run folder.'
                  : suite?.suite === 'image-comparison'
                    ? 'Redrob Image Create eval (savagemanage/redrob-image).'
                    : suite?.suite?.startsWith('sfw-')
                      ? `Suite ${suite.suite}: workflows from suite file.`
                      : 'Select a suite to run.'}
            </p>
            <label className="text-muted-foreground mt-2 inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useModeration}
                disabled={isRunning || isVideoSuite || isAudioSuite || isTextSuite || isToolSuite}
                onChange={(event) => setUseModeration(event.target.checked)}
              />
              QwenVL moderation (image safety suites only)
            </label>
          </div>
        </section>

        {suite && (
          <p className="text-muted-foreground text-sm">
            {suite.description} · {suite.prompts?.length ?? 0} prompts · {jobs.length} jobs
            {comfyOnline === false ? ' · ComfyUI offline' : ''}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={
              isRunning ||
              !suite ||
              selectedWorkflows.length === 0 ||
              comfyOnline === false
            }
            onClick={startRun}
          >
            {isRunning ? 'Running…' : 'Start run'}
          </Button>
          {isRunning && (
            <Button type="button" variant="outline" onClick={stopRun}>
              Stop
            </Button>
          )}
          {runId && (
            <Button type="button" variant="secondary" disabled={isRunning} onClick={saveRatings}>
              Save ratings
            </Button>
          )}
          {progressLabel && (
            <span className="text-muted-foreground text-sm">{progressLabel}</span>
          )}
        </div>

        {statusError && (
          <p className="text-destructive text-sm" role="alert">
            {statusError}
          </p>
        )}
        {saveNote && <p className="text-muted-foreground text-sm">{saveNote}</p>}

        {runId && (
          <p className="font-mono text-xs text-muted-foreground">
            run:{' '}
            <Link
              href={`/eval/${encodeURIComponent(runId)}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {runId}
            </Link>
          </p>
        )}

        <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Layout</span>
            <select
              className="border-input bg-background h-8 rounded-md border px-2"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value)}
            >
              <option value="gallery">All results</option>
              <option value="prompts">By prompt</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Thumb size</span>
            <select
              className="border-input bg-background h-8 rounded-md border px-2"
              value={thumbSize}
              onChange={(event) => setThumbSize(event.target.value)}
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Prompt</span>
            <select
              className="border-input bg-background h-8 min-w-28 rounded-md border px-2"
              value={promptFilter}
              onChange={(event) => setPromptFilter(event.target.value)}
            >
              <option value="all">All prompts</option>
              {(suite?.prompts ?? []).map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Model</span>
            <select
              className="border-input bg-background h-8 min-w-28 rounded-md border px-2"
              value={filterBase}
              onChange={(event) => setFilterBase(event.target.value)}
            >
              <option value="all">All models</option>
              {baseFilterOptions.map((baseId) => (
                <option key={baseId} value={baseId}>
                  {baseId}
                </option>
              ))}
            </select>
          </label>
          <label className="pb-1 inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={blurContents}
              onChange={(event) => setBlurContentsPersist(event.target.checked)}
            />
            <span className="text-muted-foreground">Blur contents</span>
          </label>
          <p className="text-muted-foreground pb-1 text-xs">
            {displayResults.filter((result) => result.url).length}/{displayResults.length}{' '}
            {isAudioSuite ? 'tracks' : isVideoSuite ? 'clips' : 'images'} · click to enlarge · arrows to browse
          </p>
        </section>

        {viewMode === 'gallery' ? (
          <section className={cn('grid gap-2', thumbCols)}>
            {displayResults.map((result) => {
              const selectedWinner =
                !isSafety &&
                ratings.find(
                  (row) =>
                    row.prompt_id === result.promptId &&
                    'winner' in row &&
                    row.winner === result.workflow,
                );
              return (
                <div
                  key={result.key}
                  className={cn(
                    'group relative overflow-hidden rounded-md border bg-muted text-left',
                    selectedWinner && 'ring-primary ring-2',
                  )}
                >
                  <div
                    role={resultIsAudio(result) ? undefined : 'button'}
                    tabIndex={
                      resultIsAudio(result) || !result.url ? undefined : 0
                    }
                    className={cn(
                      resultIsAudio(result) || isAudioSuite || resultIsText(result)
                        ? 'space-y-1 p-2'
                        : 'aspect-square',
                      result.url && !resultIsAudio(result) && !resultIsText(result)
                        ? 'cursor-zoom-in'
                        : resultIsText(result)
                          ? 'cursor-zoom-in'
                          : 'cursor-default',
                    )}
                    onClick={() => {
                      if (resultIsAudio(result)) {
                        return;
                      }
                      if (result.url || resultIsText(result)) {
                        openLightbox(result.promptId, result.workflow);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (resultIsAudio(result) || (!result.url && !resultIsText(result))) {
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openLightbox(result.promptId, result.workflow);
                      }
                    }}
                    onContextMenu={(event) => {
                      if (!isSafety || !result.url) {
                        return;
                      }
                      event.preventDefault();
                    }}
                  >
                    {result.url ? (
                      <EvalMediaThumb
                        url={result.url}
                        alt={`${result.promptId} ${result.workflow}`}
                        className={
                          resultIsAudio(result) || isAudioSuite
                            ? 'w-full'
                            : 'size-full object-cover transition-[filter]'
                        }
                        isVideo={resultIsVideo(result)}
                        isAudio={resultIsAudio(result)}
                        blur={blurContents}
                      />
                    ) : resultIsText(result) ? (
                      <pre className="text-muted-foreground size-full overflow-auto p-1 text-left text-[9px] leading-snug whitespace-pre-wrap">
                        {String(result.text).slice(0, 400)}
                      </pre>
                    ) : (
                      <div className="text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[10px] leading-tight">
                        {result.error || (isRunning ? '…' : '—')}
                      </div>
                    )}
                  </div>
                  <div className="bg-background/90 truncate px-1 py-0.5 text-[10px] leading-tight backdrop-blur-sm">
                    <span className="text-muted-foreground">{result.promptId}</span>
                    {' · '}
                    {result.workflow}
                    {typeof result.generationSeconds === 'number'
                      ? ` · ${result.generationSeconds}s`
                      : ''}
                  </div>
                  {result.moderation?.outcome && (
                    <span
                      className={cn(
                        'absolute top-1 right-1 rounded px-1 py-0.5 text-[9px] font-medium backdrop-blur-sm',
                        result.moderation.outcome === 'safe-output' &&
                          'bg-emerald-500/90 text-white',
                        result.moderation.outcome === 'fail-suggestive' &&
                          'bg-amber-500/90 text-white',
                        result.moderation.outcome === 'fail-explicit' &&
                          'bg-destructive/90 text-white',
                      )}
                    >
                      {result.moderation.outcome.replace('fail-', '')}
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        ) : (
          <section className="space-y-6">
            {(suite?.prompts ?? [])
              .filter((prompt) => promptFilter === 'all' || prompt.id === promptFilter)
              .map((prompt) => {
                const promptResults = displayResults.filter(
                  (result) => result.promptId === prompt.id,
                );
                const preference = ratings.find(
                  (row) => row.prompt_id === prompt.id && 'winner' in row,
                );
                return (
                  <article key={prompt.id} className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-medium">{prompt.id}</h2>
                      <span className="text-muted-foreground text-xs">
                        {promptResults.filter((result) => result.url || resultIsText(result)).length}/
                        {promptResults.length} ·{' '}
                        {[prompt.style, prompt.subject, prompt.difficulty]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <EvalPromptBody prompt={prompt} />

                    <div className={cn('grid gap-2', thumbCols)}>
                      {promptResults.map((result) => {
                        const safetyRow = ratings.find(
                          (row) =>
                            row.prompt_id === prompt.id &&
                            row.workflow === result.workflow &&
                            'outcome' in row,
                        );
                        const audio = resultIsAudio(result);
                        const text = resultIsText(result);
                        return (
                          <div key={result.key} className="space-y-1">
                            <div
                              className={cn(
                                'bg-muted relative w-full overflow-hidden rounded-md border',
                                preference?.winner === result.workflow && 'ring-primary ring-2',
                                audio || text ? 'p-2' : 'aspect-square',
                                (result.url && !audio) || text
                                  ? 'cursor-zoom-in'
                                  : 'cursor-default',
                              )}
                              role={audio ? undefined : 'button'}
                              tabIndex={(result.url && !audio) || text ? 0 : undefined}
                              onClick={() => {
                                if (audio) {
                                  return;
                                }
                                if (result.url || text) {
                                  openLightbox(result.promptId, result.workflow);
                                } else if (!isSafety) {
                                  setPreferenceWinner(prompt.id, result.workflow);
                                }
                              }}
                              onKeyDown={(event) => {
                                if (audio || (!result.url && !text)) {
                                  return;
                                }
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  openLightbox(result.promptId, result.workflow);
                                }
                              }}
                            >
                              {result.url && !text ? (
                                <EvalMediaThumb
                                  url={result.url}
                                  alt={`${prompt.id} ${result.workflow}`}
                                  className={
                                    audio
                                      ? 'w-full'
                                      : 'size-full object-cover transition-[filter]'
                                  }
                                  isVideo={resultIsVideo(result)}
                                  isAudio={audio}
                                  blur={blurContents}
                                />
                              ) : text ? (
                                <pre className="text-muted-foreground max-h-40 overflow-auto text-left text-[10px] leading-snug whitespace-pre-wrap">
                                  {String(result.text).slice(0, 600)}
                                </pre>
                              ) : (
                                <div className="text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[10px]">
                                  {result.error || (isRunning ? '…' : '—')}
                                </div>
                              )}
                            </div>
                            <p
                              className="truncate font-mono text-[10px] leading-tight"
                              title={result.workflow}
                            >
                              {result.workflow}
                              {typeof result.generationSeconds === 'number'
                                ? ` · ${result.generationSeconds}s`
                                : ''}
                            </p>
                            {isSafety && (
                              <select
                                className="border-input bg-background h-7 w-full rounded border px-1 text-[10px]"
                                value={safetyRow?.outcome ?? ''}
                                onChange={(event) =>
                                  setSafetyOutcome(
                                    prompt.id,
                                    result.workflow,
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="">Outcome…</option>
                                {SAFETY_OUTCOMES.map((outcome) => (
                                  <option key={outcome.id} value={outcome.id}>
                                    {outcome.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!isSafety && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-xs">Winner</span>
                        <select
                          className="border-input bg-background h-8 max-w-full rounded-md border px-2 text-xs"
                          value={preference?.winner ?? ''}
                          onChange={(event) =>
                            setPreferenceWinner(prompt.id, event.target.value)
                          }
                        >
                          <option value="">Pick…</option>
                          <option value="tie">Tie</option>
                          {selectedWorkflows.map((workflow) => (
                            <option key={workflow} value={workflow}>
                              {workflow}
                            </option>
                          ))}
                        </select>
                        <input
                          className="border-input bg-background h-8 min-w-48 flex-1 rounded-md border px-2 text-xs"
                          value={preference?.notes ?? ''}
                          placeholder="Optional notes"
                          onChange={(event) => setRatingNotes(prompt.id, event.target.value)}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
          </section>
        )}

        {lightboxResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            onClick={closeLightbox}
          >
            <div
              className="relative flex max-h-full max-w-6xl flex-col gap-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white">
                <div className="min-w-0">
                  <p className="font-medium">
                    {lightboxResult.promptId}
                    <span className="text-white/70"> · {lightboxResult.workflow}</span>
                    {typeof lightboxResult.generationSeconds === 'number' && (
                      <span className="text-white/70">
                        {' '}
                        · {lightboxResult.generationSeconds}s
                      </span>
                    )}
                  </p>
                  {lightboxResult.moderation?.outcome && (
                    <p className={cn('text-xs', moderationTone(lightboxResult.moderation.outcome))}>
                      {lightboxResult.moderation.outcome}
                      {lightboxResult.moderation.rationale
                        ? ` — ${lightboxResult.moderation.rationale}`
                        : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isSafety && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setPreferenceWinner(lightboxResult.promptId, lightboxResult.workflow)
                      }
                    >
                      Mark winner
                    </Button>
                  )}
                  {isSafety && (
                    <select
                      className="h-8 rounded-md border border-white/20 bg-black/40 px-2 text-xs text-white"
                      value={
                        ratings.find(
                          (row) =>
                            row.prompt_id === lightboxResult.promptId &&
                            row.workflow === lightboxResult.workflow &&
                            'outcome' in row,
                        )?.outcome ?? ''
                      }
                      onChange={(event) =>
                        setSafetyOutcome(
                          lightboxResult.promptId,
                          lightboxResult.workflow,
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Outcome…</option>
                      {SAFETY_OUTCOMES.map((outcome) => (
                        <option key={outcome.id} value={outcome.id}>
                          {outcome.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => shiftLightbox(-1)}>
                    Prev
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => shiftLightbox(1)}>
                    Next
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={closeLightbox}>
                    Close
                  </Button>
                </div>
              </div>
              {lightboxResult.url ? (
                resultIsAudio(lightboxResult) ? (
                  <audio
                    src={lightboxResult.url}
                    className="w-full max-w-xl"
                    controls
                    preload="metadata"
                    autoPlay
                  />
                ) : resultIsVideo(lightboxResult) ? (
                  <video
                    src={lightboxResult.url}
                    className={cn(
                      'max-h-[80vh] max-w-full rounded-lg object-contain transition-[filter]',
                      blurContents && 'blur-3xl',
                    )}
                    controls
                    playsInline
                    preload="metadata"
                    loop
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightboxResult.url}
                    alt={`${lightboxResult.promptId} ${lightboxResult.workflow}`}
                    className={cn(
                      'max-h-[80vh] max-w-full rounded-lg object-contain transition-[filter]',
                      blurContents && 'blur-3xl',
                    )}
                  />
                )
              ) : resultIsText(lightboxResult) ? (
                <pre className="max-h-[70vh] w-full max-w-3xl overflow-auto rounded-lg bg-black/50 p-4 text-left text-sm whitespace-pre-wrap text-white">
                  {lightboxResult.text}
                </pre>
              ) : (
                <p className="text-white/70 text-sm">{lightboxResult.error || 'No media'}</p>
              )}
            </div>
          </div>
        )}

        {runs.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Recent runs ({runs.length})</h2>
            <ul className="text-muted-foreground max-h-112 space-y-1 overflow-y-auto font-mono text-xs">
              {runs.map((run) => (
                <li key={run.runId}>
                  <Link
                    href={`/eval/${encodeURIComponent(run.runId)}`}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {run.runId}
                  </Link>
                  {run.suite ? ` · ${run.suite}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

export default function EvalPage() {
  return (
    <Suspense fallback={null}>
      <EvalPageContent />
    </Suspense>
  );
}
