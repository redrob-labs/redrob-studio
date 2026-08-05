'use client';

import { FileVideo, X } from 'lucide-react';

import { useT } from '@/context/LocaleContext';
import { cn } from '@/lib/utils';

export default function VideoUploadZone({
  videoInputRef,
  primaryVideoInputs,
  resolvedTask,
  videoPreviewUrls,
  videoFiles,
  isDragging,
  setIsDragging,
  handleVideoDrop,
  removeVideoForNode,
  setVideoForNode,
  primaryVideoNode,
}) {
  const t = useT();
  const label = t(`upload.video.${resolvedTask}`, null, t('upload.videoDefault'));

  return (
    <>
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v"
        className="hidden"
        onChange={event => {
          const selected = event.target.files?.[0];
          const nodeId = primaryVideoNode ?? primaryVideoInputs[0]?.node;
          if (selected && nodeId) {
            setVideoForNode(nodeId, selected);
          }
          event.target.value = '';
        }}
      />
      {primaryVideoInputs.map(input => {
        const preview = videoPreviewUrls[input.node];
        const file = videoFiles[input.node];
        return (
          <div
            key={input.node}
            role="button"
            tabIndex={0}
            onClick={() => videoInputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                videoInputRef.current?.click();
              }
            }}
            onDragOver={event => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={event => handleVideoDrop(event, input.node)}
            className={cn(
              'relative flex min-h-32 cursor-pointer select-none flex-col gap-2 rounded-2xl border-2 border-dashed p-4 transition-colors',
              isDragging
                ? 'border-primary bg-accent'
                : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground text-xs font-medium">
                {label}
                {input.required ? ' *' : ''}
              </span>
              {preview ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5"
                  aria-label={t('upload.remove', { label })}
                  onClick={event => {
                    event.stopPropagation();
                    removeVideoForNode(input.node);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            {preview ? (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground truncate text-xs">{file?.name}</p>
                <video
                  src={preview}
                  controls
                  className="max-h-40 w-full rounded"
                  onClick={event => event.stopPropagation()}
                />
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <FileVideo className="size-6 opacity-60" />
                <p className="text-xs">{t('upload.videoHint')}</p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
