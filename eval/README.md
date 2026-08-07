# Eval (open-source-safe)

Open **[/eval](/eval)** (history under `/eval/<runId>`).

Suites cover **image Create**, **music (audio)**, and **voice**.
Image Create uses [Redrob Image](https://huggingface.co/redrob-labs/redrob-image).
See [`THIRD_PARTY_WEIGHTS.md`](./THIRD_PARTY_WEIGHTS.md) and [`FINDINGS.md`](./FINDINGS.md).

## Suites

| File | Run on |
| ---- | ------ |
| `suites/sfw/image-comparison.json` | Create — Redrob Image |
| `suites/sfw/sfw-audio.json` | Redrob Tune / ACE-Step music |
| `suites/sfw/sfw-speak.json` | Speak |
| `suites/sfw/sfw-voice-clone.json` | Clone |
| `suites/sfw/sfw-voice-design.json` | Design |

Voice clone needs local audio under `eval/fixtures/sfw/audio/` (see `fixtures/README.md`).

## Results layout

```text
eval/runs/<date>_<time>_<suite>/
  meta.json
  ratings.jsonl
  <combo-id>/
    <prompt-id>_seed42.png
```
