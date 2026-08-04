# TASK SPECIFICATION: Upgrade Static Image Animation to Free AI Image-to-Video (I2V) Generation

## 1. Context & Objective
We are upgrading our TypeScript/Node.js automated YouTube video generation pipeline. Currently, scenes are generated as static images via Pollinations.ai and animated using FFmpeg Ken Burns pan/zoom effects. 

**Objective:** Upgrade the pipeline to generate **actual AI video clips (MP4)** from verified scene images using free open-source Image-to-Video (I2V) models via Hugging Face Spaces (`@gradio/client`), while preserving our existing FFmpeg Ken Burns animation as an automatic resiliency fallback if the free cloud endpoint times out or fails.

---

## 2. Architecture & Requirements
1. **Cost Constraint:** Must remain **100% free ($0)**. Do NOT integrate any paid APIs (e.g., Runway, Luma, Google Veo, or Pika).
2. **Workflow Order:**
   - Step 1: Generate Voiceover (`src/tts.ts`).
   - Step 2: Generate Scene Image (`src/imageGen.ts`).
   - Step 3: Verify Image Accuracy (`src/imageVerify.ts`).
   - Step 4: **NEW** -> Convert Verified Image to a 2–4s `.mp4` video clip via `src/videoGen.ts` (`@gradio/client`).
   - Step 5: **NEW** -> If `src/videoGen.ts` throws an error or times out, gracefully fall back to existing Ken Burns FFmpeg animation.
   - Step 6: Mux the `.mp4` video clip with the `.wav` audio track using FFmpeg (`-stream_loop -1` and `-shortest` to match audio duration).

---

## 3. Execution Roadmap

### Step 1: Install Dependencies
Install the official Gradio client for Node.js to interact with free Hugging Face Spaces:
```bash
npm install @gradio/client
```

### Step 2: Create `src/videoGen.ts`
Implement `src/videoGen.ts` to export `generateSceneVideo(imagePath: string, outputPath: string, motionPrompt?: string): Promise<string>`.

Use `@gradio/client` to connect to `"multimodalart/stable-video-diffusion"`.

Implement a 45-second timeout controller around the API call so public queue delays never hang the automated pipeline.

If the endpoint errors or times out, throw an exception so the orchestrator can catch it and run the fallback.

### Step 3: Add `muxSceneVideoWithAudio` to `src/stitch.ts`
Export a helper function `muxSceneVideoWithAudio(videoClipPath: string, audioPath: string, outputScenePath: string): Promise<void>`.

Use ffmpeg with `-stream_loop -1` (to loop short AI clips if voiceovers are longer) and `-shortest` (to terminate output when audio finishes).

### Step 4: Refactor `src/index.ts`
Wrap the scene video generation step in a try/catch block:
- **Try**: Call `generateSceneVideo()` -> then `muxSceneVideoWithAudio()`.
- **Catch**: Log a warning -> fallback to existing `animateImage` Ken Burns + `muxSceneAudio`.

---

## 4. Verification & Testing Instructions
1. Run `npx tsc --noEmit` to ensure zero TypeScript compilation errors.
2. Test dry run / single channel test.
