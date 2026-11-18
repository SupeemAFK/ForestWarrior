# The Park Radio

A short first-person browser game about a night shift at a forest radio station. You take a call from Patrol Unit 04 on a rainy night. A session usually takes 1–2 minutes, and the conversation waits while you speak or the browser finishes transcribing.

## Run locally

Use Node.js 22.12 or later and the pnpm version specified in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in Chrome or Edge on a desktop computer with WebGL 2 support.

Use **WASD** to walk and move the mouse to look around. If the pointer is released, click or drag on the scene to look around again.

When a reply prompt appears, **hold Space and speak**. A live transcript appears as you talk. Release Space to send your reply. Your subtitle appears before Unit 04 responds with its own subtitles. If you stay silent, the conversation resumes after a pause.

The game uses the browser's Web Speech API for Thai transcription. Speech recognition may require an internet connection and microphone permission on localhost or HTTPS. The game keeps transcripts in memory for the current session.

## Voice audio

The game ships with 26 FLAC clips generated locally with Thonburian TTS MegaF5 using a reference recording from the model's demo. It loads the clips listed in `public/stillwater-voice/manifest.json` and waits for each clip to finish before advancing. Pauses are set per line, and the waveform next to Unit 04's subtitles follows the live radio signal.

Speech passes through compression, asymmetric saturation, and filters that simulate a radio speaker. The effect also adds subtle modulation and a brief signal dip in longer clips. If a clip is unavailable, the game uses Thai browser text-to-speech when available.

`scripts/generate-voice.py` generates the voice clips locally with [Thonburian TTS](https://github.com/biodatlab/thonburian-tts). Install the dependencies from the Thonburian README, then download the [MegaF5 checkpoint and vocabulary](https://huggingface.co/biodatlab/ThonburianTTS/tree/main/megaF5).

```bash
python scripts/generate-voice.py \
  --checkpoint /path/to/mega_f5_last.safetensors \
  --vocab /path/to/mega_vocab.txt \
  --reference /path/to/thonburian-tts/assets/000000.wav \
  --reference-text 'ใครเป็นผู้รับ'
```

The reference text must match the Thai speech in the demo recording. Add `--line incoming` to generate just the opening line for a quick check. The model is distributed under CC BY-NC-SA 4.0, as specified by its authors.

## Type-check and build

Run `pnpm typecheck` to check TypeScript. Run `pnpm build` to type-check and generate the static site in `dist/`.

## Deploy to Cloudflare Workers

`wrangler.json` targets the `forestwarrior` Worker and serves the static site from `dist/`.

```bash
pnpm exec wrangler login
pnpm run deploy
```

The deploy script builds the game before uploading it. For Git integration through Workers Builds, set the build command to `pnpm build` and the deploy command to `pnpm exec wrangler deploy`.

## Credits

- The story was inspired by real interviews with Bua and Ked, staff of the Seub Nakhasathien Foundation. The game's characters and dialogue are fictional.
- The push-to-talk interaction was inspired by [3AM Stories](https://3am.x10.games/presskit/).
- Noto Sans Thai is distributed under the SIL Open Font License included in `public/`.
