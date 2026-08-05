# Third-party weights (Apache-2.0 / OSI-permissive)

This release ships **only** Studio workflows whose required model weights are
Apache-2.0, MIT, or BSD (or use no learned upscaler weights).

| Weight / pack | Used by | License | Hugging Face / source |
| --- | --- | --- | --- |
| `redrob-image.safetensors` (+ `qwen_3_4b_fp8_mixed.safetensors`, shared `ae.safetensors`) | **Create:** `redrob-image` | Apache-2.0 | [savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image); CLIP/VAE from [Comfy-Org/z_image_turbo](https://huggingface.co/Comfy-Org/z_image_turbo) / [Comfy-Org/HiDream-I1_ComfyUI](https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI) (`ae.safetensors`) |
| Qwen3-TTS (0.6B / 1.7B via Comfy custom nodes) | `speak`, `voice-clone`, `voice-design` | Apache-2.0 | [Qwen/Qwen3-TTS](https://huggingface.co/Qwen/Qwen3-TTS) |
| `Qwen/Qwen3-ASR-0.6B`, `Qwen/Qwen3-ASR-1.7B` | `transcribe` | Apache-2.0 | [Qwen/Qwen3-ASR](https://huggingface.co/Qwen/Qwen3-ASR) |
| `Qwen2.5-VL-7B-Instruct` | `vision` | Apache-2.0 | [Qwen/Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct) |
| ACE-Step 1.5 | `music` (`redrob-tune-music`) | MIT | [ACE-Step/ACE-Step-1.5](https://huggingface.co/ACE-Step/ACE-Step-1.5) (or Comfy-Org ACE packs) |

## No learned weights required

| Tool | Notes |
| --- | --- |
| `upscale` | Lanczos `ImageScale` only |
| `compress-image`, `convert-image` | Format / resize plumbing |
| `convert-audio`, `extract-audio` | FFmpeg-style Comfy nodes |

Filenames in workflow JSON must match what is installed under `$COMFY_HOME/models`.

Local install: `scripts/setup-comfyui-local.sh` (Ubuntu GPU host; no deploy/secrets).

## Removed from Create

Qwen-Image-2512, Boogu Base/Turbo, runtime RebelReal / Snapshot LoRA peers — Create is a single
[savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image) UNET. See [`FINDINGS.md`](./FINDINGS.md).
