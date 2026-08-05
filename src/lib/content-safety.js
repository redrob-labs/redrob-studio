/**
 * Chat content safety helpers (QwenVL moderation outcomes).
 */

export const NSFW_MODERATION_OUTCOMES = new Set(['fail-suggestive', 'fail-explicit']);

export function isMatureModerationOutcome(outcome) {
  return NSFW_MODERATION_OUTCOMES.has(outcome);
}
