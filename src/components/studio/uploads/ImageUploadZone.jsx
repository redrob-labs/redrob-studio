'use client';

import { ImagePlus, X } from 'lucide-react';

import { useT } from '@/context/LocaleContext';
import { cn } from '@/lib/utils';

export default function ImageUploadZone({
  inputRef,
  primaryImageInputs,
  primaryImageNode,
  resolvedTask,
  imagePreviewUrls,
  activeImageNode,
  setActiveImageNode,
  setImageForNode,
  isDragging,
  setIsDragging,
  handleDrop,
  removeImageForNode,
  uploadOptional = false,
}) {
  const t = useT();
  const uploadLabel = t(
    `upload.image.${resolvedTask}`,
    null,
    uploadOptional ? t('upload.imageOptional') : t('upload.imageLabel'),
  );
  const uploadHint = uploadOptional ? t('upload.imageOptionalHint') : t('upload.imageHint');

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const selected = event.target.files?.[0];
          const nodeId = activeImageNode ?? primaryImageNode;
          if (selected && nodeId) {
            setImageForNode(nodeId, selected);
          }
          event.target.value = '';
        }}
      />

      {primaryImageInputs.length > 1 ? (
        <div
          className={cn(
            'grid gap-2',
            primaryImageInputs.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2',
          )}
        >
          {primaryImageInputs.map(input => {
            const preview = imagePreviewUrls[input.node];
            return (
              <div
                key={input.node}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveImageNode(input.node);
                  inputRef.current?.click();
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    setActiveImageNode(input.node);
                    inputRef.current?.click();
                  }
                }}
                onDragOver={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={event => handleDrop(event, input.node)}
                className={cn(
                  'relative flex min-h-36 cursor-pointer select-none flex-col gap-1.5 rounded-2xl border-2 border-dashed p-3 transition-colors',
                  isDragging
                    ? 'border-primary bg-accent'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground text-xs font-medium">
                    {input.label}
                    {input.required ? ' *' : ''}
                  </span>
                  {preview ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5"
                      aria-label={t('upload.remove', { label: input.label })}
                      onClick={event => {
                        event.stopPropagation();
                        removeImageForNode(input.node);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                {preview ? (
                  <img
                    src={preview}
                    alt={input.label}
                    className="max-h-24 w-full flex-1 rounded object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 text-center">
                    <ImagePlus className="size-6 opacity-60" />
                    <p className="text-xs">{t('upload.dropOrClick')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setActiveImageNode(primaryImageNode);
            inputRef.current?.click();
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              setActiveImageNode(primaryImageNode);
              inputRef.current?.click();
            }
          }}
          onDragOver={event => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex min-h-56 cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 transition-colors',
            isDragging
              ? 'border-primary bg-accent'
              : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50',
          )}
        >
          {primaryImageNode && imagePreviewUrls[primaryImageNode] ? (
            <img
              src={imagePreviewUrls[primaryImageNode]}
              alt={t('upload.preview')}
              className="max-h-40 max-w-full rounded object-contain"
            />
          ) : (
            <div className="text-muted-foreground flex flex-col items-center gap-3 text-center">
              <ImagePlus className="size-10 opacity-70" />
              <div>
                <p className="text-foreground text-base font-medium">{uploadLabel}</p>
                <p className="mt-1 text-sm">{uploadHint}</p>
              </div>
              <span className="bg-secondary text-secondary-foreground pointer-events-none rounded-full px-5 py-2 text-sm font-medium">
                {t('upload.selectImages')}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
