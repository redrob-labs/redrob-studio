/**
 * `useToolRunner` stores validation failures as message keys and runtime
 * failures as the English sentence `formatUserFacingError` produced. Both go
 * through `translateError` at the display site.
 *
 * The literals below mirror the canned messages in `src/lib/comfyui.js`; keep
 * them in sync when that copy changes. Anything unmatched (node-specific
 * details, raw backend text) falls through untranslated.
 */
const RAW_MESSAGE_KEYS = {
  'Something went wrong. Please try again.': 'error.generic',
  'Generation failed. Please try again.': 'error.generationFailed',
  'Generation failed.': 'error.generationFailedShort',
  'Preparation failed.': 'error.preparationFailed',
  'Could not use output as input.': 'error.useOutputAsInput',
  'GPU memory ran out. Wait a moment and try again.': 'error.gpuOom',
  'GPU memory ran out while generating speech. Wait a few seconds and try again — especially if you used image or video tools earlier. A shorter script can also help.':
    'error.gpuOomSpeech',
  'Speech failed to load locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.speechLoadFailed',
  'Speech needs a dependency fix locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.speechDependency',
  'A required model weight is missing locally. Run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.weightsMissing',
  'Speech is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.audioMissingNode.speak',
  'Voice cloning is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.audioMissingNode.voice-clone',
  'Voice design is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.audioMissingNode.voice-design',
  'Speech-to-text is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.transcribeMissing',
  'Redrob Tune is not set up locally yet. Run scripts/setup-comfyui-local.sh (music profile) and restart ComfyUI.':
    'error.tuneMissing',
  'Vision is not set up locally yet. Run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.visionMissing',
  'This image tool is not part of the local Studio install. Re-run scripts/setup-comfyui-local.sh if a required node is missing.':
    'error.layeredMissing',
  'This image tool is not fully set up locally. Re-run scripts/setup-comfyui-local.sh and restart ComfyUI.':
    'error.multichannelMissing',
};

export function translateError(t, message) {
  if (!message) {
    return null;
  }
  const key = RAW_MESSAGE_KEYS[message] ?? message;
  return t(key, null, message);
}
