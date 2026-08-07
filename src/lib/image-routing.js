/**
 * Image generator routing table.
 *
 * Create → Redrob Image (https://huggingface.co/redrob-labs/redrob-image)
 */

export const INTENT_MODES = [
  {
    id: 'create',
    label: 'Create',
    description: 'New image from a text prompt',
  },
];

export const STYLE_PRESETS = [
  {
    id: 'image',
    label: 'Image',
    description: 'Any look from the prompt — photo, anime, or illustration',
    default: true,
  },
];

export const QUALITY_TIERS = [
  {
    id: 'normal',
    label: 'Normal',
    shortLabel: 'Fast',
    description: 'Redrob Image',
  },
  {
    id: 'high',
    label: 'High Fidelity',
    shortLabel: 'Best',
    description: 'Redrob Image',
  },
];

export const IMAGE_ROUTE_TABLE = {
  'create:normal': {
    label: 'Create · Redrob Image',
    intent: 'create',
    quality: 'normal',
    baseModel: 'redrob-image',
    styleVariant: null,
    workflowTask: 'redrob-image',
    pageTask: 'create',
    useFastSampler: true,
    promptEssence: 'redrob-image',
  },
  'create:high': {
    label: 'Create · Redrob Image',
    intent: 'create',
    quality: 'high',
    baseModel: 'redrob-image',
    styleVariant: null,
    workflowTask: 'redrob-image',
    pageTask: 'create',
    useFastSampler: false,
    promptEssence: 'redrob-image',
  },
};

export const KOREAN_AESTHETIC_KEYWORDS = [
  'korean',
  'korea',
  'k-pop',
  'kpop',
  'idol',
  'aegyo',
  'ulzzang',
  'seoul',
  'busan',
  'asian girl',
  'asian woman',
  'hangul',
  'hanbok',
];

export function resolveImageRoute({ intent = 'create', quality = 'normal', style = 'image', prompt = '' } = {}) {
  const key = `${intent}:${quality}`;
  const row = IMAGE_ROUTE_TABLE[key] ?? IMAGE_ROUTE_TABLE['create:normal'];
  return {
    ...row,
    style,
    prompt,
  };
}

export function nextQualityTier(quality) {
  const index = QUALITY_TIERS.findIndex((tier) => tier.id === quality);
  if (index < 0) {
    return QUALITY_TIERS[0]?.id ?? 'normal';
  }
  const next = QUALITY_TIERS[Math.min(index + 1, QUALITY_TIERS.length - 1)];
  return next.id;
}

export function getQualityTier() {
  return QUALITY_TIERS;
}
