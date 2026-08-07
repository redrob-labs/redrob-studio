import { getWorkflowOptions } from '@/lib/workflows';

export const TOOL_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Image' },
  { id: 'audio', label: 'Audio' },
];

export function getToolCategory(_taskId, modality) {
  if (modality === 'audio') {
    return modality;
  }
  return 'image';
}

export const PHOTO_TASK_IDS = [
  'upscale',
  'compress-image',
  'convert-image',
];

export const IMAGE_INTENT_MODES = [
  {
    id: 'create',
    label: 'Create',
    description: 'Generate a new image from a text prompt.',
  },
  {
    id: 'from-photo',
    label: 'From photo',
    description: 'Upload a photo to upscale, compress, or convert.',
  },
];

/**
 * Create-from-scratch diffusion families.
 * Default: Redrob Image — https://huggingface.co/redrob-labs/redrob-image
 */
export const CREATE_MODEL_FAMILIES = [
  {
    id: 'redrob-image',
    label: 'Redrob Image',
    description:
      'Redrob Image — Apache-2.0 merged UNET from redrob-labs/redrob-image (Z-Image Turbo lineage).',
    defaultTask: 'redrob-image',
    task: 'redrob-image',
    recommended: true,
  },
];

/** UX / legacy Create task aliases → shipped workflow task. */
const CREATE_MODEL_ALIASES = {
  create: 'redrob-image',
  'redrob-image': 'redrob-image',
  'redrob-imagine': 'redrob-image',
  'redrob-turbo': 'redrob-image',
  'z-image': 'redrob-image',
  'z-image-snapshot': 'redrob-image',
  'z-image-turbo': 'redrob-image',
  'z-image-zepic': 'redrob-image',
  'z-image-rebelreal': 'redrob-image',
  'z-image-nexblend01': 'redrob-image',
  'z-image-nexblend06': 'redrob-image',
  'z-image-creating-realistic': 'redrob-image',
  'qwen-2512-flymy': 'redrob-image',
  'qwen-2512-iphone': 'redrob-image',
  'boogu-base': 'redrob-image',
  'boogu-turbo': 'redrob-image',
  'boogu-nexblend01': 'redrob-image',
  'boogu-nexblend05': 'redrob-image',
  'boogu-rebelreal': 'redrob-image',
  'ernie-turbo': 'redrob-image',
  'flux-klein-4b': 'redrob-image',
};

function getDefaultStyleVariant(family) {
  return family?.styleVariants?.find((variant) => variant.default) ?? family?.styleVariants?.[0] ?? null;
}

export function getCreateModelFamily(familyId) {
  return CREATE_MODEL_FAMILIES.find((family) => family.id === familyId) ?? CREATE_MODEL_FAMILIES[0] ?? null;
}

export function getAllCreateWorkflowTasks() {
  const tasks = new Set();
  for (const family of CREATE_MODEL_FAMILIES) {
    if (family.task) tasks.add(family.task);
    if (family.defaultTask) tasks.add(family.defaultTask);
    for (const variant of family.styleVariants ?? []) {
      tasks.add(variant.task);
    }
  }
  return tasks;
}

export function inferCreateSelectionFromTask(taskOrStyleId) {
  const task = CREATE_MODEL_ALIASES[taskOrStyleId] ?? taskOrStyleId ?? 'redrob-image';

  for (const family of CREATE_MODEL_FAMILIES) {
    if (family.task === task) {
      const defaultVariant = getDefaultStyleVariant(family);
      return {
        baseModel: family.id,
        styleVariant: defaultVariant?.id ?? null,
      };
    }

    const variant = family.styleVariants?.find((entry) => entry.task === task);
    if (variant) {
      return { baseModel: family.id, styleVariant: variant.id };
    }
  }

  const fallback = CREATE_MODEL_FAMILIES[0];
  const defaultVariant = getDefaultStyleVariant(fallback);
  return {
    baseModel: fallback?.id ?? null,
    styleVariant: defaultVariant?.id ?? null,
  };
}

export function resolveCreateWorkflowTask(baseModelId, styleVariantId) {
  const family = getCreateModelFamily(baseModelId);
  if (!family) {
    return 'redrob-image';
  }
  const variantId =
    styleVariantId === 'default' || styleVariantId === 'redcraft'
      ? family.defaultTask
      : styleVariantId;

  if (family.styleVariants?.length) {
    const variant =
      family.styleVariants.find((entry) => entry.id === variantId) ??
      getDefaultStyleVariant(family);
    return variant?.task ?? family.defaultTask ?? 'redrob-image';
  }

  return family.task ?? family.defaultTask ?? 'redrob-image';
}

/** Style query value for Create URLs; omit when on the family default. */
export function getCreateUrlStyleParam(baseModelId, styleVariantId) {
  const family = getCreateModelFamily(baseModelId);
  if (!family) {
    return null;
  }
  const defaultVariant = getDefaultStyleVariant(family);
  const task = resolveCreateWorkflowTask(baseModelId, styleVariantId);
  if (task === defaultVariant?.task || task === family.defaultTask || task === family.task) {
    return null;
  }
  return task;
}

