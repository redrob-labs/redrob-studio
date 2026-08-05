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
import {
  DEFAULT_SPEAK_SPEED,
  SPEAK_SPEED_PRESETS,
  SPEAK_TONE_PRESETS,
} from '@/lib/audio-prompt';

export default function SpeakOptions({
  selectedWorkflow,
  ttsSpeaker,
  setTtsSpeaker,
  ttsLanguage,
  setTtsLanguage,
  ttsSpeed,
  setTtsSpeed,
  ttsInstruct,
  setTtsInstruct,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (selectedWorkflow?.tts?.mode !== 'customVoice') {
    return null;
  }

  const activeSpeed =
    SPEAK_SPEED_PRESETS.find(preset => preset.id === ttsSpeed) ??
    SPEAK_SPEED_PRESETS.find(preset => preset.id === DEFAULT_SPEAK_SPEED);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tts-speaker" className="text-xs">
            {t('options.voice')}
          </Label>
          <Select
            value={ttsSpeaker}
            disabled={isRunning}
            onValueChange={value => {
              clearError();
              setTtsSpeaker(value);
            }}
          >
            <SelectTrigger id="tts-speaker" className="w-full">
              <SelectValue placeholder={t('options.chooseVoice')} />
            </SelectTrigger>
            <SelectContent>
              {selectedWorkflow.tts.speakers.map(speaker => (
                <SelectItem key={speaker.id} value={speaker.id}>
                  {t(`tts.speaker.${speaker.id}`, null, speaker.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tts-language" className="text-xs">
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
            <SelectTrigger id="tts-language" className="w-full">
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
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t('options.speed')}</Label>
        <div className="flex flex-wrap gap-1.5">
          {SPEAK_SPEED_PRESETS.map(preset => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={ttsSpeed === preset.id ? 'default' : 'outline'}
              className="h-7 rounded-full px-2.5 text-xs"
              disabled={isRunning}
              onClick={() => {
                clearError();
                setTtsSpeed(preset.id);
              }}
            >
              {t(`preset.speakSpeed.${preset.id}.label`, null, preset.label)}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t(`preset.speakSpeed.${activeSpeed.id}.hint`, null, activeSpeed.hint)}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tts-instruct" className="text-xs">
          {t('options.tone')}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {SPEAK_TONE_PRESETS.map(preset => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={ttsInstruct === preset.instruct ? 'default' : 'outline'}
              className="h-7 rounded-full px-2.5 text-xs"
              disabled={isRunning}
              onClick={() => {
                clearError();
                setTtsInstruct(preset.instruct);
              }}
            >
              {t(`preset.speakTone.${preset.id}`, null, preset.label)}
            </Button>
          ))}
        </div>
        <Textarea
          id="tts-instruct"
          rows={2}
          placeholder={t('options.tonePlaceholder')}
          value={ttsInstruct}
          disabled={isRunning}
          onChange={event => {
            clearError();
            setTtsInstruct(event.target.value);
          }}
        />
      </div>
    </div>
  );
}
