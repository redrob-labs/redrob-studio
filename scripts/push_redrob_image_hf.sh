#!/usr/bin/env bash
# Upload / refresh Redrob Image on Hugging Face.
#
# Prerequisites:
#   hf auth login   # or: export HF_TOKEN=hf_...
#
# Usage:
#   HF_REPO=savagemanage/redrob-image bash scripts/push_redrob_image_hf.sh

set -euo pipefail

HF_REPO="${HF_REPO:-savagemanage/redrob-image}"
WEIGHT="${WEIGHT:-/opt/dlami/nvme/comfyui-models/diffusion_models/redrob-image.safetensors}"
CARD="${CARD:-}"
COMFY_VENV="${COMFY_VENV:-$HOME/ComfyUI/venv}"
HF_BIN="${HF_BIN:-$COMFY_VENV/bin/hf}"

if [[ ! -f "$WEIGHT" ]]; then
  echo "missing weight: $WEIGHT" >&2
  exit 1
fi

if [[ -z "$CARD" ]]; then
  if [[ -f "eval/HF_REDROB_IMAGE.md" ]]; then
    CARD="eval/HF_REDROB_IMAGE.md"
  else
    echo "Set CARD=path/to/README.md" >&2
    exit 1
  fi
fi

if [[ ! -x "$HF_BIN" ]]; then
  HF_BIN="$(command -v hf || true)"
fi
if [[ -z "$HF_BIN" ]]; then
  echo "hf CLI not found" >&2
  exit 1
fi

echo "[auth]"
"$HF_BIN" auth whoami

echo "[repo] $HF_REPO"
"$HF_BIN" repo create "$HF_REPO" --type model --exist-ok || true

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT
cp -f "$CARD" "$STAGING/README.md"
ln -f "$WEIGHT" "$STAGING/redrob-image.safetensors" 2>/dev/null \
  || cp -f "$WEIGHT" "$STAGING/redrob-image.safetensors"

echo "[upload] $(du -h "$STAGING/redrob-image.safetensors" | cut -f1)"
"$HF_BIN" upload "$HF_REPO" "$STAGING" . --repo-type model

echo "[done] https://huggingface.co/$HF_REPO"
