# Daily Video Pipeline

Fully automated, **$0 to run**: topic → script (Gemini, free tier) → voiceover (Piper TTS, local
and free) → scene image (Pollinations.ai, free) animated with a pan/zoom effect → stitched
(ffmpeg) → uploaded (YouTube Data API v3). Runs daily via GitHub Actions cron across all three
channels (BharatKaal, Heritage Unfolded, Bloop and Boo — all brand accounts under one Google
login).

This is the free-tier version of the pipeline. **Veo (real AI-generated video motion) and Gemini
TTS have no free tier at all** — any call to either requires Cloud Billing enabled, regardless of
subscription. The working implementations for both are parked in `src/paid/` for whenever you're
ready to pay for them — see "Switching to the paid version" below.

## What this replaces in your current manual workflow

| Manual step | Automated with |
|---|---|
| Writing script by hand | Gemini text model (`gemini-3-flash-preview`, free tier), structured JSON output |
| Recording/generating voiceover | Piper TTS — free, open-source, runs locally, no API key |
| Pasting prompts into Google Flow | Pollinations.ai generates a still image per scene (free, no key); `stitch.ts` animates it with a pan/zoom effect |
| Suno AI for music | **Not automated** — see "Known gaps" below |
| Clipchamp editing | ffmpeg, scripted (animate image, overlay voiceover, concat scenes) |
| Manual YouTube upload | YouTube Data API v3 |

## Free-tier setup

1. **Gemini API key**: get one from Google AI Studio, put it in `.env` as `GEMINI_API_KEY`. No
   billing needed — `gemini-3-flash-preview` (script gen, topic research/structuring) is free
   tier as of mid-2026.
