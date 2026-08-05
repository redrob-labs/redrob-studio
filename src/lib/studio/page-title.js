import { PAGE_TITLE } from '@/lib/studio/constants';

export function getPageTitle({
  isRunning,
  runningAction,
  activityPhase,
  progress,
  runningLabel,
  isVideoMode,
  isAudioMode,
  comfyOnline,
}) {
  if (isRunning) {
    const status =
      activityPhase ??
      (runningAction === 'preload'
        ? 'Preparing…'
        : runningLabel ?? (isVideoMode ? 'Generating video…' : isAudioMode ? 'Generating speech…' : 'Generating…'));
    return progress > 0 ? `${progress}% · ${status} — ${PAGE_TITLE}` : `${status} — ${PAGE_TITLE}`;
  }

  if (comfyOnline === false) {
    return `System offline — ${PAGE_TITLE}`;
  }

  if (comfyOnline === null) {
    return `Checking system… — ${PAGE_TITLE}`;
  }

  return PAGE_TITLE;
}
