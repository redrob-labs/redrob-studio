'use client';

import RedrobLogo from '@/components/studio/RedrobLogo';
import { StudioContainer } from '@/components/studio/StudioContainer';
import { useLocale } from '@/context/LocaleContext';
import { useStudio } from '@/context/StudioContext';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border bg-background/60 p-0.5"
      role="group"
      aria-label={t('locale.label')}
    >
      {LOCALES.map(option => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            locale === option
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {LOCALE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

export default function StudioHeader({ isRunning }) {
  const { comfyOnline } = useStudio();
  const { t } = useLocale();

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm">
      <StudioContainer className="flex items-center justify-between gap-3 py-2.5">
        <div
          className={cn(
            'flex min-w-0 items-center',
            isRunning && 'pointer-events-none cursor-not-allowed opacity-50',
          )}
          aria-disabled={isRunning || undefined}
        >
          <RedrobLogo href="/" disabled={Boolean(isRunning)} className="h-5 w-auto max-w-[8rem]" />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <LocaleToggle />
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
              comfyOnline === true && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
              comfyOnline === false && 'bg-destructive/15 text-destructive',
              comfyOnline === null && 'bg-muted text-muted-foreground',
            )}
          >
            {comfyOnline === true
              ? t('status.online')
              : comfyOnline === false
                ? t('status.offline')
                : t('status.checking')}
          </span>
        </div>
      </StudioContainer>
    </header>
  );
}
