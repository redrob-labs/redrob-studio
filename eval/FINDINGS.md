# Eval findings

This tree ships an **open-source-safe** Studio subset only. Historical bake-offs for
Krea-2 / LTX-2 / Civitai community weights and image Edit (Rapid AIO) are retired
from product routing.

## Current product routing

| Lane | Use | Do not |
| ---- | --- | ------ |
| Image create | **[Redrob Image](https://huggingface.co/savagemanage/redrob-image)** (`redrob-image.safetensors`) | Peer Create checkpoints; non-permissive stacks; image Edit |
| Upscale | Lanczos `ImageScale` only | UltraSharp, CodeFormer |
| Audio | Qwen3 TTS / ASR, ACE-Step (Redrob Tune, MIT) | - |
| Vision | Qwen2.5-VL | - |
| Video | Compress / extract-audio plumbing | LTX / lipsync / ReActor / RMBG / CodeFormer |

Eval suites: image Create (`image-comparison` on Redrob Image), music (`sfw-audio`), and voice (speak / clone / design).

Weight inventory: [`THIRD_PARTY_WEIGHTS.md`](./THIRD_PARTY_WEIGHTS.md).

Local Ubuntu bootstrap (no deploy): `scripts/setup-comfyui-local.sh` (pulls UNET from `savagemanage/redrob-image`).

## Bake-off → Redrob Image (2026-08)

Compared Z-Image Turbo peers (ZepiC / RebelReal / Photorealistic Snapshot), Qwen-Image-2512, Boogu Base/Turbo.

| Axis | Ranking / notes |
| ---- | --------------- |
| Vibe / less “AI look” | Z-Image lineage wins; Photorealistic Snapshot chosen for skin/light/texture |
| Typography | All weak — known gap; Hangul/text prompts deprioritized in eval |
| Community | Z-Image ≫ Boogu |

**Decision:** Create = **Redrob Image** — merged UNET published at
[savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image) (Apache-2.0).
Comfy peers: `qwen_3_4b_fp8_mixed.safetensors` + `ae.safetensors` from Comfy-Org.

## Ops invariant (Qwen TTS / VL)

```text
transformers == 4.57.3
kernels < 0.13.0
huggingface_hub >= 0.34,<1.0
numpy >= 1.26.4,<2.2
```

Re-pin in the ComfyUI venv after custom-node installs. Keep pins on the GPU host.

## Eval methodology

1. Suites are image Create (`image-comparison`), music (`sfw-audio`), and voice (speak / clone / design).
2. Workflow-first job order reduces Comfy unload thrash.
3. Fixtures live under `eval/fixtures/` (empty by default in this tree).
