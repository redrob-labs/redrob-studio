import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SafetyGateError,
  enforceOutputSafetyGate,
  enforcePromptSafetyGate,
} from './safety-gate.js';

describe('enforcePromptSafetyGate', () => {
  it('rejects when checker throws (generation must be refused)', async () => {
    await assert.rejects(
      () =>
        enforcePromptSafetyGate('hello', {
          checker: async () => {
            throw new Error('forced gate failure');
          },
        }),
      (error) => error instanceof SafetyGateError && /forced gate failure/.test(error.message),
    );
  });

  it('rejects when checker returns ok:false', async () => {
    await assert.rejects(
      () =>
        enforcePromptSafetyGate('hello', {
          checker: async () => ({ ok: false, reason: 'blocked by policy' }),
        }),
      (error) => error instanceof SafetyGateError && error.code === 'safety_gate_blocked',
    );
  });

  it('rejects on timeout', async () => {
    await assert.rejects(
      () =>
        enforcePromptSafetyGate('hello', {
          timeoutMs: 20,
          checker: () => new Promise(() => {}),
        }),
      (error) => error instanceof SafetyGateError && error.code === 'safety_gate_timeout',
    );
  });

  it('passes when checker returns ok:true', async () => {
    const result = await enforcePromptSafetyGate('hello', {
      checker: async () => ({ ok: true }),
    });
    assert.equal(result.ok, true);
  });
});

describe('enforceOutputSafetyGate', () => {
  it('rejects indeterminate outcomes', async () => {
    await assert.rejects(
      () =>
        enforceOutputSafetyGate(async () => ({
          outcome: null,
          parseError: true,
        })),
      (error) => error instanceof SafetyGateError && error.code === 'safety_gate_indeterminate',
    );
  });

  it('rejects when moderate throws', async () => {
    await assert.rejects(
      () =>
        enforceOutputSafetyGate(async () => {
          throw new Error('vlm down');
        }),
      (error) => error instanceof SafetyGateError && /vlm down/.test(error.message),
    );
  });

  it('rejects suggestive / explicit outcomes (no blur-reveal path)', async () => {
    await assert.rejects(
      () =>
        enforceOutputSafetyGate(async () => ({
          outcome: 'fail-explicit',
          rationale: 'explicit content',
        })),
      (error) => error instanceof SafetyGateError && error.code === 'safety_gate_blocked',
    );
  });

  it('passes safe-output', async () => {
    const result = await enforceOutputSafetyGate(async () => ({
      outcome: 'safe-output',
      rationale: 'ok',
    }));
    assert.equal(result.outcome, 'safe-output');
  });
});

describe('assertNoClientGraph (inline)', () => {
  function assertNoClientGraph(value, label = 'prompt') {
    if (value == null) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nodes = Object.values(value);
      if (nodes.some((node) => node && typeof node === 'object' && 'class_type' in node)) {
        throw new Error(`Client-supplied ${label} graphs are not allowed`);
      }
    }
  }

  it('rejects class_type graphs', () => {
    assert.throws(
      () =>
        assertNoClientGraph({
          '1': { class_type: 'KSampler', inputs: {} },
        }),
      /not allowed/,
    );
  });

  it('allows null', () => {
    assertNoClientGraph(null);
  });
});
