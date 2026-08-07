# Redrob Studio

[English](./README.md) | 한국어

로컬 GPU의 ComfyUI를 백엔드로 쓰는 Next.js 스튜디오입니다. **이미지·오디오** 도구를 브라우저에서 돌리고, 호스팅된 추론 API로는 보내지 않습니다. 웹앱이 직접 통제하는 ComfyUI 프로세스와만 통신합니다.

채팅 UI와 비디오 생성 스택은 없습니다. 홈(`/`)은 도구 목록이고, 각 도구는 자체 워크스페이스로 열립니다.

이장훈 (Janghoon Lee)이 Redrob를 위해 만들었습니다. 라이선스는 Apache License 2.0입니다.

**저장소:** [redrob-labs/redrob-studio](https://github.com/redrob-labs/redrob-studio)

## 요구 사항

| 구분 | 최소 |
| ---- | ---- |
| Node.js | 20+ (`package.json` `engines` 참고) |
| 패키지 매니저 | yarn |
| OS (앱) | Next.js를 돌릴 수 있는 OS |
| OS (GPU 호스트) | Ubuntu 권장, NVIDIA GPU + 최신 CUDA 드라이버 |
| 디스크 (GPU 호스트) | ComfyUI 커스텀 노드·모델용으로 수십 GB 여유 |
| VRAM - Create만 | NVIDIA VRAM 약 12 GB 권장 (`redrob-image` UNET + CLIP + VAE) |
| VRAM - 전체 스택 | 약 24 GB 이상 권장 (Create + Qwen TTS/ASR/VL + ACE-Step 음악) |

Next.js 앱 자체는 가볍습니다. 생성은 ComfyUI에서 돌아가므로, GPU 호스트 없이는 UI만 열리고 결과는 나오지 않습니다.

## 기능

| 모달리티 | 도구 |
| -------- | ---- |
| 이미지 | 만들기 ([Redrob Image](https://huggingface.co/savagemanage/redrob-image)), 업스케일 (Lanczos), 용량 줄이기, 형식 변환, 비전 |
| 오디오 | 말하기, 복제, 디자인, 음악 (Redrob Tune / ACE-Step), 받아쓰기, 오디오 추출 (영상 파일에서), 변환 |

도구는 `src/workflows/manifest.json`에 등록되고, `src/workflows/`의 ComfyUI API 워크플로 템플릿을 서버에서 id로 해석합니다.

UI는 영어·한국어를 지원합니다. 헤더의 EN / 한국어 토글로 바꾸고, 선택은 `localStorage`에 저장됩니다. 문구는 `src/lib/i18n/messages.js`에 있습니다. 홈(`/`)은 도구 목록이고, 각 도구는 자체 워크스페이스로 열립니다 (예: `/image/create`).

배포되는 워크플로는 Apache-2.0 / MIT / BSD 등 OSI 허용 라이선스 모델만 쓰거나, 학습 가중치가 없는 도구만 포함합니다. 목록은 [`eval/THIRD_PARTY_WEIGHTS.md`](eval/THIRD_PARTY_WEIGHTS.md)를 보세요.

## 구조

```
Browser  --HTTP/SSE-->  Next.js (/api/comfy, /api/generate)
                             |
                             |  COMFYUI_URL (서버 전용)
                             v
                        ComfyUI backend
```

브라우저는 ComfyUI에 직접 붙지 않습니다. `COMFYUI_URL`은 서버 전용이며 `NEXT_PUBLIC_*`로 노출하지 않습니다. 진행 상황은 서버의 ComfyUI WebSocket 구독을 SSE로 중계하고, 워크플로 그래프는 허용 목록 템플릿(`workflowId` + 파라미터)으로만 서버에서 조립합니다. 배포 원칙은 [`SECURITY.md`](SECURITY.md)를 참고하세요.

## 빠른 시작

```bash
yarn install
cp .env.example .env.local   # COMFYUI_URL 설정
yarn dev
```

```bash
# .env.local
COMFYUI_URL=http://127.0.0.1:8188
```

`COMFYUI_URL`을 비우면 기본값은 `http://127.0.0.1:8188`입니다. `.env.local`을 바꾼 뒤에는 개발 서버를 다시 켜세요.

## GPU 호스트 설정

NVIDIA GPU가 있는 Ubuntu에서 부트스트랩 스크립트가 ComfyUI, 필요한 커스텀 노드, 허용 라이선스 가중치를 설치합니다. 클라우드 배포·시크릿은 다루지 않습니다.

```bash
export COMFY_HOME=~/ComfyUI
# optional: export HF_TOKEN=hf_...   # Hugging Face 인증이 필요할 때만
bash scripts/setup-comfyui-local.sh                    # 전체 스택
# bash scripts/setup-comfyui-local.sh --profile create # Create 모델만
```

| 항목 | 경로 |
| ---- | ---- |
| ComfyUI | `$COMFY_HOME` (기본 `~/ComfyUI`) |
| venv | `$COMFY_HOME/venv` |
| Models | `$COMFY_HOME/models` (`COMFY_MODELS`로 덮어쓸 수 있음) |

ComfyUI를 루프백에 띄운 뒤 Next.js를 연결하세요.

```bash
cd "$COMFY_HOME"
./venv/bin/python main.py --listen 127.0.0.1 --port 8188
```

ComfyUI는 호스트 네트워크에만 두고, 공개 인터넷에 포트를 열지 마세요. GPU 호스트에서 `http://127.0.0.1:8188`을 열고 `src/workflows/` JSON을 캔버스에 끌어다 그래프를 직접 볼 수 있습니다.

## Create 모델

이미지 만들기는 UNET 하나, [savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image) (`task`: `redrob-image`)를 씁니다.

| `$COMFY_HOME/models` 아래 파일 | 역할 | 출처 |
| ------------------------------- | ---- | ---- |
| `diffusion_models/redrob-image.safetensors` | 병합 UNET | [savagemanage/redrob-image](https://huggingface.co/savagemanage/redrob-image) |
| `text_encoders/qwen_3_4b_fp8_mixed.safetensors` | CLIP | [Comfy-Org/z_image_turbo](https://huggingface.co/Comfy-Org/z_image_turbo) |
| `vae/ae.safetensors` | VAE | [Comfy-Org/HiDream-I1_ComfyUI](https://huggingface.co/Comfy-Org/HiDream-I1_ComfyUI) |

샘플러 기본값: 8 steps, CFG 1, `res_multistep` / `sgm_uniform`.

## 문제 해결

**`COMFYUI_URL is not set`, 또는 프록시가 502**

`.env.local`에 `COMFYUI_URL`을 넣고 개발 서버를 재시작하세요. 앱은 `/api/comfy`와 `/api/generate`로만 ComfyUI에 닿습니다.

**8188 포트에 연결되지 않음**

`COMFYUI_URL`에 적힌 주소에서 ComfyUI가 듣고 있는지 확인하세요.

```bash
ss -tlnp | grep 8188
curl -sS "$COMFYUI_URL/system_stats" | head
```

**노드 또는 모델 누락**

GPU 호스트에 커스텀 노드를 설치하고 ComfyUI를 재시작하거나, `scripts/setup-comfyui-local.sh`를 다시 실행하세요. 모델 파일명·폴더는 워크플로 JSON과 정확히 같아야 합니다.

**ComfyUI 에러 확인**

```bash
cd "$COMFY_HOME" && source venv/bin/activate
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
python main.py --listen 127.0.0.1 --port 8188
```

## 저장소 구조

| 경로 | 역할 |
| ---- | ---- |
| `src/workflows/manifest.json` | 스튜디오 태스크 레지스트리 |
| `src/workflows/*.json` | ComfyUI API 워크플로 템플릿 |
| `src/lib/workflows.js` | 매니페스트 로더 |
| `src/lib/comfyui.js` | 프롬프트 조립, 업로드, 진행 |
| `src/app/api/comfy/**` | 서버 프록시와 SSE 진행 중계 |
| `src/app/api/generate` | 허용 목록 생성 진입점 |
| `src/hooks/useToolRunner.js` | 스튜디오 실행 상태와 옵션 |

## 라이선스와 고지

Copyright 2026 Redrob. Built by 이장훈 (Janghoon Lee).

이 저장소의 원본 코드는 Apache License 2.0입니다. 전문은 [`LICENSE`](LICENSE), 고지는 [`NOTICE`](NOTICE)를 보세요.

서드파티 모델 가중치는 따로 받으며 이 저장소에 포함되지 않고, 각각 업스트림 라이선스를 따릅니다. [`eval/THIRD_PARTY_WEIGHTS.md`](eval/THIRD_PARTY_WEIGHTS.md)를 참고하세요.

보안 정책: [`SECURITY.md`](SECURITY.md).
