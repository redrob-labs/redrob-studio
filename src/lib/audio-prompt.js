export const SPEAK_PROMPT_EXAMPLES = [
  {
    id: 'welcome',
    label: 'Welcome',
    text: 'Welcome back! Thanks for being here today.',
  },
  {
    id: 'narration',
    label: 'Narration',
    text: 'The sun rose over the quiet harbor, painting the water in shades of gold.',
  },
  {
    id: 'announcement',
    label: 'Announcement',
    text: 'Doors open at nine, please have your ticket ready at the entrance.',
  },
  {
    id: 'dialogue',
    label: 'Dialogue',
    text: 'I have been thinking about what you said — can we talk about it tonight?',
  },
];

export const SPEAK_TONE_PRESETS = [
  { id: 'neutral', label: 'Neutral', instruct: '' },
  { id: 'warm', label: 'Warm', instruct: 'warm and friendly' },
  { id: 'calm', label: 'Calm', instruct: 'calm and reassuring' },
  { id: 'excited', label: 'Excited', instruct: 'energetic and enthusiastic' },
  { id: 'serious', label: 'Serious', instruct: 'serious and professional' },
  { id: 'story', label: 'Storytelling', instruct: 'gentle storytelling tone' },
];

export const DEFAULT_SPEAK_SPEED = 'normal';

export const SPEAK_SPEED_PRESETS = [
  {
    id: 'slow',
    label: 'Slow',
    hint: 'Clear and unhurried — tutorials, disclaimers',
    instruct: 'slow steady pace',
  },
  {
    id: 'normal',
    label: 'Normal',
    hint: 'Everyday speech — start here',
    instruct: '',
  },
  {
    id: 'fast',
    label: 'Fast',
    hint: 'Snappier delivery — tighter pauses, promos',
    instruct: 'slightly faster pace',
  },
];

const SPEAK_TIGHT_PACING_INSTRUCT =
  'continuous flow, avoid long silent gaps between sentences';

export const DEFAULT_SPEAK_PAUSE_STYLE = 'tight';

export const SPEAK_PAUSE_PRESETS = [
  {
    id: 'tight',
    label: 'Short gaps',
    hint: 'Best for announcements and dialogue — joins sentences with light pauses',
  },
  {
    id: 'natural',
    label: 'Natural gaps',
    hint: 'Keeps full stops — better for storytelling',
  },
];

function tightenSentencePauses(text) {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return text;
  }

  return parts
    .map((part, index) => {
      const body = part.replace(/[.!?]+\s*$/, '').trim();
      if (!body) {
        return '';
      }

      if (index === parts.length - 1) {
        const ending = part.match(/[.!?]+\s*$/)?.[0]?.trim() ?? '.';
        const normalized = body.charAt(0).toUpperCase() + body.slice(1);
        return `${normalized}${ending}`;
      }

      if (index === 0) {
        return body.charAt(0).toUpperCase() + body.slice(1);
      }

      return body.charAt(0).toLowerCase() + body.slice(1);
    })
    .filter(Boolean)
    .join(', ');
}

export function prepareSpeakText(text, { style = 'tight' } = {}) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let result = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, ', ')
    .replace(/\n/g, ', ')
    .replace(/…/g, '.')
    .replace(/\.{3,}/g, '.')
    .replace(/—/g, ', ')
    .replace(/\s+–\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (style === 'tight') {
    result = tightenSentencePauses(result);
  }

  return result;
}

export function resolveSpeakPauseStyle(toneInstruct = '', pauseStyle = DEFAULT_SPEAK_PAUSE_STYLE) {
  if (pauseStyle === 'natural' || pauseStyle === 'tight') {
    return pauseStyle;
  }
  return /storytelling/i.test(toneInstruct.trim()) ? 'natural' : 'tight';
}

export function estimateTtsMaxNewTokens(text) {
  const trimmed = prepareSpeakText(text);
  if (!trimmed) {
    return 512;
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.max(words / 2.4, trimmed.length / 15);
  const tokens = Math.ceil(estimatedSeconds * 12 * 1.05);
  const rounded = Math.ceil(tokens / 256) * 256;

  return Math.min(1024, Math.max(512, rounded));
}

export function buildSpeakInstruct({
  speedId = DEFAULT_SPEAK_SPEED,
  toneInstruct = '',
  pauseStyle = DEFAULT_SPEAK_PAUSE_STYLE,
} = {}) {
  const speed =
    SPEAK_SPEED_PRESETS.find(preset => preset.id === speedId)?.instruct ?? '';
  const tone = toneInstruct.trim();
  const resolvedPauseStyle = resolveSpeakPauseStyle(tone, pauseStyle);
  const pacingInstruct = resolvedPauseStyle === 'tight' ? SPEAK_TIGHT_PACING_INSTRUCT : '';
  const parts = [pacingInstruct, tone, speed].filter(Boolean);
  return [...new Set(parts)].join(', ');
}

export const VOICE_DESIGN_EXAMPLES = [
  {
    id: 'warm-narrator',
    label: 'Warm narrator',
    text: 'Once upon a time, in a village by the sea, the lanterns came alive at dusk.',
    instruct: 'A warm, gentle female narrator with a storytelling tone.',
  },
  {
    id: 'news-anchor',
    label: 'News anchor',
    text: 'Good evening. Here are the top stories from around the world.',
    instruct: 'A clear, confident male news anchor voice with crisp diction.',
  },
  {
    id: 'friendly-guide',
    label: 'Friendly guide',
    text: 'Welcome aboard! I will walk you through the highlights of the tour.',
    instruct: 'An upbeat, friendly tour guide with a welcoming smile in the voice.',
  },
];

export const VOICE_DESIGN_PRESETS = [
  {
    id: 'warm-female',
    label: 'Warm female',
    instruct: 'A warm, friendly female voice with a gentle tone.',
  },
  {
    id: 'deep-male',
    label: 'Deep male',
    instruct: 'A deep, calm male voice with steady pacing.',
  },
  {
    id: 'young-energetic',
    label: 'Young & energetic',
    instruct: 'A young, energetic voice with bright enthusiasm.',
  },
  {
    id: 'calm-meditation',
    label: 'Calm meditation',
    instruct: 'A soft, slow, calming voice suited for meditation.',
  },
];