export function getAvailableCreateModelFamilies() {
  const workflowTasks = new Set(
    getWorkflowOptions()
      .filter((workflow) => workflow.modality === 'image')
      .map((workflow) => workflow.task),
  );

  return CREATE_MODEL_FAMILIES.filter((family) => {
    if (family.task && workflowTasks.has(family.task)) {
      return true;
    }
    if (family.defaultTask && workflowTasks.has(family.defaultTask)) {
      return true;
    }
    return (family.styleVariants ?? []).some((variant) => workflowTasks.has(variant.task));
  });
}

/** Normalize legacy / current style query → Create workflow task (or UX `create`). */
export function normalizeCreateModelId(modelId) {
  if (!modelId) {
    return 'redrob-image';
  }
  const aliased = CREATE_MODEL_ALIASES[modelId] ?? modelId;
  if (getAllCreateWorkflowTasks().has(aliased)) {
    return aliased;
  }
  return 'redrob-image';
}

export function getDefaultStyleVariantForFamily(familyId) {
  return getDefaultStyleVariant(getCreateModelFamily(familyId));
}

export function getAvailableStyleVariants(familyId) {
  const family = getCreateModelFamily(familyId);
  if (!family) {
    return [];
  }
  const workflowTasks = new Set(
    getWorkflowOptions()
      .filter((workflow) => workflow.modality === 'image')
      .map((workflow) => workflow.task),
  );
  return (family.styleVariants ?? []).filter((variant) => workflowTasks.has(variant.task));
}

export function isCreateStyleTask(taskId) {
  if (!taskId || taskId === 'create') {
    return true;
  }
  return getAllCreateWorkflowTasks().has(CREATE_MODEL_ALIASES[taskId] ?? taskId);
}

/**
 * Resolve a concrete workflow option for a modality + task (+ optional engine).
 */
export function resolveWorkflow({ modality, task, engine } = {}) {
  const options = getWorkflowOptions().filter((workflow) => {
    if (modality && workflow.modality !== modality) {
      return false;
    }
    return true;
  });

  const aliased = CREATE_MODEL_ALIASES[task] ?? task;

  if (aliased === 'create' || !aliased) {
    const createTask = resolveCreateWorkflowTask(
      CREATE_MODEL_FAMILIES[0]?.id,
      getDefaultStyleVariant(CREATE_MODEL_FAMILIES[0])?.id,
    );
    return options.find((workflow) => workflow.task === createTask) ?? null;
  }

  if (engine && aliased === 'music') {
    const byEngine = options.find(
      (workflow) => workflow.task === 'music' && workflow.music?.engine === engine,
    );
    if (byEngine) {
      return byEngine;
    }
  }

  return (
    options.find((workflow) => workflow.task === aliased) ??
    options.find((workflow) => workflow.task === task) ??
    null
  );
}

const TASK_META = {
  create: {
    id: 'create',
    label: 'Create',
    description: 'Generate an image from a text prompt.',
  },
  upscale: {
    id: 'upscale',
    label: 'Upscale',
    description: 'Enlarge a photo with Lanczos.',
  },
  'compress-image': {
    id: 'compress-image',
    label: 'Compress',
    description: 'Shrink image file size.',
  },
  'convert-image': {
    id: 'convert-image',
    label: 'Convert',
    description: 'Convert image format.',
  },
  speak: {
    id: 'speak',
    label: 'Speak',
    description: 'Text to speech.',
  },
  'voice-clone': {
    id: 'voice-clone',
    label: 'Clone',
    description: 'Clone a voice from a sample.',
  },
  'voice-design': {
    id: 'voice-design',
    label: 'Design',
    description: 'Design a voice from a description.',
  },
  transcribe: {
    id: 'transcribe',
    label: 'Transcribe',
    description: 'Speech to text.',
  },
  music: {
    id: 'music',
    label: 'Music',
    description: 'Generate music.',
  },
  'extract-audio': {
    id: 'extract-audio',
    label: 'Extract audio',
    description: 'Pull audio from a video.',
  },
  'convert-audio': {
    id: 'convert-audio',
    label: 'Convert audio',
    description: 'Convert audio format.',
  },
  vision: {
    id: 'vision',
    label: 'Vision',
    description: 'Describe an image.',
  },
};

/** UX task list for a modality (Create collapses to one `create` entry). */
export function getAvailableTasks(modality) {
  const options = getWorkflowOptions().filter((workflow) => workflow.modality === modality);
  const tasks = [];
  const seen = new Set();

  if (modality === 'image') {
    const createTasks = getAllCreateWorkflowTasks();
    const hasCreate = options.some((workflow) => createTasks.has(workflow.task));
    if (hasCreate) {
      tasks.push({ id: 'create', label: 'Create', description: TASK_META.create.description });
      seen.add('create');
    }
  }

  for (const workflow of options) {
    const task = workflow.task;
    if (!task || seen.has(task)) {
      continue;
    }
    if (getAllCreateWorkflowTasks().has(task)) {
      continue;
    }
    seen.add(task);
    const meta = TASK_META[task];
    tasks.push({
      id: task,
      label: meta?.label ?? workflow.name ?? task,
      description: meta?.description ?? '',
    });
  }

  return tasks;
}

export function getTaskMeta(modality, taskId) {
  if (taskId === 'create' || isCreateStyleTask(taskId)) {
    return TASK_META.create;
  }
  return (
    TASK_META[taskId] ?? {
      id: taskId,
      label: taskId,
      description: '',
    }
  );
}
