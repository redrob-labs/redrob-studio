'use client';

import { useRef } from 'react';
import { AudioLines, X } from 'lucide-react';

import { useT } from '@/context/LocaleContext';
import { cn } from '@/lib/utils';

export default function AudioUploadZone({
  audioInputRef,
  primaryAudioInputs,
  resolvedTask,
  audioPreviewUrls,
  audioFiles,
  isDragging,
  setIsDragging,
  handleAudioDrop,
  removeAudioForNode,
  setAudioForNode,
  primaryAudioNode,
}) {
  const t = useT();
  const pendingAudioNodeRef = useRef(null);
  const label = t(`upload.audio.${resolvedTask}`, null, t('upload.audioDefault'));

  return (
    <>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac,.webm"
        className="hidden"
        onChange={event => {
          const selected = event.target.files?.[0];
          const nodeId =
            pendingAudioNodeRef.current ??
            primaryAudioNode ??
            primaryAudioInputs[0]?.node;
          pendingAudioNodeRef.current = null;
          if (selected && nodeId) {
            setAudioForNode(nodeId, selected);
          }
          event.target.value = '';
        }}
      />
      {primaryAudioInputs.map(input => {
        const preview = audioPreviewUrls[input.node];
        const file = audioFiles[input.node];
        return (
          <div
            key={input.node}
            role="button"
            tabIndex={0}
            onClick={() => {
              pendingAudioNodeRef.current = input.node;
              audioInputRef.current?.click();
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                pendingAudioNodeRef.current = input.node;
                audioInputRef.current?.click();
              }
            }}
            onDragOver={event => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={event => handleAudioDrop(event, input.node)}
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
                    removeAudioForNode(input.node);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            {preview ? (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground truncate text-xs">{file?.name}</p>
                <audio src={preview} controls className="w-full" onClick={event => event.stopPropagation()} />
              </div>
            ) : (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <AudioLines className="size-6 opacity-60" />
                <p className="text-xs">{t('upload.audioHint')}</p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
