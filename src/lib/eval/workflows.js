import { CREATE_MODEL_FAMILIES, resolveWorkflow } from '@/lib/workflow-catalog';
import { getWorkflowOptions } from '@/lib/workflows';

/** Eval-facing base ids that differ from Comfy workflow tasks. */
const EVAL_ID_BY_TASK = {};

/** Legacy suite / combo ids → current task. */
const TASK_BY_EVAL_ID = {
  'redrob-image': 'redrob-image',
  'redrob-imagine': 'redrob-image',
  'redrob-turbo': 'redrob-image',
  create: 'redrob-image',
  'ernie-turbo': 'redrob-image',
  'z-image-turbo': 'redrob-image',
  'z-image-zepic': 'redrob-image',
  'z-image-rebelreal': 'redrob-image',
  'z-image-snapshot': 'redrob-image',
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
  'flux-klein-4b': 'redrob-image',
};

function baseEvalIdForTask(task) {
  return EVAL_ID_BY_TASK[task] ?? task;
}

function normalizeEvalBaseId(id) {
  return TASK_BY_EVAL_ID[id] ?? id;
}

function getToggleableLoraSlots(workflow) {
  const slots = [];
  if (workflow?.lora?.id) {
    slots.push({
      id: workflow.lora.id,
      kind: 'style',
      label: workflow.lora.label ?? workflow.lora.id,
      matureOnly: false,
      strength: workflow.lora.strength,
    });
  }
  return slots;
}

function enumerateEnabledMasks(slotIds) {
  const count = slotIds.length;
  if (count === 0) {
    return [{}];
  }
  const masks = [];
  const total = 1 << count;
  for (let bits = 0; bits < total; bits += 1) {
    const enabled = {};
    for (let index = 0; index < count; index += 1) {
      enabled[slotIds[index]] = Boolean(bits & (1 << index));
    }
    masks.push(enabled);
  }
  return masks;
}

function comboSuffix(enabled, slotIds) {
  const on = slotIds.filter((id) => enabled[id]);
  return on.length > 0 ? on.join('_') : 'none';
}

function maskFromOnIds(slotIds, onIds) {
  const on = new Set(onIds);
  const enabled = {};
  for (const id of slotIds) {
    enabled[id] = on.has(id);
  }
  return enabled;
}

/**
 * Eval matrix phases:
 * 1. checkpoint — bases only (`__none`)
 * 2. video — empty catalog (LTX stacks removed)
 * 3. audio — music engines/models × template prompts
 * 4. voice-design — Qwen3 TTS voice design
 * 5. tools — one workflow per Studio tool via suite.task
 */
export const EVAL_MATRIX_PHASE = 'checkpoint';

const CHECKPOINT_ONLY_RECIPES = {};

const RECIPE_SETS = {
  'sfw-checkpoint': [[]],
  checkpoint: [[]],
  all: [[]],
};

const CURATED_LORA_RECIPES = CHECKPOINT_ONLY_RECIPES;

const LORA_IDS_BY_RECIPE_SET = {
  'image-comparison': new Set(),
  'sfw-image': new Set(),
  'sfw-checkpoint': new Set(),
  checkpoint: new Set(),
};

function defaultLoraRecipeSetForSuite(suite) {
  if (suite?.loraRecipeSet) {
    return suite.loraRecipeSet;
  }
  if (
    suite?.modality === 'video' ||
    suite?.modality === 'audio' ||
    suite?.modality === 'text' ||
    isToolEvalSuite(suite)
  ) {
    return 'all';
  }
  return 'checkpoint';
}

function comboMatchesRecipeSet(entry, recipeSet) {
  if (!recipeSet || recipeSet === 'all') {
    return true;
  }
  if (recipeSet === 'sfw-checkpoint' || recipeSet === 'checkpoint') {
    const on = Object.entries(entry.loraEnabled ?? {}).filter(([, enabled]) => enabled);
    return on.length === 0;
  }
  // Prefer exact match against curated recipes (supports realism dual stack, etc.).
  const recipes = RECIPE_SETS[recipeSet];
  if (recipes) {
    const onKey =
      Object.entries(entry.loraEnabled ?? {})
        .filter(([, enabled]) => enabled)
        .map(([id]) => id)
        .sort()
        .join('+') || 'none';
    return recipes.some((recipe) => ([...recipe].sort().join('+') || 'none') === onKey);
  }
  const allowed = LORA_IDS_BY_RECIPE_SET[recipeSet];
  if (!allowed) {
    return true;
  }
  const on = Object.entries(entry.loraEnabled ?? {})
    .filter(([, enabled]) => enabled)
    .map(([id]) => id);
  if (on.length === 0) {
    return true;
  }
  return on.length === 1 && allowed.has(on[0]);
}

