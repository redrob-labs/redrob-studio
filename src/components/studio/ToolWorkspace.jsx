'use client';

import { AlertCircle, ArrowLeft, Loader2, Square } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/context/LocaleContext';
import {
  SPEAK_PROMPT_EXAMPLES,
  VOICE_DESIGN_EXAMPLES,
} from '@/lib/audio-prompt';
import { translateError } from '@/lib/i18n/errors';
import {
  buildToolsHref,
  CATEGORY_QUERY_KEY,
} from '@/lib/studio/navigation';
import { cn, formatDuration } from '@/lib/utils';

import ToolOptions from './options/ToolOptions';
import ToolOutput from './ToolOutput';
import AudioUploadZone from './uploads/AudioUploadZone';
import ImageUploadZone from './uploads/ImageUploadZone';
import VideoUploadZone from './uploads/VideoUploadZone';

export default function ToolWorkspace(props) {
  const t = useT();
  const searchParams = useSearchParams();
  const toolsHref = buildToolsHref(searchParams.get(CATEGORY_QUERY_KEY));

  const {
    selectedWorkflow,
    currentTaskMeta,
    isVideoMode,
    isAudioMode,
    isSpeakTask,
    isVoiceCloneTask,
    isVoiceDesignTask,
    isAudioTtsTask,
    currentAudioSupported,
    isPhotoTask,
    needsImageUpload,
    needsAudioUpload,
    needsVideoUpload,
    hidePrompt,
    hideAspectRatio,
    showNegativePrompt,
    isRunning,
    resolvedTask,
    clearError,
    primaryImageNode,
    primaryAudioNode,
    primaryVideoNode,
    primaryAudioInputs,
    primaryVideoInputs,
    primaryImageInputs,
    aspectRatioConfig,
    outputDimensions,
    dimensionSourceSize,
    inputRef,
    audioInputRef,
    videoInputRef,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    aspectRatio,
    setAspectRatio,
    runningAction,
    activityPhase,
    activityPhaseKey,
    progress,
    liveElapsedMs,
    error,
    comfyOnline,
    canPreload,
    canGenerate,
    handlePreload,
    handleGenerate,
    handleStop,
  } = props;

  const defaultRunningLabel = isVideoMode
    ? t('workspace.generatingVideo')
    : isAudioMode
      ? t('workspace.generatingSpeech')
      : t('workspace.generating');
  const runningLabel = t(`workspace.running.${resolvedTask}`, null, defaultRunningLabel);

  // Manifest `ui.*` copy is English-only, so shared chrome reads from the
  // catalog first and keys anything tool-specific on the task id.
  const promptLabel = t(`workspace.promptLabel.${resolvedTask}`, null, t('workspace.prompt'));
  const fallbackPromptPlaceholder =
    isSpeakTask || isVoiceCloneTask || isVoiceDesignTask
      ? t('workspace.promptPlaceholder.speech')
      : isPhotoTask
        ? t('workspace.promptPlaceholder.photo')
        : t('workspace.promptPlaceholder.default');
  const promptPlaceholder = t(
    `workspace.promptPlaceholder.${resolvedTask}`,
    null,
    fallbackPromptPlaceholder,
  );
  const manifestPromptHint = selectedWorkflow?.ui?.promptHint ?? null;
  const promptHint = manifestPromptHint
    ? t(`workspace.promptHint.${resolvedTask}`, null, manifestPromptHint)
    : null;

  const activityPhaseLabel = activityPhaseKey
    ? t(`phase.${activityPhaseKey}`, null, activityPhase)
    : activityPhase;
  const errorMessage = translateError(t, error);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
      <Link
        href={toolsHref}
        className={cn(
          'text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1.5 text-sm font-medium',
          isRunning && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
        aria-disabled={isRunning}
        onClick={event => {
          if (isRunning) {
            event.preventDefault();
          }
        }}
      >
        <ArrowLeft className="size-4" />
        {t('nav.allTools')}
      </Link>

      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight break-keep sm:text-2xl">
          {t(`task.${currentTaskMeta?.id}.label`, null, currentTaskMeta?.label)}
        </h1>
        {currentTaskMeta?.description ? (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed break-keep">
            {t(`task.${currentTaskMeta.id}.description`, null, currentTaskMeta.description)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-4">
          {needsAudioUpload || primaryAudioInputs.length > 0 ? (
            <AudioUploadZone
              audioInputRef={audioInputRef}
              primaryAudioInputs={primaryAudioInputs}
              resolvedTask={resolvedTask}
              audioPreviewUrls={props.audioPreviewUrls}
              audioFiles={props.audioFiles}
              isDragging={props.isDragging}
              setIsDragging={props.setIsDragging}
              handleAudioDrop={props.handleAudioDrop}
              removeAudioForNode={props.removeAudioForNode}
              setAudioForNode={props.setAudioForNode}
              primaryAudioNode={primaryAudioNode}
            />
          ) : null}

          {needsVideoUpload ? (
            <VideoUploadZone
              videoInputRef={videoInputRef}
              primaryVideoInputs={primaryVideoInputs}
              resolvedTask={resolvedTask}
              videoPreviewUrls={props.videoPreviewUrls}
              videoFiles={props.videoFiles}
              isDragging={props.isDragging}
              setIsDragging={props.setIsDragging}
              handleVideoDrop={props.handleVideoDrop}
              removeVideoForNode={props.removeVideoForNode}
              setVideoForNode={props.setVideoForNode}
              primaryVideoNode={primaryVideoNode}
            />
          ) : null}

          {needsImageUpload ? (
            <ImageUploadZone
              inputRef={inputRef}
              primaryImageInputs={primaryImageInputs}
              primaryImageNode={primaryImageNode}
              resolvedTask={resolvedTask}
              imagePreviewUrls={props.imagePreviewUrls}
              activeImageNode={props.activeImageNode}
              setActiveImageNode={props.setActiveImageNode}
              setImageForNode={props.setImageForNode}
              isDragging={props.isDragging}
              setIsDragging={props.setIsDragging}
              handleDrop={props.handleDrop}
              removeImageForNode={props.removeImageForNode}
              uploadOptional={props.imageUploadOptional}
            />
          ) : null}

          {!hidePrompt ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt" className="text-xs">
                {promptLabel}
              </Label>
              <Textarea
                id="prompt"
                rows={3}
                value={prompt}
                onChange={event => {
                  clearError();
                  setPrompt(event.target.value);
                }}
                placeholder={promptPlaceholder}
                disabled={isRunning}
              />
              {promptHint ? (
                <p className="text-muted-foreground text-xs leading-relaxed">{promptHint}</p>
              ) : null}
              {isSpeakTask || isVoiceDesignTask ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-muted-foreground text-xs">{t('workspace.examples')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(isVoiceDesignTask ? VOICE_DESIGN_EXAMPLES : SPEAK_PROMPT_EXAMPLES).map(
                        example => (
                          <Button
                            key={example.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full px-2.5 text-xs"
                            disabled={isRunning}
                            onClick={() => {
                              clearError();
                              setPrompt(example.text);
                              if (isVoiceDesignTask && example.instruct) {
                                props.setVoiceDesignInstruct(example.instruct);
                              }
                            }}
                          >
                            {t(
                              isVoiceDesignTask
                                ? `preset.voiceDesignExample.${example.id}`
                                : `preset.speakExample.${example.id}`,
                              null,
                              example.label,
                            )}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
              {showNegativePrompt ? (
                <>
                  <Label htmlFor="negative-prompt" className="text-xs">
                    {t('workspace.negativePrompt')}
                  </Label>
                  <Textarea
                    id="negative-prompt"
                    rows={2}
                    value={negativePrompt}
                    onChange={event => {
                      clearError();
                      setNegativePrompt(event.target.value);
                    }}
                    placeholder={t('workspace.negativePlaceholder')}
                    disabled={isRunning}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {aspectRatioConfig && !hideAspectRatio ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-xs">{t('workspace.aspectRatio')}</Label>
                {outputDimensions ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {outputDimensions.width}×{outputDimensions.height}
                    {aspectRatio === 'original' && !dimensionSourceSize && needsImageUpload
                      ? ` · ${t('workspace.uploadToDetect')}`
                      : ''}
                  </span>
                ) : null}
              </div>
              <div
                className={cn(
                  'bg-muted grid gap-0.5 rounded-lg p-0.5',
                  aspectRatioConfig.aspectRatios.length > 5
                    ? 'grid-cols-3 sm:grid-cols-6'
                    : 'grid-cols-3 sm:grid-cols-5',
                )}
              >
                {aspectRatioConfig.aspectRatios.map(option => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={aspectRatio === option.id ? 'default' : 'ghost'}
                    className="h-7 px-1 text-xs"
                    disabled={isRunning}
                    onClick={() => {
                      clearError();
                      setAspectRatio(option.id);
                    }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <ToolOptions {...props} />

          {isRunning ? (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  {activityPhaseLabel ??
                    (runningAction === 'preload' ? t('workspace.preparing') : runningLabel)}
                </span>
                <span>
                  {progress > 0 ? `${progress}% · ` : ''}
                  {formatDuration(liveElapsedMs)}
                </span>
              </div>
              <Progress
                value={progress > 0 ? progress : undefined}
                className={progress === 0 ? 'opacity-60' : undefined}
              />
            </div>
          ) : null}

          {comfyOnline === false ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{t('workspace.offlineAlert')}</AlertDescription>
            </Alert>
          ) : null}

          {isAudioTtsTask && currentAudioSupported === false ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>
                {t(`error.audioMissingNode.${resolvedTask}`, null, t('error.audioMissingNode.speak'))}
              </AlertDescription>
            </Alert>
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreload}
              disabled={!canPreload}
              className="shrink-0"
            >
              {runningAction === 'preload' ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t('workspace.preparing')}
                </>
              ) : (
                t('workspace.prepare')
              )}
            </Button>
            <Button type="button" onClick={handleGenerate} disabled={!canGenerate} className="flex-1">
              {runningAction === 'generate' ? (
                <>
                  <Loader2 className="animate-spin" />
                  {runningLabel}
                </>
              ) : (
                t('workspace.generate')
              )}
            </Button>
            {isRunning ? (
              <Button type="button" variant="destructive" onClick={handleStop}>
                <Square className="fill-current" />
                {t('workspace.stop')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <ToolOutput
            outputUrl={props.outputUrl}
            outputImages={props.outputImages}
            outputFilename={props.outputFilename}
            outputType={props.outputType}
            outputText={props.outputText}
            generationMs={props.generationMs}
            isRunning={isRunning}
            runningAction={runningAction}
            activityPhase={activityPhaseLabel}
            runningLabel={runningLabel}
            progress={progress}
            liveElapsedMs={liveElapsedMs}
            isVideoMode={isVideoMode}
            isAudioMode={isAudioMode}
            isTranscribeTask={selectedWorkflow?.outputType === 'text'}
            needsImageUpload={needsImageUpload}
            useAsInputOptions={props.useAsInputOptions}
            useAsInputTarget={props.useAsInputTarget}
            setUseAsInputTarget={props.setUseAsInputTarget}
            useOutputAsInputLoading={props.useOutputAsInputLoading}
            handleUseOutputAsInput={props.handleUseOutputAsInput}
          />
        </div>
      </div>
    </main>
  );
}