2. **Install Piper TTS** (local voice engine, one-time):
   - Download the binary for your OS from the [Piper releases page](https://github.com/rhasspy/piper/releases/latest)
     (Windows: `piper_windows_amd64.zip`; Linux: `piper_linux_x86_64.tar.gz`).
   - Extract it — you'll get a `piper/` folder with a `piper`/`piper.exe` executable inside.
   - Either add that folder to your PATH, or set `PIPER_PATH=<full path to piper.exe>` in `.env`.
3. **Download voice models** into a `voices/` folder in the project root (each is an `.onnx` +
   matching `.onnx.json`, from the [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)
   Hugging Face repo):
   - `hi_IN-pratham-medium` (BharatKaal, Hindi)
   - `en_US-lessac-medium` (Heritage Unfolded, English)
   - `en_US-amy-medium` (Bloop and Boo, English)

   Example (adjust for PowerShell's `Invoke-WebRequest` if you don't have `curl`):
   ```bash
   mkdir voices
   curl -L -o voices/hi_IN-pratham-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx
   curl -L -o voices/hi_IN-pratham-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx.json
   # ...repeat for en_US-lessac-medium and en_US-amy-medium
   ```
4. **Install ffmpeg** if you haven't already (`ffmpeg -version` should work in your terminal).
5. **YouTube OAuth client**: create one OAuth client (type: Desktop app) in Google Cloud Console
   for a project that has the YouTube Data API v3 enabled. Put the client ID/secret in `.env`.
6. **YouTube refresh token — once per channel**: BharatKaal, Heritage Unfolded, and Bloop and Boo
   are each a separate brand account under the same Google login, and YouTube's consent screen
   makes you pick one specific channel per authorization. So run this three times, once per
   channel, signing in and picking the matching channel each time:
   ```
   npm install
   CHANNEL=bharatkaal npm run get-youtube-token
   CHANNEL=heritage_unfolded npm run get-youtube-token
   CHANNEL=bloop_and_boo npm run get-youtube-token
   ```
   Each run prints a channel-specific line (e.g. `YOUTUBE_REFRESH_TOKEN_BHARATKAAL=...`) — put all
   three into `.env`.
7. **Seed a few topics**: edit `data/topics.json` with a handful of starting titles per channel.
   After that the queue tops itself up automatically (see below) — you shouldn't need to keep
   editing this file by hand.
8. **GitHub Actions secrets**: in your repo settings → Secrets and variables → Actions, add
   `GEMINI_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, and all
   three `YOUTUBE_REFRESH_TOKEN_*` values — same values as your `.env`. (Piper + the voice models
   are installed fresh in CI each run — see `daily-pipeline.yml`, no secret needed for those.)
9. Push this repo to GitHub. Two workflows run automatically:
   - `daily-pipeline.yml` — daily at 04:00 UTC, generates and uploads one video per channel
     (channels run one at a time, not in parallel, since they share `data/topics.json`).
   - `topic-topup.yml` — weekly (Sunday 03:00 UTC), researches and adds new topics for any
     channel whose pending queue has dropped to 3 or fewer.

## Automatic topic discovery

`src/topicDiscovery.ts` uses Gemini's Google Search grounding tool (free up to 5,000 grounded
prompts/month on the Gemini 3.x family) to research what's currently relevant for each channel's
niche — recent news, anniversaries, new discoveries, rising interest — then converts that research
into a strict JSON list of candidate titles, explicitly told to avoid overlapping with every title
already in the queue (pending or done).

`src/topUpTopics.ts` checks each channel's pending count; if it's at or below `MIN_PENDING` (3), it
researches `TOPUP_COUNT` (5) new topics and appends them with auto-generated ids. Both constants
sit at the top of that file if you want the queue to run deeper or shallower before topping up.

Run it manually any time too:
```
npm run topup-topics                      # checks all channels
CHANNEL=bharatkaal npm run topup-topics   # just one channel
```

Worth spot-checking the first few auto-discovered topics before trusting it fully — grounded search
is good but not infallible, and "trending" means something different per channel: news/anniversaries
for the history channels, evergreen values/story themes for Bloop and Boo — which is why the research
prompt is built from each channel's `topicNiche` in `config.ts` rather than one generic query.

## Running locally (to test before trusting the cron job)

```
npm install
CHANNEL=bharatkaal npm run pipeline
```

Watch the console output scene-by-scene; check `tmp/<channel>-<topicId>/` for intermediate files
if something looks off before it gets cleaned up.

## Switching to the paid version (Veo + Gemini TTS)

Once you're ready to enable Cloud Billing and want real AI-generated video motion instead of a
pan/zoom over a still image:

1. In `src/index.ts`, replace the `generateSceneImage` + `animateImage` calls with a single
   `generateClip()` call from `src/paid/veo.ts` (same shape as the old scaffold's `veo.ts`).
2. Replace the `generateVoiceover` import in `src/index.ts` with `src/paid/tts.ts`, and use
   `channel.ttsVoice` (Gemini prebuilt voice name) instead of `channel.piperVoice`.
3. Both parked files are unchanged from the original scaffold and already reference
   `channel.veoModel` / `channel.ttsVoice` in `config.ts` — nothing else needs to move.
4. Set a budget alert in Google Cloud Billing first — Veo is billed per second of generated
   video ($0.10-0.40/sec depending on model/tier as of mid-2026), so this is real recurring cost
   once the daily cron is on, not a one-time fee.

## Known gaps / things you'll still touch by hand

- **Music (Suno)**: Suno has no official public API as of mid-2026. Options: (a) skip background
  music for the automated run and add it as a manual post-pass for videos you want extra polish
  on, (b) swap in a service with a real API (e.g. royalty-free library, or a music-generation API),
  which would slot into `src/` as a new module the same way `tts.ts` does.
- **Image/video prompt safety**: `scriptGen.ts`'s system instruction avoids "battle", "army
  attacking", "fight", and naming specific active religious sites — originally tuned for Veo's
  safety filters, kept as good general prompt hygiene for the free image generator too.
- **Free-tier variability**: Pollinations.ai and the free Gemini tier don't come with uptime/rate
  guarantees the way a paid API does — expect occasional slow responses or failures under load.
  Gemini calls already retry automatically on 429/503 (see `retry.ts`); consider adding the same
  to `imageGen.ts` if Pollinations failures become a problem in practice.

## Image accuracy and verification

Free image generators can drift toward whichever iconography is most represented in their
training data - e.g. rendering "an ancient ruler on a throne" as Genghis Khan when the real
subject is a less globally-famous figure like Chanakya. Two layers guard against this:

1. **Prompting** (`scriptGen.ts` + `config.ts`'s `imageAccuracyAnchor`): every image prompt must
   name the actual person/place explicitly, state region/ethnicity/attire concretely, and use a
   framing that keeps a named person's face visible (never a wide/aerial/over-the-shoulder shot
   for a character-focused scene) - and `imageAccuracyAnchor` is appended to every prompt at the
   code level in `imageGen.ts`, not just requested in the system instruction, so it can't be
   dropped by the model.
2. **Verification** (`imageVerify.ts` + `generateVerifiedSceneImage` in `imageGen.ts`): after
   generating, the image is sent back to Gemini's vision model along with the intended context
   and checked for wrong-culture drift, a hidden/missing face, or an unrelated subject. If it
   fails, it regenerates once more with the reported issue folded into the prompt, then falls
   back to the best-effort result rather than blocking the pipeline indefinitely - a free image
   model won't nail every prompt, and that's a more honest failure mode than pretending it will.

## Thumbnails

`thumbnail.ts` builds a custom 16:9 YouTube thumbnail automatically for every video: it takes the
first scene's image, crops it to 16:9, and overlays the video title in large bold caps (using the
bundled Anton font under `assets/fonts/` so this renders identically on Windows and in CI) with a
semi-transparent box behind the text for legibility. `index.ts` sets it via `youtube.thumbnails.set`
right after upload — if that call fails (usually because the channel isn't yet verified for custom
thumbnails), the video stays live without a custom thumbnail rather than failing the whole run.

## Scene motion

`stitch.ts`'s `animateImage()` cycles through five Ken Burns-style motion presets (zoom in, zoom
out, and pans in each direction) by scene index, so a video isn't just the same zoom-in repeated
scene after scene.

## Extending

Each pipeline stage is its own file (`scriptGen.ts`, `tts.ts`, `imageGen.ts`, `stitch.ts`,
`upload.ts`), called in sequence from `index.ts`. To swap a piece (e.g. a different TTS provider,
or adding music generation), you only need to change that one file's exported function signature
stays the same at the call site in `index.ts`.