function enumerateMasksFromRecipes(recipes, slotIds) {
  if (slotIds.length === 0) {
    return [{}];
  }
  if (!recipes) {
    return null;
  }
  const slotSet = new Set(slotIds);
  const masks = [];
  const seen = new Set();
  for (const recipe of recipes) {
    const onIds = recipe.filter((id) => slotSet.has(id));
    const enabled = maskFromOnIds(slotIds, onIds);
    const key = comboSuffix(enabled, slotIds);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    masks.push(enabled);
  }
  return masks.length > 0 ? masks : [{}];
}

function enumerateMasksForBase(baseId, slotIds) {
  if (slotIds.length === 0) {
    return [{}];
  }

  const fromRecipes = enumerateMasksFromRecipes(CURATED_LORA_RECIPES[baseId], slotIds);
  if (fromRecipes) {
    return fromRecipes;
  }

  // Small slot counts: full factorial. Large unknown stacks: none + singles only.
  if (slotIds.length <= 2) {
    return enumerateEnabledMasks(slotIds);
  }

  const masks = [maskFromOnIds(slotIds, [])];
  for (const id of slotIds) {
    masks.push(maskFromOnIds(slotIds, [id]));
  }
  return masks;
}

function listBaseFamilies() {
  const seen = new Set();
  const entries = [];

  for (const family of CREATE_MODEL_FAMILIES) {
    if (family.styleVariants?.length) {
      for (const variant of family.styleVariants) {
        if (!variant?.task || seen.has(variant.task)) {
          continue;
        }
        seen.add(variant.task);
        entries.push({
          // Group Create style variants under the family for four-way bake-offs.
          baseId: family.id,
          task: variant.task,
          evalId: baseEvalIdForTask(variant.task),
          label: variant.label,
          familyLabel: family.label,
          familyId: family.id,
          mature: Boolean(variant.mature || family.mature),
        });
      }
      continue;
    }

    if (!family.task || seen.has(family.task)) {
      continue;
    }
    seen.add(family.task);
    entries.push({
      baseId: family.id,
      task: family.task,
      evalId: baseEvalIdForTask(family.task),
      label: family.label,
      familyLabel: family.label,
      familyId: family.id,
      mature: Boolean(family.mature),
    });
  }

  return entries;
}

/**
 * Create eval matrix: one entry per Create style task, grouped by family.
 */
export function listEvalGenerateWorkflows() {
  const entries = [];

  for (const base of listBaseFamilies()) {
    entries.push({
      id: base.evalId,
      baseId: base.baseId,
      task: base.task,
      label: `${base.familyLabel} · ${base.label}`,
      shortLabel: base.label,
      familyId: base.familyId,
      familyLabel: base.familyLabel,
      modality: 'image',
      mature: Boolean(base.mature),
      loraSlots: [],
      loraEnabled: {},
    });
  }

  return entries;
}

/** LTX video eval stacks removed. */
export function listEvalVideoWorkflows() {
  return [];
}

/** Music engines × model variants for modality:"audio" music suites. */
export function listEvalMusicWorkflows() {
  const options = getWorkflowOptions().filter(
    (workflow) => workflow.task === 'music' && workflow.music,
  );
  const entries = [];
  for (const workflow of options) {
    const models =
      workflow.music.models?.length > 0
        ? workflow.music.models
        : [
            {
              id: workflow.music.defaultModelVersion ?? 'default',
              label: workflow.music.defaultModelVersion ?? 'Default',
            },
          ];
    const engine = workflow.music.engine ?? workflow.engine ?? 'music';
    for (const model of models) {
      const modelId = model.id ?? 'default';
      const modelLabel = model.label ?? modelId;
      entries.push({
        id: `${workflow.id}__${modelId}`,
        baseId: workflow.id,
        workflowId: workflow.id,
        task: 'music',
        label: `Redrob Tune · ${modelLabel}`,
        familyId: engine,
        modality: 'audio',
        mature: false,
        musicEngine: 'redrob-tune',
        musicModelVersion: modelId,
        loraSlots: [],
        loraEnabled: {},
      });
    }
  }
  return entries;
}

