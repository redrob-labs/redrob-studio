'use client';

import { Label } from '@/components/ui/label';
import { useT } from '@/context/LocaleContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ConvertAudioOptions({
  selectedWorkflow,
  audioOutputFormat,
  setAudioOutputFormat,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (!selectedWorkflow?.audioConvert?.formats?.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="audio-output-format" className="text-xs">
        {t('options.outputFormat')}
      </Label>
      <Select
        value={audioOutputFormat}
        disabled={isRunning}
        onValueChange={value => {
          clearError();
          setAudioOutputFormat(value);
        }}
      >
        <SelectTrigger id="audio-output-format" className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selectedWorkflow.audioConvert.formats.map(format => (
            <SelectItem key={format} value={format}>
              {t(`format.audio.${format}`, null, format.toUpperCase())}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{t('options.audioFormatHint')}</p>
    </div>
  );
}
