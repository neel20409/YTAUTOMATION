# Daily Video Pipeline

Fully automated: topic → script (Gemini) → voiceover (Gemini TTS) → video clips (Veo, called
directly via API — no Flow, no copy-pasting) → stitched (ffmpeg) → uploaded (YouTube Data API v3).
Runs daily via GitHub Actions cron across all three channels (BharatKaal, Heritage Unfolded,
Bloop and Boo — all brand accounts under one Google login).

## What this replaces in your current manual workflow

| Manual step | Automated with |
|---|---|
| Writing script by hand | Gemini text model (`gemini-2.5-pro`), structured JSON output |
| Recording/generating voiceover | Gemini TTS (`gemini-3.1-flash-tts-preview`) |
| Pasting prompts into Google Flow | Veo called directly via `@google/genai` (`generateVideos`) |
| Suno AI for music | **Not automated** — see "Known gaps" below |
| Clipchamp editing | ffmpeg, scripted (mute clip audio, overlay voiceover, concat scenes) |
| Manual YouTube upload | YouTube Data API v3 |

## One-time setup

1. **Gemini API key**: get one from Google AI Studio, put it in `.env` as `GEMINI_API_KEY`.
2. **YouTube OAuth client**: create one OAuth client (type: Desktop app) in Google Cloud Console
   for a project that has the YouTube Data API v3 enabled. Put the client ID/secret in `.env`.
3. **YouTube refresh token — once per channel**: BharatKaal, Heritage Unfolded, and Bloop and Boo
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
4. **Seed a few topics**: edit `data/topics.json` with a handful of starting titles per channel.
   After that the queue tops itself up automatically (see below) — you shouldn't need to keep
   editing this file by hand.
5. **GitHub Actions secrets**: in your repo settings → Secrets and variables → Actions, add
   `GEMINI_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, and all
   three `YOUTUBE_REFRESH_TOKEN_*` values — same values as your `.env`.
6. Push this repo to GitHub. Two workflows run automatically:
   - `daily-pipeline.yml` — daily at 04:00 UTC, generates and uploads one video per channel
     (channels run one at a time, not in parallel, since they share `data/topics.json`).
   - `topic-topup.yml` — weekly (Sunday 03:00 UTC), researches and adds new topics for any
     channel whose pending queue has dropped to 3 or fewer.

## Automatic topic discovery

`src/topicDiscovery.ts` uses Gemini's Google Search grounding tool to research what's currently
relevant for each channel's niche — recent news, anniversaries, new discoveries, rising interest —
then converts that research into a strict JSON list of candidate titles, explicitly told to avoid
overlapping with every title already in the queue (pending or done).

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

## Known gaps / things you'll still touch by hand

- **Music (Suno)**: Suno has no official public API as of mid-2026. Options: (a) skip background
  music for the automated run and add it as a manual post-pass for videos you want extra polish
  on, (b) swap in a service with a real API (e.g. royalty-free library, or a music-generation API),
  which would slot into `src/` as a new module the same way `tts.ts` does.
- **Thumbnails**: not automated here. Given your CTR research already showed cinematic Veo stills
  with bold text outperform portrait thumbnails, a follow-up step could take the last frame of a
  scene clip + an image-generation/text-overlay pass and set it via `videos.update` — happy to add
  this as a next module if useful.
- **Veo prompt safety filters**: `scriptGen.ts`'s system instruction already tells the model to
  avoid "battle", "army attacking", "fight", and naming specific active religious sites, based on
  your prior trial-and-error. If a clip still gets blocked, `generateClip` throws with the
  offending prompt logged — worth keeping an eye on the first few runs.
- **Costs**: Veo is billed per second of generated video, and TTS/text calls are billed separately.
  With 4-6 scenes/video × 3 channels/day, check current Gemini API pricing before leaving the cron
  job unattended for weeks.

## Extending

Each pipeline stage is its own file (`scriptGen.ts`, `tts.ts`, `veo.ts`, `stitch.ts`, `upload.ts`),
called in sequence from `index.ts`. To swap a piece (e.g. a different TTS provider, or adding
music generation), you only need to change that one file's exported function signature stays
the same at the call site in `index.ts`.
