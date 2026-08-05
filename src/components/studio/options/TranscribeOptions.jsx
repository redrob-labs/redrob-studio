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
import { toKeySegment } from '@/lib/i18n/keys';

export default function TranscribeOptions({
  selectedWorkflow,
  asrModelSize,
  setAsrModelSize,
  asrLanguage,
  setAsrLanguage,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (!selectedWorkflow?.asr) {
    return null;
  }

  const languages = selectedWorkflow.asr.languages ?? [
    { value: 'auto', label: 'Auto-detect' },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asr-model" className="text-xs">
          {t('options.quality')}
        </Label>
        <Select
          value={asrModelSize}
          disabled={isRunning}
          onValueChange={value => {
            clearError();
            setAsrModelSize(value);
          }}
        >
          <SelectTrigger id="asr-model" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(selectedWorkflow.asr.modelSizes ?? []).map(size => (
              <SelectItem key={size.id} value={size.id}>
                {t(`asr.model.${toKeySegment(size.id)}`, null, size.label ?? size.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asr-language" className="text-xs">
          {t('options.language')}
        </Label>
        <Select
          value={asrLanguage}
          disabled={isRunning}
          onValueChange={value => {
            clearError();
            setAsrLanguage(value);
          }}
        >
          <SelectTrigger id="asr-language" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map(language => (
              <SelectItem key={language.value} value={language.value}>
                {t(`asr.language.${language.value}`, null, language.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
