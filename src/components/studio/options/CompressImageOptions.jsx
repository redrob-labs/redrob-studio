'use client';

import { Label } from '@/components/ui/label';
import { useT } from '@/context/LocaleContext';

export default function CompressImageOptions({
  selectedWorkflow,
  compressScale,
  setCompressScale,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (!selectedWorkflow?.imageCompress?.scaleNode) {
    return null;
  }

  const { defaultScale = 1, scaleMin = 0.25, scaleMax = 1, scaleStep = 0.05 } =
    selectedWorkflow.imageCompress;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="compress-scale" className="text-xs">
          {t('options.resize')}
        </Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {Math.round(compressScale * 100)}%
        </span>
      </div>
      <input
        id="compress-scale"
        type="range"
        className="accent-primary w-full"
        min={scaleMin}
        max={scaleMax}
        step={scaleStep}
        value={compressScale}
        disabled={isRunning}
        onChange={event => {
          clearError();
          setCompressScale(Number(event.target.value));
        }}
      />
      <p className="text-muted-foreground text-xs leading-relaxed">{t('options.resizeHint')}</p>
    </div>
  );
}
