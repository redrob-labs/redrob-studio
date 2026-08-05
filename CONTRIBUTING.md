# Contributing

Thanks for interest in Redrob Studio.

## Development

```bash
yarn install
cp .env.example .env.local
yarn dev
```

Point `COMFYUI_URL` at a local ComfyUI instance. See `README.md` and
`scripts/setup-comfyui-local.sh` for GPU-host setup.

## Guidelines

- Keep the shipped workflow set Apache-2.0 / MIT / BSD–safe. Do not reintroduce
  non-permissive checkpoints or merged packs with unclear LoRA provenance.
- Do not commit `.env`, tokens, private hostnames, or generated media under
  `eval/fixtures/` unless provenance is documented.
- Prefer small, focused PRs. Match existing code style.
- Run `yarn test` and `yarn lint` before opening a PR when you touch app logic.

## Security

See `SECURITY.md` for vulnerability reporting.
