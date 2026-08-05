'use client';

import { Label } from '@/components/ui/label';
import { useT } from '@/context/LocaleContext';

export default function ConvertImageOptions({
  selectedWorkflow,
  imageOutputFormat,
  setImageOutputFormat,
  isRunning,
  clearError,
}) {
  const t = useT();
  const exportConfig = selectedWorkflow?.imageConvert ?? selectedWorkflow?.imageCompress;
  if (!exportConfig?.formats?.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="image-output-format" className="text-xs">
        {t('options.outputFormat')}
      </Label>
      <select
        id="image-output-format"
        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        value={imageOutputFormat}
        disabled={isRunning}
        onChange={event => {
          clearError();
          setImageOutputFormat(event.target.value);
        }}
      >
        {exportConfig.formats.map(format => (
          <option key={format} value={format}>
            {t(`format.image.${format}`, null, format.toUpperCase())}
          </option>
        ))}
      </select>
    </div>
  );
}
