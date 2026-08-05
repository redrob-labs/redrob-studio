/**
 * Verifies every locale key the tool detail pages look up resolves in Korean,
 * using the same id lists the UI iterates at runtime.
 *
 * Usage: node scripts/check-i18n-keys.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function importEsmJs(relativePath) {
  const source = await readFile(join(root, relativePath), 'utf8');
  const dir = await mkdtemp(join(tmpdir(), 'redrob-i18n-'));
  const target = join(dir, 'module.mjs');
  await writeFile(target, source, 'utf8');
  return import(pathToFileURL(target).href);
}

const { MESSAGES } = await importEsmJs('src/lib/i18n/messages.js');
const tune = await importEsmJs('src/lib/redrob-tune.js');
const audio = await importEsmJs('src/lib/audio-prompt.js');
const manifest = JSON.parse(await readFile(join(root, 'src/workflows/manifest.json'), 'utf8'));

function lookup(tree, key) {
  let node = tree;
  for (const segment of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

const toKeySegment = value => String(value ?? '').replace(/\./g, '_');
const keys = new Set();
const add = key => keys.add(key);

const TASKS = [
  'create',
  'upscale',
  'compress-image',
  'convert-image',
  'speak',
  'voice-clone',
  'voice-design',
  'transcribe',
  'music',
  'extract-audio',
  'convert-audio',
  'vision',
];

for (const task of TASKS) {
  add(`workspace.running.${task}`);
  add(`task.${task}.label`);
  add(`task.${task}.description`);
}

for (const task of ['speak', 'voice-clone', 'voice-design', 'music', 'vision']) {
  add(`workspace.promptLabel.${task}`);
  add(`workspace.promptPlaceholder.${task}`);
}
for (const key of ['default', 'speech', 'photo', 'create']) {
  add(`workspace.promptPlaceholder.${key}`);
}
add('workspace.promptHint.music');

for (const workflow of manifest.workflows) {
  const task = workflow.task === 'redrob-image' ? 'create' : workflow.task;

  if (workflow.ui?.uploadLabel) add(`upload.image.${task}`);
  if (workflow.ui?.audioUploadLabel) add(`upload.audio.${task}`);
  if (workflow.ui?.videoUploadLabel) add(`upload.video.${task}`);

  for (const speaker of workflow.tts?.speakers ?? []) add(`tts.speaker.${speaker.id}`);
  for (const language of workflow.tts?.languages ?? []) add(`tts.language.${language.id}`);
  for (const language of workflow.asr?.languages ?? []) add(`asr.language.${language.value}`);
  for (const size of workflow.asr?.modelSizes ?? []) add(`asr.model.${toKeySegment(size.id)}`);
  for (const mode of workflow.vlm?.modes ?? []) add(`vision.mode.${mode.id}`);
  for (const model of workflow.music?.models ?? []) {
    add(`music.model.${model.id}.label`);
    add(`music.model.${model.id}.description`);
  }
  for (const format of workflow.audioConvert?.formats ?? []) add(`format.audio.${format}`);
  for (const format of workflow.imageConvert?.formats ?? []) add(`format.image.${format}`);
  for (const format of workflow.imageCompress?.formats ?? []) add(`format.image.${format}`);
}

for (const template of tune.REDROB_TUNE_TEMPLATES) add(`music.template.${template.id}`);
for (const section of tune.REDROB_TUNE_SECTIONS) add(`music.section.${section.id}`);
for (const language of tune.REDROB_TUNE_LANGUAGES) add(`music.language.${language}`);

for (const preset of audio.SPEAK_TONE_PRESETS) add(`preset.speakTone.${preset.id}`);
for (const preset of audio.SPEAK_SPEED_PRESETS) {
  add(`preset.speakSpeed.${preset.id}.label`);
  add(`preset.speakSpeed.${preset.id}.hint`);
}
for (const example of audio.SPEAK_PROMPT_EXAMPLES) add(`preset.speakExample.${example.id}`);
for (const example of audio.VOICE_DESIGN_EXAMPLES) add(`preset.voiceDesignExample.${example.id}`);
for (const preset of audio.VOICE_DESIGN_PRESETS) add(`preset.voiceDesign.${preset.id}`);

for (const task of ['speak', 'voice-clone', 'voice-design']) {
  add(`error.audioMissingNode.${task}`);
}

const missing = [...keys].filter(key => !lookup(MESSAGES.ko, key) || !lookup(MESSAGES.en, key));

if (missing.length > 0) {
  console.error(`Missing locale keys (${missing.length}):`);
  for (const key of missing) console.error(`  ${key}`);
  process.exit(1);
}

console.log(`All ${keys.size} tool-page locale keys resolve in en and ko.`);
