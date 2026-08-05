---
license: apache-2.0
base_model: Tongyi-MAI/Z-Image-Turbo
tags:
  - text-to-image
  - redrob
  - redrob-image
  - comfyui
---

# Redrob Image (Studio)

Create stack for redrob-studio.

**Weights:** [savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image)

| File | Role |
| --- | --- |
| `redrob-image.safetensors` | ComfyUI merged UNET |
| `qwen_3_4b_fp8_mixed.safetensors` | Text encoder (Comfy-Org/z_image_turbo) |
| `ae.safetensors` | VAE |

Studio task: `redrob-image` → `src/workflows/redrob-image-generate.json`.

Bootstrap: `scripts/setup-comfyui-local.sh --profile create`.
