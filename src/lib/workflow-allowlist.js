import { getWorkflowOptions } from '@/lib/workflows';

/**
 * Server-side allowlists derived from shipped workflow templates.
 * Client-supplied class_type graphs are never accepted for /prompt.
 */

let cached = null;

function collectFromNode(node, into) {
  if (!node || typeof node !== 'object') return;
  const classType = node.class_type;
  if (typeof classType === 'string') {
    into.classTypes.add(classType);
  }
  const inputs = node.inputs ?? {};
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value !== 'string') continue;
    const lower = key.toLowerCase();
    if (
      lower.includes('ckpt') ||
      lower === 'unet_name' ||
      lower === 'model_name' ||
      lower.endsWith('_name') && value.endsWith('.safetensors')
    ) {
      if (value.includes('.') || value.includes('/')) {
        into.checkpoints.add(value);
      }
    }
    if (lower.includes('lora') && (value.endsWith('.safetensors') || value.endsWith('.pt'))) {
      into.loras.add(value);
    }
    if (lower === 'sampler_name' || lower === 'scheduler') {
      into.samplers.add(value);
    }
  }
}

function buildAllowlist() {
  const classTypes = new Set();
  const checkpoints = new Set();
  const loras = new Set();
  const samplers = new Set();
  const workflowIds = new Set();

  for (const option of getWorkflowOptions()) {
    workflowIds.add(option.id);
    const graph = option.workflow;
    if (!graph || typeof graph !== 'object') continue;
    for (const node of Object.values(graph)) {
      collectFromNode(node, { classTypes, checkpoints, loras, samplers });
    }
    if (option.checkpoint?.name) checkpoints.add(option.checkpoint.name);
    if (option.lora?.name) loras.add(option.lora.name);
  }

  return {
    workflowIds,
    classTypes,
    checkpoints,
    loras,
    samplers,
  };
}

export function getWorkflowAllowlist() {
  if (!cached) {
    cached = buildAllowlist();
  }
  return cached;
}

export function assertAllowedWorkflowId(workflowId) {
  const { workflowIds } = getWorkflowAllowlist();
  if (!workflowId || !workflowIds.has(workflowId)) {
    throw new Error(`Workflow not allowlisted: ${workflowId ?? '(missing)'}`);
  }
}

export function resolveAllowlistedWorkflow(workflowId) {
  assertAllowedWorkflowId(workflowId);
  const option = getWorkflowOptions().find((entry) => entry.id === workflowId);
  if (!option?.workflow) {
    throw new Error(`Workflow template missing for ${workflowId}`);
  }
  return option;
}

/** Reject any client-supplied Comfy graph object. */
export function assertNoClientGraph(value, label = 'prompt') {
  if (value == null) return;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const nodes = Object.values(value);
    if (nodes.some((node) => node && typeof node === 'object' && 'class_type' in node)) {
      throw new Error(`Client-supplied ${label} graphs are not allowed`);
    }
  }
}