/** Voice-design TTS workflows for modality:"audio" + task:"voice-design". */
export function listEvalVoiceDesignWorkflows() {
  return getWorkflowOptions()
    .filter((workflow) => workflow.task === 'voice-design' && workflow.tts)
    .map((workflow) => ({
      id: workflow.id,
      baseId: workflow.id,
      workflowId: workflow.id,
      task: 'voice-design',
      label: workflow.name ?? 'Design',
      familyId: 'voice-design',
      modality: 'audio',
      mature: false,
      ttsMode: workflow.tts?.mode ?? 'voiceDesign',
      loraSlots: [],
      loraEnabled: {},
    }));
}

export function isVoiceDesignEvalSuite(suite) {
  if (!suite) {
    return false;
  }
  if (suite.task === 'voice-design') {
    return true;
  }
  if (String(suite.suite ?? '').includes('voice-design')) {
    return true;
  }
  const workflows = suite.workflows ?? [];
  return workflows.some(
    (id) => String(id).includes('voice-design') || String(id).includes('tts-voice-design'),
  );
}

/** Studio tool tasks covered by dedicated eval suites (voice only; Create/music are separate). */
export const EVAL_TOOL_TASKS = [
  'speak',
  'voice-clone',
];

const EVAL_TOOL_TASK_SET = new Set(EVAL_TOOL_TASKS);

function toolEvalEntryFromWorkflow(workflow) {
  if (!workflow?.id || !workflow?.task) {
    return null;
  }
  return {
    id: workflow.id,
    baseId: workflow.id,
    workflowId: workflow.id,
    task: workflow.task,
    label: workflow.name ?? workflow.task,
    familyId: workflow.task,
    modality:
      workflow.outputType === 'text'
        ? 'text'
        : (workflow.modality ?? workflow.outputType ?? 'image'),
    mature: false,
    tool: true,
    outputType: workflow.outputType ?? workflow.modality ?? 'image',
    loraSlots: [],
    loraEnabled: {},
  };
}

export function isToolEvalTask(task) {
  return EVAL_TOOL_TASK_SET.has(task);
}

export function isToolEvalSuite(suite) {
  if (!suite) {
    return false;
  }
  if (suite.tool === true || suite.kind === 'tool') {
    return true;
  }
  if (suite.task && isToolEvalTask(suite.task)) {
    return true;
  }
  const id = String(suite.suite ?? '');
  return EVAL_TOOL_TASKS.some(
    (task) =>
      id === `sfw-${task}` ||
      id === `nsfw-${task}` ||
      id.endsWith(`-${task}`),
  );
}

export function listEvalToolWorkflows(suite) {
  const options = getWorkflowOptions().filter(
    (workflow) =>
      !workflow.catalogHidden && isToolEvalTask(workflow.task),
  );

  if (suite?.task && isToolEvalTask(suite.task)) {
    return options
      .filter((workflow) => workflow.task === suite.task)
      .map(toolEvalEntryFromWorkflow)
      .filter(Boolean);
  }

  const wantedIds = new Set(
    (suite?.workflows ?? []).map((id) => String(id)).filter(Boolean),
  );
  if (wantedIds.size > 0 && !wantedIds.has('*') && !wantedIds.has('all')) {
    return options
      .filter(
        (workflow) =>
          wantedIds.has(workflow.id) || wantedIds.has(workflow.task),
      )
      .map(toolEvalEntryFromWorkflow)
      .filter(Boolean);
  }

  return options.map(toolEvalEntryFromWorkflow).filter(Boolean);
}

export function listEvalWorkflowsForSuite(suite) {
  if (isToolEvalSuite(suite)) {
    return listEvalToolWorkflows(suite);
  }
  if (suite?.modality === 'video') {
    return listEvalVideoWorkflows();
  }
  if (suite?.modality === 'audio') {
    if (isVoiceDesignEvalSuite(suite)) {
      return listEvalVoiceDesignWorkflows();
    }
    return listEvalMusicWorkflows();
  }
  return listEvalGenerateWorkflows();
}

export function getEvalGenerateTasks() {
  return listEvalGenerateWorkflows().map((entry) => entry.id);
}

export function findEvalWorkflowEntry(idOrTask) {
  if (!idOrTask) {
    return null;
  }
  const all = [
    ...listEvalGenerateWorkflows(),
    ...listEvalVideoWorkflows(),
    ...listEvalMusicWorkflows(),
    ...listEvalVoiceDesignWorkflows(),
    ...listEvalToolWorkflows({ workflows: ['*'] }),
  ];
  const direct =
    all.find((entry) => entry.id === idOrTask) ??
    all.find((entry) => entry.workflowId === idOrTask);
  if (direct) {
    return direct;
  }

  const baseRaw =
    typeof idOrTask === 'string' && idOrTask.includes('__')
      ? idOrTask.split('__')[0]
      : idOrTask;
  const base = normalizeEvalBaseId(baseRaw);

  return (
    all.find((entry) => entry.baseId === base && entry.id === entry.baseId) ??
    all.find((entry) => entry.task === base && entry.id === entry.baseId) ??
    all.find((entry) => entry.baseId === base) ??
    all.find((entry) => entry.task === base) ??
    null
  );
}

