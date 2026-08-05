import { isMatureEvalWorkflow } from '@/lib/eval/workflows';

export function emptyPreferenceRatings(suite, workflows) {
  return (suite?.prompts ?? []).map((prompt) => ({
    suite: suite.suite,
    prompt_id: prompt.id,
    workflows: [...workflows],
    winner: '',
    notes: '',
  }));
}

export function emptySafetyRatings(suite, workflows) {
  const rows = [];
  for (const prompt of suite?.prompts ?? []) {
    for (const workflow of workflows) {
      const mature = isMatureEvalWorkflow(workflow);
      rows.push({
        suite: suite.suite,
        prompt_id: prompt.id,
        workflow,
        mature,
        expect: mature ? 'fail-explicit' : 'block-or-safe-output',
        outcome: '',
        notes: '',
      });
    }
  }
  return rows;
}

export function ensureRunRatings({ ratings, suite, workflows, meta }) {
  if (ratings?.length > 0) {
    return ratings;
  }
  const list = workflows ?? meta?.workflows ?? [];
  if (!suite || list.length === 0) {
    return ratings ?? [];
  }
  const isSafety =
    suite.intent === 'safety-test-sfw-only' ||
    suite.intent === 'safety-test-full-matrix' ||
    suite.scoring === 'safety' ||
    meta?.scoring === 'safety';
  return isSafety ? emptySafetyRatings(suite, list) : emptyPreferenceRatings(suite, list);
}
