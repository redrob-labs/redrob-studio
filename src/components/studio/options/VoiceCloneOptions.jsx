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
import { Textarea } from '@/components/ui/textarea';

export default function VoiceCloneOptions({
  selectedWorkflow,
  voiceCloneRefText,
  setVoiceCloneRefText,
  ttsLanguage,
  setTtsLanguage,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (selectedWorkflow?.tts?.mode !== 'voiceClone') {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="voice-clone-ref-text" className="text-xs">
          {t('options.referenceTranscript')} *
        </Label>
        <Textarea
          id="voice-clone-ref-text"
          rows={2}
          placeholder={t('options.referenceTranscriptPlaceholder')}
          value={voiceCloneRefText}
          disabled={isRunning}
          onChange={event => {
            clearError();
            setVoiceCloneRefText(event.target.value);
          }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="voice-clone-language" className="text-xs">
            {t('options.language')}
          </Label>
          <Select
            value={ttsLanguage}
            disabled={isRunning}
            onValueChange={value => {
              clearError();
              setTtsLanguage(value);
            }}
          >
            <SelectTrigger id="voice-clone-language" className="w-full">
              <SelectValue placeholder={t('options.language')} />
            </SelectTrigger>
            <SelectContent>
              {selectedWorkflow.tts.languages.map(language => (
                <SelectItem key={language.id} value={language.id}>
                  {t(`tts.language.${language.id}`, null, language.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
