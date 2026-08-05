# Security

## Reporting

If you discover a vulnerability, open a private GitHub security advisory on
[savagemanage/redrob-studio](https://github.com/savagemanage/redrob-studio)
before public disclosure. Include steps to reproduce and impact.

## Architecture invariants

- **Server-only ComfyUI URL.** Set `COMFYUI_URL` in the Next.js server environment
  (see `.env.example`). Never put the ComfyUI origin in `NEXT_PUBLIC_*` variables.
  The browser talks only to `/api/comfy` and `/api/generate`.
- **No client workflow graphs.** Clients send `workflowId` + parameters. The server
  loads allowlisted templates from `src/workflows/`. Direct `/api/comfy/.../prompt`
  is rejected.
- **Safety gates.** Generation goes through prompt safety enforcement that fails
  closed on checker errors/timeouts. Output moderation rejects suggestive or
  explicit images (no blur / reveal path).
- **No image Edit / mature checkpoint path.** Create and other tools use the
  permissive weight set in `eval/THIRD_PARTY_WEIGHTS.md`.

## Deployment hygiene

- Keep ComfyUI on loopback (`127.0.0.1`) or a private network. Do not expose the
  ComfyUI port to the public internet.
- Do not commit `.env`, `.env.local`, tokens, or private hostnames.
- Prefer running the Next.js app behind your own auth if the instance is reachable
  beyond localhost; the Comfy proxy is not a substitute for application auth.
- No eval fixtures are shipped; add local media under `eval/fixtures/` only.
- Face-swap (ReActor), RMBG, CodeFormer, LTX video gen, lipsync, and image Edit
  are not in the allowlisted workflow set and are rejected if a template tries
  to enable them.
- Pin and review custom-node installs on the GPU host; this tree ships an OSS-safe
  node set via `scripts/setup-comfyui-local.sh` only.

## Secrets

- Optional `HF_TOKEN` is for GPU-host model downloads only. Do not place Hugging Face
  or cloud credentials in the Next.js app env.
- Rotate any credentials that were ever committed historically before publishing a
  fork or mirror.
