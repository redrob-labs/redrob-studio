#!/usr/bin/env bash
# Local Ubuntu ComfyUI bootstrap for redrob-studio (open-source-safe).
#
# Installs ComfyUI, OSS-safe custom nodes, and model weights required by the
# shipped Studio workflows. Does NOT configure cloud deploy, reverse proxies,
# domains, systemd, or hardcoded tokens.
#
# Usage (on Ubuntu with a GPU + CUDA drivers):
#   export HF_TOKEN=hf_...          # optional; only if a repo needs auth
#   export COMFY_HOME=~/ComfyUI     # optional
#   bash scripts/setup-comfyui-local.sh
#   bash scripts/setup-comfyui-local.sh --profile create   # Create stacks only
#   bash scripts/setup-comfyui-local.sh --skip-models      # code + nodes only
#
# Then start ComfyUI (loopback):
#   cd "$COMFY_HOME" && ./venv/bin/python main.py --listen 127.0.0.1 --port 8188
#
# Point the Next.js app at it:
#   COMFYUI_URL=http://127.0.0.1:8188

set -euo pipefail

PROFILE="all"
SKIP_MODELS=0
SKIP_TORCH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:?}"
      shift 2
      ;;
    --skip-models)
      SKIP_MODELS=1
      shift
      ;;
    --skip-torch)
      SKIP_TORCH=1
      shift
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

case "$PROFILE" in
  all|create|audio|vision) ;;
  *)
    echo "Invalid --profile '$PROFILE' (all|create|audio|vision)" >&2
    exit 1
    ;;
esac

APP_USER="${SUDO_USER:-${USER:-ubuntu}}"
COMFY_HOME="${COMFY_HOME:-/home/${APP_USER}/ComfyUI}"
if [[ "$COMFY_HOME" == ~* ]]; then
  COMFY_HOME="${COMFY_HOME/#\~/$HOME}"
fi
MODELS="${COMFY_MODELS:-$COMFY_HOME/models}"
VENV="$COMFY_HOME/venv"
HF="$VENV/bin/hf"
HF_TOKEN="${HF_TOKEN:-}"

TORCH_INDEX_URL="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu130}"
TORCH_VER="${TORCH_VER:-2.9.0}"
TORCHVISION_VER="${TORCHVISION_VER:-0.24.0}"
TORCHAUDIO_VER="${TORCHAUDIO_VER:-2.9.0}"
TORCHCODEC_VER="${TORCHCODEC_VER:-0.9.1}"

