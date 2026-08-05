import { promises as fs } from 'fs';
import path from 'path';

export const EVAL_ROOT = path.join(process.cwd(), 'eval');
export const SUITES_DIR = path.join(EVAL_ROOT, 'suites');
export const RUNS_DIR = path.join(EVAL_ROOT, 'runs');
export const FIXTURES_DIR = path.join(EVAL_ROOT, 'fixtures');

/** Eval content paths — suites live under suites/sfw. */
export const EVAL_PATHS = ['sfw'];

const RUN_ID_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}_[a-z0-9-]+$/i;
const SAFE_SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const FIXTURE_EXT_RE = /\.(png|jpe?g|webp|mp3|wav|flac|ogg|opus|m4a|mp4|webm|mov|mkv)$/i;

export function assertSafeRunId(runId) {
  if (!runId || !RUN_ID_RE.test(runId)) {
    throw new Error('Invalid run id');
  }
  return runId;
}

export function assertSafeSegment(value, label = 'path segment') {
  if (!value || !SAFE_SEGMENT_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function runDir(runId) {
  return path.join(RUNS_DIR, assertSafeRunId(runId));
}

export async function ensureRunsDir() {
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

/**
 * Infer eval path from folder name, suite.rating, or suite id prefix.
 * @returns {'sfw'}
 */
export function resolveEvalPath(suite, folderPath = null) {
  if (folderPath === 'sfw') {
    return folderPath;
  }
  if (suite?.path === 'sfw') {
    return suite.path;
  }
  return 'sfw';
}

/**
 * List suite files as { relativePath, path, file } under suites/sfw/.
 * Also accepts legacy flat suites/*.json (path inferred from filename).
 */
export async function listSuiteFiles() {
  const results = [];

  for (const evalPath of EVAL_PATHS) {
    const dir = path.join(SUITES_DIR, evalPath);
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      results.push({
        relativePath: path.join(evalPath, entry.name),
        path: evalPath,
        file: entry.name,
      });
    }
  }

  // Legacy flat files (migration leftover).
  const top = await fs.readdir(SUITES_DIR, { withFileTypes: true });
  for (const entry of top) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    results.push({
      relativePath: entry.name,
      path: 'sfw',
      file: entry.name,
    });
  }

  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/** Legacy suite ids → current file suite id. */
const LEGACY_SUITE_IDS = {
  'sfw-image': 'image-comparison',
  'sfw-photoreal': 'image-comparison',
  'sfw-anime': 'image-comparison',
  'sfw-style-lora': 'image-comparison',
};

export async function loadSuite(suiteId) {
  const resolvedId = LEGACY_SUITE_IDS[suiteId] ?? suiteId;
  const files = await listSuiteFiles();
  for (const entry of files) {
    const raw = await fs.readFile(path.join(SUITES_DIR, entry.relativePath), 'utf8');
    const suite = JSON.parse(raw);
    if (suite.suite === resolvedId || entry.file === `${resolvedId}.json`) {
      return {
        ...suite,
        path: resolveEvalPath(suite, entry.path),
      };
    }
  }
  return null;
}

export async function loadAllSuites() {
  const files = await listSuiteFiles();
  const suites = [];
  for (const entry of files) {
    const raw = await fs.readFile(path.join(SUITES_DIR, entry.relativePath), 'utf8');
    const suite = JSON.parse(raw);
    suites.push({
      ...suite,
      path: resolveEvalPath(suite, entry.path),
    });
  }
  return suites.sort((a, b) => {
    const pathCmp = String(a.path).localeCompare(String(b.path));
    if (pathCmp !== 0) {
      return pathCmp;
    }
    return String(a.suite).localeCompare(String(b.suite));
  });
}

export function makeRunId(suiteId) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safeSuite = String(suiteId || 'suite')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${date}_${time}_${safeSuite || 'suite'}`;
}

export async function readRunMeta(runId) {
  const metaPath = path.join(runDir(runId), 'meta.json');
  const raw = await fs.readFile(metaPath, 'utf8');
  return JSON.parse(raw);
}

export async function writeRunMeta(runId, meta) {
  const dir = runDir(runId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

export async function readRatings(runId) {
  const ratingsPath = path.join(runDir(runId), 'ratings.jsonl');
  try {
    const raw = await fs.readFile(ratingsPath, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function writeRatings(runId, ratings) {
  const dir = runDir(runId);
  await fs.mkdir(dir, { recursive: true });
  const body = ratings.map((row) => JSON.stringify(row)).join('\n');
  await fs.writeFile(path.join(dir, 'ratings.jsonl'), body ? `${body}\n` : '', 'utf8');
}

export async function saveRunImage({ runId, workflow, promptId, seed, bytes, ext = 'png' }) {
  const safeWorkflow = assertSafeSegment(workflow, 'workflow');
  const safePromptId = assertSafeSegment(promptId, 'prompt id');
  const safeSeed = assertSafeSegment(String(seed), 'seed');
  const safeExt = assertSafeSegment(ext.replace(/^\./, ''), 'extension');
  const dir = path.join(runDir(runId), safeWorkflow);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${safePromptId}_seed${safeSeed}.${safeExt}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, bytes);
  return {
    relativePath: path.join(safeWorkflow, filename).replace(/\\/g, '/'),
    filename,
  };
}

/** Resolve a suite fixture path under eval/fixtures (no `..`). */
export function fixturePath(relative) {
  const cleaned = String(relative ?? '')
    .replace(/^[/\\]+/, '')
    .replace(/^fixtures[/\\]/i, '');
  const segments = cleaned.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0 || segments.some((part) => part === '..' || !SAFE_SEGMENT_RE.test(part))) {
    throw new Error('Invalid fixture path');
  }
  if (!FIXTURE_EXT_RE.test(segments[segments.length - 1])) {
    throw new Error('Fixture must be an image, audio, or video file');
  }
  return path.join(FIXTURES_DIR, ...segments);
}

export async function listRuns() {
  await ensureRunsDir();
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID_RE.test(entry.name)) {
      continue;
    }
    try {
      const meta = await readRunMeta(entry.name);
      runs.push({ runId: entry.name, ...meta });
    } catch {
      runs.push({ runId: entry.name });
    }
  }
  return runs.sort((a, b) => String(b.runId).localeCompare(String(a.runId)));
}

const MEDIA_NAME_RE = /^(.+)_seed([^.]+)\.(png|jpe?g|webp|mp4|webm|mp3|wav|flac|ogg|txt)$/i;

/**
 * List persisted media for a run as { workflow, promptId, seed, relativePath, filename, kind }.
 */
export async function listRunImages(runId) {
  const dir = runDir(runId);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const images = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !SAFE_SEGMENT_RE.test(entry.name)) {
      continue;
    }
    const workflowDir = path.join(dir, entry.name);
    const files = await fs.readdir(workflowDir);
    for (const filename of files) {
      const match = filename.match(MEDIA_NAME_RE);
      if (!match) {
        continue;
      }
      const ext = match[3].toLowerCase();
      images.push({
        workflow: entry.name,
        promptId: match[1],
        seed: match[2],
        filename,
        relativePath: `${entry.name}/${filename}`,
        kind:
          ext === 'mp4' || ext === 'webm'
            ? 'video'
            : ext === 'mp3' || ext === 'wav' || ext === 'flac' || ext === 'ogg'
              ? 'audio'
              : ext === 'txt'
                ? 'text'
                : 'image',
      });
    }
  }
  return images.sort((a, b) => {
    const promptCmp = String(a.promptId).localeCompare(String(b.promptId));
    if (promptCmp !== 0) {
      return promptCmp;
    }
    return String(a.workflow).localeCompare(String(b.workflow));
  });
}
