import {
  AudioLines,
  FileAudio,
  FileImage,
  FileText,
  Maximize2,
  Mic,
  Minimize2,
  Music,
  Palette,
  ScanText,
} from 'lucide-react';

export const TOOL_VISUALS = {
  create: { icon: Palette, accent: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  'redrob-image': { icon: Palette, accent: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  upscale: { icon: Maximize2, accent: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  'compress-image': { icon: Minimize2, accent: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  speak: { icon: Mic, accent: 'bg-lime-500/15 text-lime-600 dark:text-lime-400' },
  'voice-clone': { icon: AudioLines, accent: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  'voice-design': { icon: Palette, accent: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400' },
  transcribe: { icon: FileText, accent: 'bg-stone-500/15 text-stone-600 dark:text-stone-400' },
  music: { icon: Music, accent: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  'extract-audio': { icon: FileAudio, accent: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  'convert-audio': { icon: FileAudio, accent: 'bg-lime-500/15 text-lime-600 dark:text-lime-400' },
  'convert-image': { icon: FileImage, accent: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  vision: { icon: ScanText, accent: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
};
