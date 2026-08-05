# Eval fixtures

Local-only inputs for voice-clone. **No media is shipped** in this repository.

Place your own files under:

```text
eval/fixtures/sfw/
  audio/*.mp3   # voice-clone reference clips
```

Then set `audioFixture` on suite prompts (relative to `eval/fixtures/`).

Supported audio extensions: `.mp3`, `.wav`, `.flac`, `.ogg`.
