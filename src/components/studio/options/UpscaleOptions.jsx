'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useT } from '@/context/LocaleContext';

export default function UpscaleOptions({
  selectedWorkflow,
  upscaleScale,
  setUpscaleScale,
  upscaleScaleOptions,
  upscaleOutputSize,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (!selectedWorkflow?.upscale) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">{t('options.upscaleAmount')}</Label>
        {upscaleOutputSize ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            ≈ {upscaleOutputSize.width} × {upscaleOutputSize.height}
          </span>
        ) : null}
      </div>
      <div className="bg-muted flex gap-0.5 rounded-lg p-0.5">
        {upscaleScaleOptions.map(scale => (
          <Button
            key={scale}
            type="button"
            size="sm"
            variant={upscaleScale === scale ? 'default' : 'ghost'}
            className="h-7 flex-1 text-xs"
            disabled={isRunning}
            onClick={() => {
              clearError();
              setUpscaleScale(scale);
            }}
          >
            {scale}×
          </Button>
        ))}
      </div>
    </div>
  );
}
