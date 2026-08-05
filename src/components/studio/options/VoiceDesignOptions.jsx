'use client';

import { Button } from '@/components/ui/button';
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
import { VOICE_DESIGN_PRESETS } from '@/lib/audio-prompt';

export default function VoiceDesignOptions({
  selectedWorkflow,
  voiceDesignInstruct,
  setVoiceDesignInstruct,
  ttsLanguage,
  setTtsLanguage,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (selectedWorkflow?.tts?.mode !== 'voiceDesign') {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="voice-design-instruct" className="text-xs">
          {t('options.voiceDescription')}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {VOICE_DESIGN_PRESETS.map(preset => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={voiceDesignInstruct === preset.instruct ? 'default' : 'outline'}
              className="h-7 rounded-full px-2.5 text-xs"
              disabled={isRunning}
              onClick={() => {
                clearError();
                setVoiceDesignInstruct(preset.instruct);
              }}
            >
              {t(`preset.voiceDesign.${preset.id}`, null, preset.label)}
            </Button>
          ))}
        </div>
        <Textarea
          id="voice-design-instruct"
          rows={3}
          placeholder={t('options.voiceDescriptionPlaceholder')}
          value={voiceDesignInstruct}
          disabled={isRunning}
          onChange={event => {
            clearError();
            setVoiceDesignInstruct(event.target.value);
          }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="voice-design-language" className="text-xs">
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
            <SelectTrigger id="voice-design-language" className="w-full">
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
