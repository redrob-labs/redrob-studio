# Redrob Studio

English | [한국어](./README.ko.md)

A Next.js studio for image, audio, and video tools, backed by ComfyUI running on your own local GPU. Nothing is sent to a hosted inference API: the web app talks to a ComfyUI process you control.

Built by Janghoon Lee (이장훈) for Redrob. Licensed under the Apache License 2.0.

## Requirements

| Layer | Minimum |
| ----- | ------- |
| Node.js | 20+ (see `package.json` `engines`) |
| Package manager | yarn |
| OS (app) | Any OS that can run Next.js |
| OS (GPU host) | Ubuntu recommended; NVIDIA GPU + recent CUDA drivers |
| Disk (GPU host) | Tens of GB free for ComfyUI custom nodes and model weights |
| VRAM - Create only | ~12 GB NVIDIA VRAM recommended (`redrob-image` UNET + CLIP + VAE) |
| VRAM - full stack | ~24 GB+ recommended (Create + Qwen TTS/ASR/VL + ACE-Step music) |

The Next.js app itself is lightweight. Generation runs on ComfyUI; without a GPU host you can still open the UI, but tools will not produce output.

## Features

| Modality | Tools |
| -------- | ----- |
| Image | Create ([Redrob Image](https://huggingface.co/savagemanage/redrob-image)), Upscale (Lanczos), Compress, Convert, Vision |
| Audio | Speak, Clone, Design, Music (Redrob Tune / ACE-Step), Transcribe, Extract audio, Convert |
| Video | Compress |

Tools are registered in `src/workflows/manifest.json` and backed by ComfyUI API workflow templates in `src/workflows/`, resolved server-side by id.

The UI ships in English and Korean. Switch with the EN / 한국어 toggle in the header; the choice is stored in `localStorage`. Messages live in `src/lib/i18n/messages.js`. Home (`/`) is the tools catalog; each tool opens its own workspace (for example `/image/create`).

Only OSS-safe weights are included: every shipped workflow depends on Apache-2.0, MIT, or BSD licensed models, or on no learned weights at all. The full inventory is in [`eval/THIRD_PARTY_WEIGHTS.md`](eval/THIRD_PARTY_WEIGHTS.md).

## Architecture

```
Browser  --HTTP/SSE-->  Next.js (/api/comfy, /api/generate)
                             |
                             |  COMFYUI_URL (server-only)
                             v
                        ComfyUI backend
```

The browser never talks to ComfyUI directly. `COMFYUI_URL` is server-only and is never exposed as a `NEXT_PUBLIC_*` variable. Progress is relayed to the client as SSE from a server-side ComfyUI WebSocket subscription, and workflow graphs are assembled on the server from allowlisted templates (`workflowId` plus params only). See [`SECURITY.md`](SECURITY.md) for the deployment invariants.

## Quick start

```bash
yarn install
cp .env.example .env.local   # set COMFYUI_URL
yarn dev
```

```bash
# .env.local
COMFYUI_URL=http://127.0.0.1:8188
```

`COMFYUI_URL` defaults to `http://127.0.0.1:8188` when unset. Restart the dev server after changing `.env.local`.

## GPU host setup

On an Ubuntu machine with an NVIDIA GPU, the bootstrap script installs ComfyUI, the required custom nodes, and the permissive weights. It does no cloud deploy and handles no secrets.

```bash
export COMFY_HOME=~/ComfyUI
# optional: export HF_TOKEN=hf_...   # only if a Hugging Face repo needs auth
bash scripts/setup-comfyui-local.sh                    # full stack
# bash scripts/setup-comfyui-local.sh --profile create # Create models only
```

| Item | Path |
| ---- | ---- |
| ComfyUI | `$COMFY_HOME` (default `~/ComfyUI`) |
| venv | `$COMFY_HOME/venv` |
| Models | `$COMFY_HOME/models` (override with `COMFY_MODELS`) |

Start ComfyUI on loopback, then point Next.js at it:

```bash
cd "$COMFY_HOME"
./venv/bin/python main.py --listen 127.0.0.1 --port 8188
```

Keep ComfyUI on the host network only. You can open `http://127.0.0.1:8188` on the GPU host to inspect graphs manually by dragging workflow JSON from `src/workflows/` onto the canvas.

## Create model

Image Create runs a single UNET, [savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image) (`task`: `redrob-image`).

| File under `$COMFY_HOME/models` | Role | Source |
| ------------------------------- | ---- | ------ |
| `diffusion_models/redrob-image.safetensors` | Merged UNET | [savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image) |
| `text_encoders/qwen_3_4b_fp8_mixed.safetensors` | CLIP | [Comfy-Org/z_image_turbo](https://huggingface.co/Comfy-Org/z_image_turbo) |
| `vae/ae.safetensors` | VAE | [Comfy-Org/HiDream-I1_ComfyUI](https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI) |

Sampler defaults: 8 steps, CFG 1, `res_multistep` / `sgm_uniform`.

## Troubleshooting

**`COMFYUI_URL is not set`, or the proxy returns 502**

Set `COMFYUI_URL` in `.env.local` and restart the dev server. The app reaches ComfyUI only through `/api/comfy` and `/api/generate`.

**Cannot connect to port 8188**

Confirm ComfyUI is listening on the URL in `COMFYUI_URL`:

```bash
ss -tlnp | grep 8188
curl -sS "$COMFYUI_URL/system_stats" | head
```

**Missing node or model**

Install the custom node pack on the GPU host and restart ComfyUI, or re-run `scripts/setup-comfyui-local.sh`. Model filenames and folders must match the workflow JSON exactly.

**Inspecting ComfyUI errors**

```bash
cd "$COMFY_HOME" && source venv/bin/activate
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
python main.py --listen 127.0.0.1 --port 8188
```

## Repository layout

| Path | Purpose |
| ---- | ------- |
| `src/workflows/manifest.json` | Studio task registry |
| `src/workflows/*.json` | ComfyUI API workflow templates |
| `src/lib/workflows.js` | Manifest loader |
| `src/lib/comfyui.js` | Prompt building, upload, progress |
| `src/app/api/comfy/**` | Server proxy and SSE progress relay |
| `src/app/api/generate` | Allowlisted generation entry |
| `src/hooks/useToolRunner.js` | Studio run state and options |

## License and attribution

Copyright 2026 Redrob. Built by Janghoon Lee (이장훈).

Original code in this repository is licensed under the Apache License 2.0. See [`LICENSE`](LICENSE) for the full text and [`NOTICE`](NOTICE) for attribution.

Third-party model weights are downloaded separately, are not redistributed here, and remain under their upstream licenses. See [`eval/THIRD_PARTY_WEIGHTS.md`](eval/THIRD_PARTY_WEIGHTS.md).

Security policy and reporting: [`SECURITY.md`](SECURITY.md).