log() { printf '[setup] %s\n' "$*"; }
warn() { printf '[setup:warn] %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    apt-get update
    apt-get install -y git python3-venv python3-pip ffmpeg sox libsox-dev rsync espeak-ng unzip curl
  else
    sudo apt-get update
    sudo apt-get install -y git python3-venv python3-pip ffmpeg sox libsox-dev rsync espeak-ng unzip curl
  fi
else
  warn "apt-get not found — install git, python3-venv, ffmpeg, sox yourself"
fi

# ---------------------------------------------------------------------------
# 2. ComfyUI checkout
# ---------------------------------------------------------------------------
if [[ ! -f "$COMFY_HOME/requirements.txt" ]]; then
  if [[ ! -d "$COMFY_HOME" ]]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFY_HOME"
  elif [[ ! -d "$COMFY_HOME/.git" ]]; then
    log "$COMFY_HOME exists but is not a git checkout; merging fresh clone…"
    TMP=$(mktemp -d)
    git clone https://github.com/comfyanonymous/ComfyUI.git "$TMP/ComfyUI"
    cp -a "$TMP/ComfyUI"/. "$COMFY_HOME/"
    rm -rf "$TMP"
  fi
fi

git -C "$COMFY_HOME" fetch origin
if git -C "$COMFY_HOME" rev-parse --verify origin/master >/dev/null 2>&1; then
  git -C "$COMFY_HOME" checkout -B master origin/master
  git -C "$COMFY_HOME" pull --ff-only origin master || git -C "$COMFY_HOME" pull origin master
else
  git -C "$COMFY_HOME" pull --ff-only || git -C "$COMFY_HOME" pull || true
fi

mkdir -p "$MODELS"/{checkpoints,diffusion_models,text_encoders,vae,loras,LLM/Qwen-VL,qwen-tts,Qwen3-ASR}

# ---------------------------------------------------------------------------
# 3. venv + PyTorch + ComfyUI requirements
# ---------------------------------------------------------------------------
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip

if [[ "$SKIP_TORCH" -eq 0 ]]; then
  "$VENV/bin/pip" install \
    "torch==${TORCH_VER}" "torchvision==${TORCHVISION_VER}" "torchaudio==${TORCHAUDIO_VER}" \
    --index-url "$TORCH_INDEX_URL" \
    --no-cache-dir
fi

"$VENV/bin/pip" install -r "$COMFY_HOME/requirements.txt" "huggingface_hub>=0.34,<1.0"

if [[ ! -x "$HF" ]]; then
  echo "ERROR: hf CLI missing at $HF" >&2
  exit 1
fi

if [[ -n "$HF_TOKEN" ]]; then
  "$HF" auth login --token "$HF_TOKEN"
else
  log "HF_TOKEN unset — public downloads only (set HF_TOKEN if a fetch fails auth)"
fi

"$VENV/bin/pip" install comfy-kitchen --upgrade --no-cache-dir || true

# ---------------------------------------------------------------------------
# 4. Helpers
# ---------------------------------------------------------------------------
hf_fetch() {
  local repo="$1"
  local repo_path="$2"
  local dest="$3"
  if [[ -f "$dest" ]]; then
    log "skip existing $dest"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  local staging="$MODELS/.hf-staging"
  rm -rf "$staging"
  mkdir -p "$staging"
  log "fetch $repo/$repo_path -> $dest"
  if ! "$HF" download "$repo" "$repo_path" --local-dir "$staging"; then
    rm -rf "$staging"
    warn "failed $repo/$repo_path"
    return 1
  fi
  local fetched="$staging/$repo_path"
  if [[ ! -f "$fetched" ]]; then
    warn "HF fetch missing file $fetched"
    rm -rf "$staging"
    return 1
  fi
  mv -f "$fetched" "$dest"
  rm -rf "$staging"
}

hf_repo() {
  local repo="$1"
  local dest="$2"
  if [[ -f "$dest/config.json" ]]; then
    log "skip existing repo $dest"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  log "fetch repo $repo -> $dest"
  "$HF" download "$repo" --local-dir "$dest" || warn "failed repo $repo"
}

clone_node() {
  local url="$1"
  local name="$2"
  local dir="$COMFY_HOME/custom_nodes/$name"
  if [[ -d "$dir/.git" ]]; then
    git -C "$dir" pull --ff-only || git -C "$dir" pull || true
    return 0
  fi
  if [[ -d "${dir}.disabled" && ! -d "$dir" ]]; then
    mv "${dir}.disabled" "$dir"
  fi
  if [[ ! -d "$dir" ]]; then
    git clone "$url" "$dir"
  fi
}

# ---------------------------------------------------------------------------
# 5. Custom nodes (OSS-safe only — no ReActor / RMBG / LTX / Krea INT8)
# ---------------------------------------------------------------------------
mkdir -p "$COMFY_HOME/custom_nodes"
clone_node https://github.com/Comfy-Org/ComfyUI-Manager.git ComfyUI-Manager
clone_node https://github.com/kijai/ComfyUI-KJNodes.git ComfyUI-KJNodes
clone_node https://github.com/1038lab/ComfyUI-QwenVL.git ComfyUI-QwenVL
clone_node https://github.com/DarioFT/ComfyUI-Qwen3-ASR.git ComfyUI-Qwen3-ASR
clone_node https://github.com/fairy-root/ComfyUI-Show-Text.git ComfyUI-Show-Text
clone_node https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git ComfyUI-VideoHelperSuite
clone_node https://github.com/Goktug/comfyui-saveimage-plus.git comfyui-saveimage-plus

QWEN_TTS_DIR="$COMFY_HOME/custom_nodes/ComfyUI-QwenTTS"
if [[ ! -f "$QWEN_TTS_DIR/__init__.py" || ! -f "$QWEN_TTS_DIR/nodes.py" ]]; then
  rm -rf "$QWEN_TTS_DIR"
  git clone https://github.com/flybirdxx/ComfyUI-Qwen-TTS.git "$QWEN_TTS_DIR"
fi
if [[ -d "${QWEN_TTS_DIR}.disabled" && ! -d "$QWEN_TTS_DIR" ]]; then
  mv "${QWEN_TTS_DIR}.disabled" "$QWEN_TTS_DIR"
fi

for d in "$COMFY_HOME"/custom_nodes/*/; do
  if [[ -f "$d/requirements.txt" && "$d" != *ComfyUI-QwenTTS* ]]; then
    "$VENV/bin/pip" install -r "$d/requirements.txt" || true
  fi
done

# Qwen3-TTS deps (keep torch pins intact)
if [[ -d "$QWEN_TTS_DIR" ]]; then
  "$VENV/bin/pip" uninstall -y qwen-tts qwen_tts 2>/dev/null || true
  "$VENV/bin/pip" install "numpy>=1.26.4,<2.2" || true
  if [[ -f "$QWEN_TTS_DIR/requirements.txt" ]]; then
    "$VENV/bin/pip" install -r "$QWEN_TTS_DIR/requirements.txt" --no-deps || true
    "$VENV/bin/pip" install librosa soundfile accelerate einops tiktoken sentencepiece \
      huggingface_hub safetensors "scipy>=1.11.0" || true
  fi
fi

"$VENV/bin/pip" install pydub qwen-asr \
  "transformers==4.57.3" "kernels<0.13.0" "huggingface_hub>=0.34,<1.0" || true

if [[ "$SKIP_TORCH" -eq 0 ]]; then
  "$VENV/bin/pip" install \
    "torch==${TORCH_VER}" "torchvision==${TORCHVISION_VER}" "torchaudio==${TORCHAUDIO_VER}" \
    --index-url "$TORCH_INDEX_URL" \
    --no-cache-dir
  "$VENV/bin/pip" install "torchcodec==${TORCHCODEC_VER}" \
    --index-url "$TORCH_INDEX_URL" \
    --no-cache-dir || true
fi

# ---------------------------------------------------------------------------
# 6. Models
# ---------------------------------------------------------------------------
if [[ "$SKIP_MODELS" -eq 1 ]]; then
  log "Skipping model downloads (--skip-models)"
else
  # --- Create: Redrob Image (redrob-labs/redrob-image) ---
  if [[ "$PROFILE" == "all" || "$PROFILE" == "create" ]]; then
    hf_fetch redrob-labs/redrob-image \
      redrob-image.safetensors \
      "$MODELS/diffusion_models/redrob-image.safetensors" || true
    hf_fetch Comfy-Org/z_image_turbo \
      split_files/text_encoders/qwen_3_4b_fp8_mixed.safetensors \
      "$MODELS/text_encoders/qwen_3_4b_fp8_mixed.safetensors" || true
    hf_fetch Comfy-Org/HiDream-I1_ComfyUI \
      split_files/vae/ae.safetensors \
      "$MODELS/vae/ae.safetensors" || true
  fi

  # --- Audio: ACE-Step + Qwen TTS/ASR ---
  if [[ "$PROFILE" == "all" || "$PROFILE" == "audio" ]]; then
    ACE_REPO="Comfy-Org/ace_step_1.5_ComfyUI_files"
    hf_fetch "$ACE_REPO" \
      split_files/diffusion_models/acestep_v1.5_xl_turbo_bf16.safetensors \
      "$MODELS/diffusion_models/acestep_v1.5_xl_turbo_bf16.safetensors" || true
    hf_fetch "$ACE_REPO" \
      split_files/diffusion_models/acestep_v1.5_xl_sft_bf16.safetensors \
      "$MODELS/diffusion_models/acestep_v1.5_xl_sft_bf16.safetensors" || true
    hf_fetch "$ACE_REPO" \
      split_files/vae/ace_1.5_vae.safetensors \
      "$MODELS/vae/ace_1.5_vae.safetensors" || true
    hf_fetch "$ACE_REPO" \
      split_files/text_encoders/qwen_0.6b_ace15.safetensors \
      "$MODELS/text_encoders/qwen_0.6b_ace15.safetensors" || true
    hf_fetch "$ACE_REPO" \
      split_files/text_encoders/qwen_4b_ace15.safetensors \
      "$MODELS/text_encoders/qwen_4b_ace15.safetensors" || true

    hf_repo Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice \
      "$MODELS/qwen-tts/Qwen3-TTS-12Hz-1.7B-CustomVoice" || true
    hf_repo Qwen/Qwen3-TTS-Tokenizer-12Hz \
      "$MODELS/qwen-tts/Qwen3-TTS-Tokenizer-12Hz" || true
    hf_repo Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign \
      "$MODELS/qwen-tts/Qwen3-TTS-12Hz-1.7B-VoiceDesign" || true
    hf_repo Qwen/Qwen3-TTS-12Hz-1.7B-Base \
      "$MODELS/qwen-tts/Qwen3-TTS-12Hz-1.7B-Base" || true

    # talker_config pad_token_id patch (Qwen3 TTS)
    "$VENV/bin/python" - "$MODELS/qwen-tts" <<'PY' || true
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
for config_path in root.glob("*/config.json"):
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[warn] skip {config_path}: {e}")
        continue
    tc = data.get("talker_config")
    if not isinstance(tc, dict) or "pad_token_id" in tc or "codec_pad_id" not in tc:
        continue
    tc["pad_token_id"] = tc["codec_pad_id"]
    config_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] patched pad_token_id: {config_path}")
