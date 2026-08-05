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

export default function VisionOptions({
  selectedWorkflow,
  vlmMode,
  setVlmMode,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (!selectedWorkflow?.vlm) {
    return null;
  }

  const modes = selectedWorkflow.vlm.modes ?? [];
  if (modes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="vlm-mode" className="text-xs">
        {t('options.analysisType')}
      </Label>
      <Select
        value={vlmMode}
        disabled={isRunning}
        onValueChange={value => {
          clearError();
          setVlmMode(value);
        }}
      >
        <SelectTrigger id="vlm-mode" className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modes.map(mode => (
            <SelectItem key={mode.id} value={mode.id}>
              {t(`vision.mode.${mode.id}`, null, mode.label ?? mode.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{t('options.analysisHint')}</p>
    </div>
  );
}
