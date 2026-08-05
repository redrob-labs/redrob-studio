/**
 * Fail-closed safety gates for prompt (pre-gen) and output (post-gen) paths.
 * Any exception, timeout, or indeterminate result rejects the operation.
 */

export const PROMPT_GATE_TIMEOUT_MS = 15_000;
export const OUTPUT_GATE_TIMEOUT_MS = 120_000;

export class SafetyGateError extends Error {
  constructor(message, { code = 'safety_gate_failed', cause } = {}) {
    super(message);
    this.name = 'SafetyGateError';
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new SafetyGateError(`${label} timed out after ${timeoutMs}ms`, { code: 'safety_gate_timeout' }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Pre-generation prompt gate. Fail-closed: errors and timeouts throw.
 * Override `checker` in tests to force throw / pass.
 *
 * @param {string} prompt
 * @param {{ signal?: AbortSignal, timeoutMs?: number, checker?: (prompt: string, signal?: AbortSignal) => Promise<{ ok: boolean, reason?: string }> }} [options]
 */
export async function enforcePromptSafetyGate(
  prompt,
  { signal, timeoutMs = PROMPT_GATE_TIMEOUT_MS, checker = defaultPromptChecker } = {},
) {
  if (signal?.aborted) {
    throw new SafetyGateError('Prompt safety gate aborted', { code: 'safety_gate_aborted' });
  }

  let result;
  try {
    result = await withTimeout(Promise.resolve(checker(prompt ?? '', signal)), timeoutMs, 'Prompt safety gate');
  } catch (error) {
    if (error instanceof SafetyGateError) throw error;
    if (error?.name === 'AbortError' || signal?.aborted) {
      throw new SafetyGateError('Prompt safety gate aborted', { code: 'safety_gate_aborted', cause: error });
    }
    throw new SafetyGateError(
      error instanceof Error ? error.message : 'Prompt safety gate failed',
      { code: 'safety_gate_failed', cause: error },
    );
  }

  if (!result || result.ok !== true) {
    throw new SafetyGateError(result?.reason || 'Prompt blocked by safety gate', {
      code: 'safety_gate_blocked',
    });
  }

  return result;
}

/**
 * Default prompt checker: structural validation only.
 * Replace with LLM classifier when wired; must stay fail-closed.
 */
export async function defaultPromptChecker(prompt, signal) {
  if (signal?.aborted) {
    throw new SafetyGateError('Prompt safety gate aborted', { code: 'safety_gate_aborted' });
  }
  if (typeof prompt !== 'string') {
    return { ok: false, reason: 'Prompt must be a string' };
  }
  // Empty prompts are allowed for image-only tools (upscale, etc.).
  return { ok: true };
}

/**
 * Post-generation output gate. Fail-closed: parse errors, null outcomes,
 * suggestive/explicit outcomes, and thrown checkers reject (caller must not
 * treat the media as approved). No blur/reveal path — unsafe images are dropped.
 *
 * @param {() => Promise<{ outcome: string | null, parseError?: boolean }>} moderate
 */
export async function enforceOutputSafetyGate(
  moderate,
  { signal, timeoutMs = OUTPUT_GATE_TIMEOUT_MS } = {},
) {
  if (signal?.aborted) {
    throw new SafetyGateError('Output safety gate aborted', { code: 'safety_gate_aborted' });
  }

  let result;
  try {
    result = await withTimeout(Promise.resolve(moderate()), timeoutMs, 'Output safety gate');
  } catch (error) {
    if (error instanceof SafetyGateError) throw error;
    if (error?.name === 'AbortError' || signal?.aborted) {
      throw new SafetyGateError('Output safety gate aborted', { code: 'safety_gate_aborted', cause: error });
    }
    throw new SafetyGateError(
      error instanceof Error ? error.message : 'Output safety gate failed',
      { code: 'safety_gate_failed', cause: error },
    );
  }

  if (!result || result.parseError || !result.outcome) {
    throw new SafetyGateError('Output safety gate returned an indeterminate result', {
      code: 'safety_gate_indeterminate',
    });
  }

  if (result.outcome === 'fail-suggestive' || result.outcome === 'fail-explicit') {
    throw new SafetyGateError(result.rationale || 'Output blocked by safety gate', {
      code: 'safety_gate_blocked',
    });
  }

  return result;
}