PY

    hf_repo Qwen/Qwen3-ASR-0.6B "$MODELS/Qwen3-ASR/Qwen3-ASR-0.6B" || true
    hf_repo Qwen/Qwen3-ASR-1.7B "$MODELS/Qwen3-ASR/Qwen3-ASR-1.7B" || true
  fi

  # --- Vision ---
  if [[ "$PROFILE" == "all" || "$PROFILE" == "vision" ]]; then
    mkdir -p "$MODELS/LLM/Qwen-VL"
    hf_repo Qwen/Qwen2.5-VL-7B-Instruct \
      "$MODELS/LLM/Qwen-VL/Qwen2.5-VL-7B-Instruct" || true
  fi
fi

# Ensure ComfyUI/models points at MODELS when they differ
if [[ "$(readlink -f "$COMFY_HOME/models" 2>/dev/null || true)" != "$(readlink -f "$MODELS")" ]]; then
  if [[ -L "$COMFY_HOME/models" || ! -e "$COMFY_HOME/models" ]]; then
    rm -f "$COMFY_HOME/models"
    ln -sfn "$MODELS" "$COMFY_HOME/models"
    log "symlinked $COMFY_HOME/models -> $MODELS"
  elif [[ "$MODELS" != "$COMFY_HOME/models" ]]; then
    warn "COMFY_HOME/models exists as a real directory; files landed in $MODELS"
    warn "Either set COMFY_MODELS=$COMFY_HOME/models or symlink manually."
  fi
fi

chown -R "$APP_USER:$APP_USER" "$COMFY_HOME" 2>/dev/null || true

cat <<EOF

========================================================================
ComfyUI local setup finished (profile=$PROFILE).

  COMFY_HOME=$COMFY_HOME
  MODELS=$MODELS

Start ComfyUI (bind loopback only):
  cd "$COMFY_HOME"
  ./venv/bin/python main.py --listen 127.0.0.1 --port 8188

Next.js app (.env.local):
  COMFYUI_URL=http://127.0.0.1:8188

Weights / licenses: eval/THIRD_PARTY_WEIGHTS.md
========================================================================
EOF
