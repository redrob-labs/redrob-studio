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
import {
  REDROB_TUNE_KEY_SCALES,
  REDROB_TUNE_LANGUAGES,
  REDROB_TUNE_SECTIONS,
  REDROB_TUNE_TIME_SIGNATURES,
  REDROB_TUNE_TEMPLATES,
  insertMusicSection,
} from '@/lib/redrob-tune';

const DURATION_PRESETS = [30, 60, 90, 120, 180];

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function MusicOptions({
  selectedWorkflow,
  musicModel,
  setMusicModel,
  musicLyrics,
  setMusicLyrics,
  musicSeconds,
  setMusicSeconds,
  musicBpm,
  setMusicBpm,
  musicKeyScale,
  setMusicKeyScale,
  musicTimeSignature,
  setMusicTimeSignature,
  musicLanguage,
  setMusicLanguage,
  setPrompt,
  audioFiles,
  isRunning,
  clearError,
}) {
  const t = useT();

  if (!selectedWorkflow?.music) {
    return null;
  }

  const models = selectedWorkflow.music.models ?? [];
  const selectedModel = models.find(model => model.id === musicModel) ?? models[0];
  const secondsMin = selectedWorkflow.music.secondsMin ?? 10;
  const secondsMax = selectedWorkflow.music.secondsMax ?? 600;
  const refAudioNode = selectedWorkflow.music.refAudioNode ?? null;
  const hasRefAudio = Boolean(refAudioNode && audioFiles?.[refAudioNode]);
  const refTrimSeconds = selectedWorkflow.music.refTrimSeconds ?? 30;
  const durationPresets = DURATION_PRESETS.filter(
    value => value >= secondsMin && value <= secondsMax,
  );

  return (
    <>
      {models.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="music-model" className="text-xs">
            Redrob Tune
          </Label>
          <Select
            value={musicModel}
            disabled={isRunning}
            onValueChange={value => {
              clearError();
              setMusicModel(value);
            }}
          >
            <SelectTrigger id="music-model" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {t(`music.model.${model.id}.label`, null, model.label ?? model.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedModel?.description ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t(`music.model.${selectedModel.id}.description`, null, selectedModel.description)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t('options.templates')}</Label>
        <div className="flex flex-wrap gap-1.5">
          {REDROB_TUNE_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              className="border-input bg-background hover:bg-muted rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-50"
              disabled={isRunning}
              onClick={() => {
                clearError();
                setPrompt?.(template.prompt);
                setMusicLyrics(template.lyrics);
                setMusicBpm(template.bpm);
                setMusicKeyScale(template.keyScale);
                setMusicTimeSignature(template.timeSignature);
                setMusicLanguage(template.language);
                setMusicSeconds(template.seconds);
              }}
            >
              {t(`music.template.${template.id}`, null, template.label)}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t('options.templatesHint')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="music-duration" className="text-xs">
            {t('options.duration')}
          </Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatDuration(musicSeconds)} ({t('options.durationSeconds', { seconds: musicSeconds })})
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {durationPresets.map(value => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-50 ${
                musicSeconds === value
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-input bg-background hover:bg-muted'
              }`}
              disabled={isRunning}
              onClick={() => {
                clearError();
                setMusicSeconds(value);
              }}
            >
              {formatDuration(value)}
            </button>
          ))}
        </div>
        <input
          id="music-duration"
          type="range"
          className="accent-primary w-full"
          min={secondsMin}
          max={secondsMax}
          step={5}
          value={musicSeconds}
          disabled={isRunning}
          onChange={event => {
            clearError();
            setMusicSeconds(Number(event.target.value));
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="music-lyrics" className="text-xs">
          {t('options.lyrics')}
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">{t('options.lyricsHint')}</p>
        <div className="flex flex-wrap gap-1.5">
          {REDROB_TUNE_SECTIONS.map(section => (
            <button
              key={section.id}
              type="button"
              className="border-input bg-background hover:bg-muted rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-50"
              disabled={isRunning}
              onClick={() => {
                clearError();
                setMusicLyrics(insertMusicSection(musicLyrics, section.marker));
              }}
            >
              + {t(`music.section.${section.id}`, null, section.label)}
            </button>
          ))}
        </div>
        <textarea
          id="music-lyrics"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-32 w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
          value={musicLyrics}
          disabled={isRunning}
          onChange={event => {
            clearError();
            setMusicLyrics(event.target.value);
          }}
          placeholder={t('options.lyricsPlaceholder')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="music-bpm" className="text-xs">
              BPM
            </Label>
            <span className="text-muted-foreground text-xs tabular-nums">{musicBpm}</span>
          </div>
          <input
            id="music-bpm"
            type="range"
            className="accent-primary w-full"
            min={40}
            max={220}
            step={1}
            value={musicBpm}
            disabled={isRunning}
            onChange={event => {
              clearError();
              setMusicBpm(Number(event.target.value));
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="music-time-sig" className="text-xs">
            {t('options.timeSignature')}
          </Label>
          <Select
            value={musicTimeSignature}
            disabled={isRunning}
            onValueChange={value => {
              clearError();
              setMusicTimeSignature(value);
            }}
          >
            <SelectTrigger id="music-time-sig" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REDROB_TUNE_TIME_SIGNATURES.map(sig => (
                <SelectItem key={sig} value={sig}>
                  {sig}/4
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="music-key" className="text-xs">
            {t('options.keyScale')}
          </Label>
          <Select
            value={musicKeyScale}
            disabled={isRunning}
            onValueChange={value => {
              clearError();
              setMusicKeyScale(value);
            }}
          >
            <SelectTrigger id="music-key" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REDROB_TUNE_KEY_SCALES.map(key => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="music-lang" className="text-xs">
            {t('options.lyricsLanguage')}
          </Label>
          <Select
            value={musicLanguage}
            disabled={isRunning}
            onValueChange={value => {
              clearError();
              setMusicLanguage(value);
            }}
          >
            <SelectTrigger id="music-lang" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REDROB_TUNE_LANGUAGES.map(lang => (
                <SelectItem key={lang} value={lang}>
                  {t(`music.language.${lang}`, null, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {refAudioNode ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {hasRefAudio
            ? t('options.refAudioOn', { seconds: refTrimSeconds })
            : t('options.refAudioOff', { seconds: refTrimSeconds })}
        </p>
      ) : null}
    </>
  );
}
