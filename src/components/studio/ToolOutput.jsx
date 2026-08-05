'use client';

import { AlertCircle, AudioLines, FileText, ImagePlus, Loader2, Reply, Square } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useT } from '@/context/LocaleContext';
import { cn, formatDuration } from '@/lib/utils';

export default function ToolOutput({
  outputUrl,
  outputImages,
  outputFilename,
  outputType,
  outputText,
  generationMs,
  isRunning,
  runningAction,
  activityPhase,
  runningLabel,
  progress,
  liveElapsedMs,
  isVideoMode,
  isAudioMode,
  isTranscribeTask,
  needsImageUpload,
  useAsInputOptions,
  useAsInputTarget,
  setUseAsInputTarget,
  useOutputAsInputLoading,
  handleUseOutputAsInput,
}) {
  const t = useT();

  return (
    <Card className="flex min-h-[min(70vh,560px)] flex-col">
      <CardHeader className="flex-row flex-nowrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0 flex flex-col gap-0.5">
          <CardTitle className="text-base">
            {t('output.title')}
            {outputImages.length > 1
              ? ` · ${t('output.layers', { count: outputImages.length })}`
              : ''}
          </CardTitle>
          {generationMs !== null && (outputUrl || outputText) ? (
            <p className="text-muted-foreground text-xs">
              {t('output.completedIn', { duration: formatDuration(generationMs) })}
            </p>
          ) : null}
        </div>
        {outputUrl ? (
          <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2">
            {outputType === 'image' && needsImageUpload && useAsInputOptions.length > 0 ? (
              <div className="flex shrink-0 items-center gap-2">
                {useAsInputOptions.length > 1 ? (
                  <Select
                    value={useAsInputTarget ?? useAsInputOptions[0]?.node}
                    disabled={isRunning || useOutputAsInputLoading}
                    onValueChange={setUseAsInputTarget}
                  >
                    <SelectTrigger size="sm" className="h-8 w-34 shrink-0">
                      <SelectValue placeholder={t('output.inputSlot')} />
                    </SelectTrigger>
                    <SelectContent>
                      {useAsInputOptions.map(input => (
                        <SelectItem key={input.node} value={input.node}>
                          {input.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={isRunning || useOutputAsInputLoading}
                  onClick={handleUseOutputAsInput}
                >
                  {useOutputAsInputLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Reply className="size-3.5" />
                  )}
                  {t('output.useAsInput')}
                </Button>
              </div>
            ) : null}
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <a
                href={outputUrl}
                download={
                  outputFilename ??
                  (outputType === 'video'
                    ? 'generated.mp4'
                    : outputType === 'audio'
                      ? 'generated.mp3'
                      : 'generated.png')
                }
              >
                {t('output.download')}
              </a>
            </Button>
          </div>
        ) : outputText ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void navigator.clipboard.writeText(outputText);
            }}
          >
            {t('output.copyText')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center">
        {isRunning && runningAction === 'generate' ? (
          <div className="text-muted-foreground flex w-full flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="size-10 animate-spin" />
            <div className="flex flex-col gap-1">
              <p className="text-foreground text-sm font-medium">
                {activityPhase ??
                  runningLabel ??
                  (isVideoMode
                    ? t('workspace.generatingVideo')
                    : isAudioMode
                      ? t('workspace.generatingSpeech')
                      : t('workspace.generatingImage'))}
              </p>
              <p className="text-xs">
                {progress > 0 ? `${progress}% · ` : ''}
                {formatDuration(liveElapsedMs)}
              </p>
            </div>
            <Progress
              value={progress > 0 ? progress : undefined}
              className={cn('w-full max-w-xs', progress === 0 && 'opacity-60')}
            />
          </div>
        ) : outputType === 'text' && outputText ? (
          <div className="w-full max-w-2xl">
            <pre className="bg-muted max-h-[min(70vh,520px)] w-full overflow-auto rounded-lg border p-4 text-left text-sm whitespace-pre-wrap">
              {outputText}
            </pre>
          </div>
        ) : outputUrl ? (
          outputType === 'video' ? (
            <video
              src={outputUrl}
              controls
              playsInline
              className="max-h-[min(70vh,520px)] w-full rounded-lg object-contain"
            />
          ) : outputType === 'audio' ? (
            <audio src={outputUrl} controls className="w-full max-w-md" />
          ) : outputImages.length > 1 ? (
            <div className="grid w-full grid-cols-2 gap-3">
              {outputImages.map((image, index) => (
                <div key={`${image.filename ?? 'layer'}-${index}`} className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t('output.layer', { index: index + 1 })}
                  </span>
                  <img
                    src={image.url}
                    alt={t('output.layer', { index: index + 1 })}
                    className="max-h-48 w-full rounded-lg border object-contain"
                  />
                  <a
                    href={image.url}
                    download={image.filename ?? `layer-${index + 1}.png`}
                    className="text-primary text-xs hover:underline"
                  >
                    {t('output.download')}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <img
              src={outputUrl}
              alt={t('output.generatedImage')}
              className="max-h-[min(70vh,520px)] w-full rounded-lg object-contain"
            />
          )
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-12 text-center">
            {isTranscribeTask ? (
              <FileText className="size-10 opacity-40" />
            ) : isAudioMode ? (
              <AudioLines className="size-10 opacity-40" />
            ) : (
              <ImagePlus className="size-10 opacity-40" />
            )}
            <p className="text-sm">{t('output.placeholder')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
