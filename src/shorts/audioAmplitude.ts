import { readFile } from "node:fs/promises";

export interface MouthWindow {
  start: number; // seconds
  end: number; // seconds
  open: boolean;
}

const WINDOW_SECONDS = 0.09; // ~11 mouth-flap changes per second, reads as natural but simple
const OPEN_THRESHOLD_RATIO = 0.28; // fraction of peak RMS above which the mouth counts as "open"

/**
 * Reads a mono 16-bit PCM WAV file (Piper's output format) and derives coarse mouth open/closed
 * time windows from short-window RMS amplitude - a cheap stand-in for real lip-sync, driven by
 * how loud the voiceover is at each moment rather than actual phoneme shapes.
 */
export async function computeMouthWindows(wavPath: string): Promise<MouthWindow[]> {
  const buffer = await readFile(wavPath);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${wavPath} does not look like a valid WAV file`);
  }

  let sampleRate = 0;
  let bitsPerSample = 0;
  let channels = 0;
  let dataStart = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt ") {
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataLength = chunkSize;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart < 0 || sampleRate === 0 || bitsPerSample !== 16) {
    throw new Error(`${wavPath}: could not find a 16-bit PCM data chunk`);
  }

  const bytesPerSample = 2 * channels;
  const totalSamples = Math.floor(dataLength / bytesPerSample);
  const samplesPerWindow = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));

  const rmsPerWindow: number[] = [];
  for (let start = 0; start < totalSamples; start += samplesPerWindow) {
    const end = Math.min(start + samplesPerWindow, totalSamples);
    let sumSquares = 0;
    let count = 0;
    for (let i = start; i < end; i++) {
      const sampleOffset = dataStart + i * bytesPerSample;
      const sample = buffer.readInt16LE(sampleOffset);
      sumSquares += sample * sample;
      count++;
    }
    rmsPerWindow.push(count > 0 ? Math.sqrt(sumSquares / count) : 0);
  }

  const peakRms = Math.max(1, ...rmsPerWindow);
  const threshold = peakRms * OPEN_THRESHOLD_RATIO;

  const windows: MouthWindow[] = [];
  for (let i = 0; i < rmsPerWindow.length; i++) {
    const start = i * WINDOW_SECONDS;
    const end = start + WINDOW_SECONDS;
    const open = rmsPerWindow[i] > threshold;

    const prev = windows[windows.length - 1];
    if (prev && prev.open === open) {
      prev.end = end;
    } else {
      windows.push({ start, end, open });
    }
  }

  return windows;
}