export function resolveEvalWorkflowTask(idOrTask) {
  if (!idOrTask) {
    return idOrTask;
  }
  const entry = findEvalWorkflowEntry(idOrTask);
  if (entry) {
    return entry.task;
  }
  if (TASK_BY_EVAL_ID[idOrTask]) {
    return TASK_BY_EVAL_ID[idOrTask];
  }
  if (typeof idOrTask === 'string' && idOrTask.includes('__')) {
    const baseId = idOrTask.split('__')[0];
    return TASK_BY_EVAL_ID[baseId] ?? baseId;
  }
  return idOrTask;
}

export function isMatureEvalWorkflow(idOrTask) {
  const entry = findEvalWorkflowEntry(idOrTask);
  if (entry) {
    return Boolean(entry.mature);
  }
  const task = resolveEvalWorkflowTask(idOrTask);
  return Boolean(listBaseFamilies().find((item) => item.task === task)?.mature);
}

export function isVideoEvalWorkflow(idOrTask) {
  const entry = findEvalWorkflowEntry(idOrTask);
  return (
    entry?.modality === 'video' ||
    entry?.outputType === 'video' ||
    Boolean(entry?.workflowId?.startsWith('ltx-'))
  );
}

export function isAudioEvalWorkflow(idOrTask) {
  const entry = findEvalWorkflowEntry(idOrTask);
  if (
    entry?.outputType === 'text' ||
    entry?.task === 'transcribe' ||
    entry?.task === 'vision' ||
    entry?.task === 'image-to-text'
  ) {
    return false;
  }
  return (
    entry?.modality === 'audio' ||
    entry?.outputType === 'audio' ||
    entry?.task === 'music' ||
    entry?.task === 'voice-design' ||
    entry?.task === 'speak' ||
    entry?.task === 'voice-clone' ||
    entry?.task === 'convert-audio' ||
    entry?.task === 'extract-audio'
  );
}

export function isVoiceDesignEvalWorkflow(idOrTask) {
  const entry = findEvalWorkflowEntry(idOrTask);
  return entry?.task === 'voice-design' || entry?.ttsMode === 'voiceDesign';
}

export function isTextEvalWorkflow(idOrTask) {
  const entry = findEvalWorkflowEntry(idOrTask);
  return (
    entry?.modality === 'text' ||
    entry?.outputType === 'text' ||
    entry?.task === 'transcribe' ||
    entry?.task === 'vision' ||
    entry?.task === 'image-to-text'
  );
}

/** Legacy suite workflow ids → current stacks (none remaining). */
const VIDEO_WORKFLOW_ALIASES = {};

/** Default selection: suite workflow list if set, else suite modality pool. */
export function resolveSuiteWorkflows(suite) {
  const all = listEvalWorkflowsForSuite(suite);
  const recipeSet = defaultLoraRecipeSetForSuite(suite);
  const pool = all.filter((entry) => comboMatchesRecipeSet(entry, recipeSet));
  const poolIds = pool.map((entry) => entry.id);

  if (
    !suite?.workflows?.length ||
    suite.workflows.includes('*') ||
    suite.workflows.includes('all')
  ) {
    return poolIds;
  }

  const selected = [];
  const seen = new Set();

  for (const raw of suite.workflows) {
    const value = normalizeEvalBaseId(String(raw));
    const alias = VIDEO_WORKFLOW_ALIASES[value] ?? value;
    const exact = pool.filter(
      (entry) =>
        entry.id === value ||
        entry.id === alias ||
        entry.workflowId === value ||
        entry.workflowId === alias ||
        entry.baseId === value ||
        entry.baseId === alias,
    );
    const byBase = pool.filter(
      (entry) =>
        entry.baseId === value ||
        entry.baseId === alias ||
        entry.task === value ||
        entry.baseId === baseEvalIdForTask(value),
    );
    const matches = exact.length > 0 ? exact : byBase;
    for (const entry of matches) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        selected.push(entry.id);
      }
    }
  }

  return selected.length > 0 ? selected : poolIds;
}

/** Prompt may list combo ids as soft hints — eval UI ignores this and runs every
 * selected workflow on every prompt. Kept for tooling that still reads it.
 */
export function promptAllowsEvalWorkflow(_prompt, _workflowId) {
  return true;
}
