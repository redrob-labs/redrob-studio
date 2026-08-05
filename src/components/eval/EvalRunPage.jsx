'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import StudioHeader from '@/components/studio/StudioHeader';
import { Button } from '@/components/ui/button';
import { persistEvalRatings, SAFETY_OUTCOMES } from '@/lib/eval/client';
import { ensureRunRatings } from '@/lib/eval/ratings';
import {
  isAudioEvalWorkflow,
  isTextEvalWorkflow,
  isVideoEvalWorkflow,
} from '@/lib/eval/workflows';
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

/** Create family for four-way preference filters. */
function familyIdFromWorkflow(workflowId) {
  const id = String(workflowId ?? '');
  if (
    id === 'redrob-image' ||
    id.startsWith('z-image') ||
    id.startsWith('qwen-2512') ||
    id.startsWith('boogu')
  ) {
    return 'redrob-image';
  }
  return id.includes('__') ? id.split('__')[0] : id;
}

function familyLabel(familyId) {
  if (familyId === 'redrob-image') {
    return 'Redrob Image';
  }
  return familyId;
}

function inferResultKind(image, workflow) {
  if (
    image?.kind === 'audio' ||
    image?.kind === 'video' ||
    image?.kind === 'image' ||
    image?.kind === 'text'
  ) {
    return image.kind;
  }
  const path = String(image?.relativePath ?? image?.filename ?? '');
  if (/\.txt$/i.test(path)) {
    return 'text';
  }
  if (/\.(mp3|wav|flac|ogg)$/i.test(path)) {
    return 'audio';
  }
  if (/\.(mp4|webm)$/i.test(path)) {
    return 'video';
  }
  if (isTextEvalWorkflow(workflow)) {
    return 'text';
  }
  if (isAudioEvalWorkflow(workflow)) {
    return 'audio';
  }
  if (isVideoEvalWorkflow(workflow)) {
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
  const expectedText = prompt.expectedText ?? null;
  if (!hasPrompt && !hasTags && !hasLyrics && !audioUrl && !imageUrl && !expectedText) {
    return null;
  }
  return (
    <div className="text-muted-foreground space-y-2 text-sm">
      {(audioUrl || imageUrl) && (
        <div className="flex flex-wrap items-start gap-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={`${prompt.id} fixture`}
              className="h-24 w-24 rounded-md border object-cover"
            />
          ) : null}
          {audioUrl ? (
            <div className="min-w-56 flex-1 space-y-1">
              <p className="text-foreground text-xs font-medium">Input audio</p>
              <audio src={audioUrl} className="w-full" controls preload="metadata" />
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
        <details className="text-muted-foreground text-sm" open={hasLyrics}>
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

function runFileUrl(runId, relativePath) {
  return `/api/eval/runs/${encodeURIComponent(runId)}?file=${encodeURIComponent(relativePath)}`;
}

function isSafetyMeta(meta, suite) {
  return (
    suite?.intent === 'safety-test-sfw-only' ||
    suite?.intent === 'safety-test-full-matrix' ||
    suite?.scoring === 'safety' ||
    meta?.scoring === 'safety'
  );
}

export default function EvalRunPage({ runId }) {
  const [meta, setMeta] = useState(null);
  const [suite, setSuite] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [images, setImages] = useState([]);
  const [textByKey, setTextByKey] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [saveNote, setSaveNote] = useState(null);
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState('prompts');
  const [thumbSize, setThumbSize] = useState('sm');
  const [blurContents, setBlurContents] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [filterBase, setFilterBase] = useState('all');
  const [promptFilter, setPromptFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');

  const setBlurContentsPersist = useCallback((next) => {
    setBlurContents(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/eval/runs/${encodeURIComponent(runId)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load run');
        }
        if (cancelled) {
          return;
        }
        setMeta(data.meta ?? null);
        setSuite(data.suite ?? null);
        setRatings(
          ensureRunRatings({
            ratings: data.ratings ?? [],
            suite: data.suite,
            workflows: data.meta?.workflows,
            meta: data.meta,
          }),
        );
        setImages(data.images ?? []);
        setTextByKey({});
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load run');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    const textItems = images.filter((image) => image.kind === 'text' && image.relativePath);
    if (textItems.length === 0) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        textItems.map(async (image) => {
          try {
            const response = await fetch(runFileUrl(runId, image.relativePath));
            if (!response.ok) {
              return [`${image.promptId}::${image.workflow}`, ''];
            }
            return [`${image.promptId}::${image.workflow}`, await response.text()];
          } catch {
            return [`${image.promptId}::${image.workflow}`, ''];
          }
        }),
      );
      if (!cancelled) {
        setTextByKey(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [images, runId]);

  const isSafety = isSafetyMeta(meta, suite);
  const isAudioSuite = suite?.modality === 'audio';
  const isTextSuite =
    suite?.modality === 'text' ||
    suite?.task === 'transcribe' ||
    suite?.task === 'vision';
  const workflows = meta?.workflows ?? [];
  const prompts = suite?.prompts ?? [];

  useEffect(() => {
    if (isTextSuite) {
      setViewMode('prompts');
    }
  }, [suite?.suite, isTextSuite]);

  const ratingByKey = useMemo(() => {
    const map = new Map();
    for (const row of ratings) {
      if (row?.workflow) {
        map.set(`${row.prompt_id}::${row.workflow}`, row);
      } else if (row?.prompt_id) {
        map.set(`${row.prompt_id}::preference`, row);
      }
    }
    return map;
  }, [ratings]);

  const imageByKey = useMemo(() => {
    const map = new Map();
    for (const image of images) {
      map.set(`${image.promptId}::${image.workflow}`, image);
    }
    return map;
  }, [images]);

  const results = useMemo(() => {
    const keys = new Set([
      ...images.map((image) => `${image.promptId}::${image.workflow}`),
      ...ratings
        .filter((row) => row?.workflow)
        .map((row) => `${row.prompt_id}::${row.workflow}`),
    ]);

    // Preference suites may only have winner rows without per-workflow rating rows.
    if (keys.size === 0 && workflows.length > 0) {
      const promptIds =
        prompts.length > 0
          ? prompts.map((prompt) => prompt.id)
          : [...new Set(ratings.map((row) => row.prompt_id).filter(Boolean))];
      for (const promptId of promptIds) {
        for (const workflow of workflows) {
          keys.add(`${promptId}::${workflow}`);
        }
      }
    }

    return [...keys]
      .map((key) => {
        const [promptId, workflow] = key.split('::');
        const image = imageByKey.get(key);
        const rating = ratingByKey.get(key);
        const kind = inferResultKind(image, workflow);
        return {
          key,
          promptId,
          workflow,
          url: image ? runFileUrl(runId, image.relativePath) : null,
          text: kind === 'text' ? (textByKey[key] ?? '') : null,
          kind,
          moderation: rating?.moderation ?? null,
          generationSeconds: rating?.generationSeconds,
          outcome: rating?.outcome ?? rating?.moderation?.outcome ?? '',
          error: null,
          status: image ? 'done' : 'missing',
        };
      })
      .sort((a, b) => {
        const promptCmp = String(a.promptId).localeCompare(String(b.promptId));
        if (promptCmp !== 0) {
          return promptCmp;
        }
        return String(a.workflow).localeCompare(String(b.workflow));
      });
  }, [images, ratings, workflows, prompts, imageByKey, ratingByKey, runId, textByKey]);

  const baseFilterOptions = useMemo(() => {
    const bases = new Set(results.map((result) => familyIdFromWorkflow(result.workflow)));
    return [...bases].sort();
  }, [results]);

  const promptFilterOptions = useMemo(() => {
    if (prompts.length > 0) {
      return prompts.map((prompt) => prompt.id);
    }
    return [...new Set(results.map((result) => result.promptId))].sort();
  }, [prompts, results]);

  const displayResults = useMemo(() => {
    return results.filter((result) => {
      if (promptFilter !== 'all' && result.promptId !== promptFilter) {
        return false;
      }
      if (filterBase !== 'all') {
        if (familyIdFromWorkflow(result.workflow) !== filterBase) {
          return false;
        }
      }
      if (outcomeFilter !== 'all') {
        const outcome = result.outcome || result.moderation?.outcome || '';
        if (outcome !== outcomeFilter) {
          return false;
        }
      }
      return true;
    });
  }, [results, promptFilter, filterBase, outcomeFilter]);

  const outcomeCounts = useMemo(() => {
    const counts = {};
    for (const result of results) {
      const outcome = result.outcome || result.moderation?.outcome;
      if (!outcome) {
        continue;
      }
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    }
    return counts;
  }, [results]);

  const lightboxIndex = useMemo(() => {
    if (!lightbox) {
      return -1;
    }
    return displayResults.findIndex(
      (result) =>
        result.promptId === lightbox.promptId && result.workflow === lightbox.workflow,
    );
  }, [lightbox, displayResults]);

  const lightboxResult = lightboxIndex >= 0 ? displayResults[lightboxIndex] : null;

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

  const setPreferenceWinner = useCallback((promptId, winner) => {
    setRatings((prev) =>
      prev.map((row) => (row.prompt_id === promptId && 'winner' in row ? { ...row, winner } : row)),
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

  const setSafetyNotes = useCallback((promptId, workflow, notes) => {
    setRatings((prev) =>
      prev.map((row) =>
        row.prompt_id === promptId && row.workflow === workflow ? { ...row, notes } : row,
      ),
    );
  }, []);

  const setRatingNotes = useCallback((promptId, notes) => {
    setRatings((prev) =>
      prev.map((row) => (row.prompt_id === promptId && 'winner' in row ? { ...row, notes } : row)),
    );
  }, []);

  const ratedCount = useMemo(() => {
    if (isSafety) {
      return ratings.filter((row) => row.workflow && row.outcome).length;
    }
    return ratings.filter((row) => 'winner' in row && row.winner).length;
  }, [ratings, isSafety]);

  const ratingTotal = isSafety
    ? ratings.filter((row) => row.workflow).length
    : ratings.filter((row) => 'winner' in row).length;

  const saveRatings = useCallback(async () => {
    setSaving(true);
    setSaveNote(null);
    try {
      await persistEvalRatings(runId, ratings);
      setSaveNote('Ratings saved');
    } catch (error) {
      setSaveNote(error instanceof Error ? error.message : 'Failed to save ratings');
    } finally {
      setSaving(false);
    }
  }, [runId, ratings]);

  const thumbCols =
    thumbSize === 'sm'
      ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
      : thumbSize === 'md'
        ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  const promptArticles = useMemo(() => {
    if (prompts.length > 0) {
      return prompts;
    }
    return promptFilterOptions.map((id) => ({ id }));
  }, [prompts, promptFilterOptions]);

  return (
    <div className="min-h-screen bg-muted/30">
      <StudioHeader />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/eval" className="hover:text-foreground underline-offset-2 hover:underline">
              Eval
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground font-mono text-xs">{runId}</span>
          </p>
          <h1 className="font-display text-3xl tracking-tight">Run history</h1>
          {meta && (
            <p className="text-muted-foreground max-w-3xl text-sm">
              {meta.suite}
              {meta.createdAt ? ` · ${new Date(meta.createdAt).toLocaleString()}` : ''}
              {` · seed ${meta.seed ?? '—'}`}
              {` · ${workflows.length} workflows`}
              {` · ${images.length} ${isAudioSuite ? 'tracks' : 'files'}`}
              {meta.moderation ? ' · QwenVL moderation' : ''}
              {meta.description ? ` — ${meta.description}` : ''}
            </p>
          )}
        </div>

        {loadError && (
          <p className="text-destructive text-sm" role="alert">
            {loadError}
          </p>
        )}

        {isSafety && Object.keys(outcomeCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(outcomeCounts).map(([outcome, count]) => (
              <button
                key={outcome}
                type="button"
                className={cn(
                  'rounded-md border px-2.5 py-1',
                  outcomeFilter === outcome && 'border-primary bg-primary/5',
                )}
                onClick={() =>
                  setOutcomeFilter((prev) => (prev === outcome ? 'all' : outcome))
                }
              >
                <span className={moderationTone(outcome)}>{outcome}</span>
                <span className="text-muted-foreground"> · {count}</span>
              </button>
            ))}
            {outcomeFilter !== 'all' && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground px-2 py-1 underline-offset-2 hover:underline"
                onClick={() => setOutcomeFilter('all')}
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 p-3 backdrop-blur">
          <Button type="button" variant="secondary" disabled={saving || !meta} onClick={saveRatings}>
            {saving ? 'Saving…' : 'Save ratings'}
          </Button>
          {saveNote && <span className="text-muted-foreground text-sm">{saveNote}</span>}
          {ratingTotal > 0 && (
            <span className="text-muted-foreground text-sm">
              Scored {ratedCount}/{ratingTotal}
              {isSafety ? ' outcomes' : ' prompts'}
            </span>
          )}
          {!isSafety && (
            <span className="text-muted-foreground text-xs">
              Pick a winner per prompt in By prompt view, or use Mark winner in the lightbox.
            </span>
          )}
        </div>

        <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Layout</span>
            <select
              className="border-input bg-background h-8 rounded-md border px-2"
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value)}
            >
              <option value="gallery">All media</option>
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
              {promptFilterOptions.map((promptId) => (
                <option key={promptId} value={promptId}>
                  {promptId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Family</span>
            <select
              className="border-input bg-background h-8 min-w-28 rounded-md border px-2"
              value={filterBase}
              onChange={(event) => setFilterBase(event.target.value)}
            >
              <option value="all">All families</option>
              {baseFilterOptions.map((baseId) => (
                <option key={baseId} value={baseId}>
                  {familyLabel(baseId)}
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
            {displayResults.filter((result) => result.url || resultIsText(result)).length}/
            {displayResults.length} results
            · click to enlarge · arrows to browse
          </p>
        </section>

        {viewMode === 'gallery' ? (
          <section className={cn('grid gap-2', thumbCols)}>
            {displayResults.map((result) => {
              const preference = ratingByKey.get(`${result.promptId}::preference`);
              const selectedWinner =
                !isSafety && preference?.winner === result.workflow;
              const audio = resultIsAudio(result);
              const text = resultIsText(result);
              return (
                <div
                  key={result.key}
                  className={cn(
                    'group relative overflow-hidden rounded-md border bg-muted text-left',
                    selectedWinner && 'ring-primary ring-2',
                  )}
                >
                  <div
                    role={audio ? undefined : 'button'}
                    tabIndex={audio || (!result.url && !text) ? undefined : 0}
                    className={cn(
                      audio || text ? 'space-y-1 p-2' : 'aspect-square cursor-zoom-in',
                      !result.url && !text && 'cursor-default',
                      text && 'cursor-zoom-in',
                    )}
                    onClick={() => {
                      if (audio) {
                        return;
                      }
                      if (result.url || text) {
                        openLightbox(result.promptId, result.workflow);
                      } else if (!isSafety) {
                        setPreferenceWinner(result.promptId, result.workflow);
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
                        alt={`${result.promptId} ${result.workflow}`}
                        className={
                          audio ? 'w-full' : 'size-full object-cover transition-[filter]'
                        }
                        isVideo={resultIsVideo(result)}
                        isAudio={audio}
                        blur={blurContents}
                      />
                    ) : text ? (
                      <pre className="text-muted-foreground max-h-40 overflow-auto text-left text-[10px] leading-snug whitespace-pre-wrap">
                        {String(result.text || '').slice(0, 600) || (result.url ? 'Loading…' : '—')}
                      </pre>
                    ) : (
                      <div className="text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[10px] leading-tight">
                        —
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
                  {(result.moderation?.outcome || result.outcome) && (
                    <span
                      className={cn(
                        'absolute top-1 right-1 rounded px-1 py-0.5 text-[9px] font-medium backdrop-blur-sm',
                        (result.moderation?.outcome || result.outcome) === 'safe-output' &&
                          'bg-emerald-500/90 text-white',
                        (result.moderation?.outcome || result.outcome) === 'fail-suggestive' &&
                          'bg-amber-500/90 text-white',
                        (result.moderation?.outcome || result.outcome) === 'fail-explicit' &&
                          'bg-destructive/90 text-white',
                        (result.moderation?.outcome || result.outcome) === 'blocked' &&
                          'bg-zinc-700/90 text-white',
                      )}
                    >
                      {(result.moderation?.outcome || result.outcome).replace('fail-', '')}
                    </span>
                  )}
                  {selectedWinner && (
                    <span className="absolute top-1 left-1 rounded bg-primary px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
                      winner
                    </span>
                  )}
                </div>
              );
            })}
          </section>
        ) : (
          <section className="space-y-6">
            {promptArticles
              .filter((prompt) => promptFilter === 'all' || prompt.id === promptFilter)
              .map((prompt) => {
                const promptResults = displayResults.filter(
                  (result) => result.promptId === prompt.id,
                );
                const preference = ratingByKey.get(`${prompt.id}::preference`);
                return (
                  <article key={prompt.id} className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-medium">{prompt.id}</h2>
                      <span className="text-muted-foreground text-xs">
                        {promptResults.filter((result) => result.url || resultIsText(result)).length}/
                        {promptResults.length}
                        {prompt.style || prompt.subject || prompt.difficulty
                          ? ` · ${[prompt.style, prompt.subject, prompt.difficulty]
                              .filter(Boolean)
                              .join(' · ')}`
                          : ''}
                      </span>
                    </div>
                    <EvalPromptBody prompt={prompt} />

                    <div className={cn('grid gap-2', thumbCols)}>
                      {promptResults.map((result) => {
                        const safetyRow = ratingByKey.get(`${prompt.id}::${result.workflow}`);
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
                                  {String(result.text || '').slice(0, 600) ||
                                    (result.url ? 'Loading…' : '—')}
                                </pre>
                              ) : (
                                <div className="text-muted-foreground flex size-full items-center justify-center p-1 text-center text-[10px]">
                                  —
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
                              <div className="space-y-1">
                                <select
                                  className="border-input bg-background h-7 w-full rounded border px-1 text-[10px]"
                                  value={safetyRow?.outcome ?? result.outcome ?? ''}
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
                                <input
                                  className="border-input bg-background h-7 w-full rounded border px-1 text-[10px]"
                                  value={safetyRow?.notes ?? ''}
                                  placeholder="Notes"
                                  onChange={(event) =>
                                    setSafetyNotes(
                                      prompt.id,
                                      result.workflow,
                                      event.target.value,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!isSafety && preference && (
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
                          {workflows.map((workflow) => (
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
                  {(lightboxResult.moderation?.outcome || lightboxResult.outcome) && (
                    <p
                      className={cn(
                        'text-xs',
                        moderationTone(
                          lightboxResult.moderation?.outcome || lightboxResult.outcome,
                        ),
                      )}
                    >
                      {lightboxResult.moderation?.outcome || lightboxResult.outcome}
                      {lightboxResult.moderation?.rationale
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
                        ratingByKey.get(
                          `${lightboxResult.promptId}::${lightboxResult.workflow}`,
                        )?.outcome ??
                        lightboxResult.outcome ??
                        ''
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
              {lightboxResult.url && !resultIsText(lightboxResult) ? (
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
                  {lightboxResult.text || 'Loading…'}
                </pre>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
