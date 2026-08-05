const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|flac|ogg|opus|m4a)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv)$/i;

function pathBasename(value) {
  const parts = String(value ?? '').split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || 'fixture';
}

function mimeForPath(relativePath, blobType) {
  const lower = String(relativePath ?? '').toLowerCase();
  if (IMAGE_EXT_RE.test(lower)) {
    if (lower.endsWith('.webp')) return 'image/webp';
    if (/\.jpe?g$/i.test(lower)) return 'image/jpeg';
    return 'image/png';
  }
  if (AUDIO_EXT_RE.test(lower)) {
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.flac')) return 'audio/flac';
    if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
    return 'audio/mpeg';
  }
  if (VIDEO_EXT_RE.test(lower)) {
    if (lower.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }
  return blobType || 'application/octet-stream';
}

async function fetchFixtureBlob(relativePath) {
  const cleaned = String(relativePath ?? '')
    .replace(/^[/\\]+/, '')
    .replace(/^fixtures[/\\]/i, '');
  const segments = cleaned.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Fixture path is empty');
  }
  const url = `/api/eval/fixtures/${segments.map(encodeURIComponent).join('/')}`;
  const response = await fetch(url);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to load fixture (${response.status})`);
  }
  return response.blob();
}

async function loadFixtureFile(relativePath, cache) {
  const key = String(relativePath);
  if (cache?.has(key)) {
    return cache.get(key);
  }
  const blob = await fetchFixtureBlob(relativePath);
  const name = pathBasename(relativePath);
  const type = mimeForPath(relativePath, blob.type);
  const file = new File([blob], name.includes('.') ? name : `${name}.bin`, { type });
  cache?.set(key, file);
  return file;
}

/**
 * Collect relative fixture paths from a suite prompt.
 * Supports:
 * - fixture / image / startImage / imageFixture (single image)
 * - donorFixture / faceFixture / sourceFixture (second face / optional peer)
 * - audioFixture / audio / refAudio
 * - videoFixture / video
 * - fixtures: { images?: string[], audio?: string, video?: string }
 * - imageFixtures: { [nodeId]: path } | string[]
 * - audioFixtures: { [nodeId]: path }
 * - videoFixtures: { [nodeId]: path }
 */
export function collectPromptFixtureSpecs(prompt, workflow) {
  const specs = {
    imageByNode: {},
    audioByNode: {},
    videoByNode: {},
    imagePaths: [],
    audioPaths: [],
    videoPaths: [],
  };

  const pushImage = (path, node) => {
    if (!path) return;
    if (node) specs.imageByNode[node] = path;
    else specs.imagePaths.push(path);
  };
  const pushAudio = (path, node) => {
    if (!path) return;
    if (node) specs.audioByNode[node] = path;
    else specs.audioPaths.push(path);
  };
  const pushVideo = (path, node) => {
    if (!path) return;
    if (node) specs.videoByNode[node] = path;
    else specs.videoPaths.push(path);
  };

  if (prompt?.imageFixtures && typeof prompt.imageFixtures === 'object') {
    if (Array.isArray(prompt.imageFixtures)) {
      for (const path of prompt.imageFixtures) pushImage(path);
    } else {
      for (const [node, path] of Object.entries(prompt.imageFixtures)) {
        pushImage(path, node);
      }
    }
  }
  if (prompt?.audioFixtures && typeof prompt.audioFixtures === 'object') {
    for (const [node, path] of Object.entries(prompt.audioFixtures)) {
      pushAudio(path, node);
    }
  }
  if (prompt?.videoFixtures && typeof prompt.videoFixtures === 'object') {
    for (const [node, path] of Object.entries(prompt.videoFixtures)) {
      pushVideo(path, node);
    }
  }

  if (prompt?.fixtures && typeof prompt.fixtures === 'object') {
    const bag = prompt.fixtures;
    if (Array.isArray(bag.images)) {
      for (const path of bag.images) pushImage(path);
    }
    if (bag.image) pushImage(bag.image);
    if (bag.donor) pushImage(bag.donor);
    if (bag.audio) pushAudio(bag.audio);
    if (bag.video) pushVideo(bag.video);
  }

  const singleImage =
    prompt?.fixture ??
    prompt?.image ??
    prompt?.startImage ??
    prompt?.imageFixture ??
    null;
  pushImage(singleImage);
  pushImage(prompt?.donorFixture ?? prompt?.faceFixture ?? prompt?.sourceFixture ?? null);
  pushAudio(prompt?.audioFixture ?? prompt?.audio ?? prompt?.refAudio ?? null);
  pushVideo(prompt?.videoFixture ?? prompt?.video ?? null);

  // Prefer declared input nodes when we only have ordered paths.
  const imageInputs = workflow?.imageInputs ?? [];
  const audioInputs = workflow?.audioInputs ?? [];
  const videoInputs = workflow?.videoInputs ?? [];

  if (Object.keys(specs.imageByNode).length === 0 && specs.imagePaths.length > 0) {
    const required = imageInputs.filter((input) => input.required !== false);
    const nodes =
      required.length > 0
        ? required.map((input) => input.node)
        : imageInputs.map((input) => input.node);
    if (nodes.length === 0 && workflow?.imageNode) {
      nodes.push(workflow.imageNode);
    }
    specs.imagePaths.forEach((path, index) => {
      const node = nodes[index];
      if (node) specs.imageByNode[node] = path;
    });
  }

  if (Object.keys(specs.audioByNode).length === 0 && specs.audioPaths.length > 0) {
    const required = audioInputs.filter((input) => input.required !== false);
    const nodes =
      required.length > 0
        ? required.map((input) => input.node)
        : audioInputs.map((input) => input.node);
    const fallback =
      workflow?.audioNode ??
      workflow?.asr?.loadAudioNode ??
      workflow?.tts?.loadAudioNode;
    if (nodes.length === 0 && fallback) {
      nodes.push(fallback);
    }
    specs.audioPaths.forEach((path, index) => {
      const node = nodes[index];
      if (node) specs.audioByNode[node] = path;
    });
  }

  if (Object.keys(specs.videoByNode).length === 0 && specs.videoPaths.length > 0) {
    const required = videoInputs.filter((input) => input.required !== false);
    const nodes =
      required.length > 0
        ? required.map((input) => input.node)
        : videoInputs.map((input) => input.node);
    specs.videoPaths.forEach((path, index) => {
      const node = nodes[index];
      if (node) specs.videoByNode[node] = path;
    });
  }

  return specs;
}

/**
 * Load Files for an eval prompt given the resolved Comfy workflow.
 * @returns {{ imageFiles?: Record<string, File>, audioFiles?: Record<string, File>, videoFiles?: Record<string, File> }}
 */
export async function resolveEvalRunInputs(prompt, workflow, { cache, onProgress } = {}) {
  const specs = collectPromptFixtureSpecs(prompt, workflow);
  const imageFiles = {};
  const audioFiles = {};
  const videoFiles = {};

  for (const [node, relativePath] of Object.entries(specs.imageByNode)) {
    onProgress?.(`Fixture · image · ${pathBasename(relativePath)}`);
    imageFiles[node] = await loadFixtureFile(relativePath, cache);
  }
  for (const [node, relativePath] of Object.entries(specs.audioByNode)) {
    onProgress?.(`Fixture · audio · ${pathBasename(relativePath)}`);
    audioFiles[node] = await loadFixtureFile(relativePath, cache);
  }
  for (const [node, relativePath] of Object.entries(specs.videoByNode)) {
    onProgress?.(`Fixture · video · ${pathBasename(relativePath)}`);
    videoFiles[node] = await loadFixtureFile(relativePath, cache);
  }

  const result = {};
  if (Object.keys(imageFiles).length > 0) result.imageFiles = imageFiles;
  if (Object.keys(audioFiles).length > 0) result.audioFiles = audioFiles;
  if (Object.keys(videoFiles).length > 0) result.videoFiles = videoFiles;
  return result;
}

export function promptNeedsEvalFixtures(prompt, workflow) {
  const specs = collectPromptFixtureSpecs(prompt, workflow);
  return (
    Object.keys(specs.imageByNode).length > 0 ||
    Object.keys(specs.audioByNode).length > 0 ||
    Object.keys(specs.videoByNode).length > 0 ||
    Boolean(workflow?.requiresImage) ||
    Boolean(workflow?.requiresAudio) ||
    Boolean(workflow?.requiresVideo) ||
    Boolean(workflow?.imageInputs?.some((input) => input.required)) ||
    Boolean(workflow?.audioInputs?.some((input) => input.required)) ||
    Boolean(workflow?.videoInputs?.some((input) => input.required))
  );
}
