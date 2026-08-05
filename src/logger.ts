import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const LOG_DIR = path.resolve("logs");
let logFilePath: string | null = null;

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ""}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function writeLine(level: string, args: unknown[]): void {
  if (!logFilePath) return;
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(formatArg).join(" ")}\n`;
  appendFileSync(logFilePath, line);
}

/**
 * Tees console.log/warn/error to a per-run file under logs/ so a run that dies mid-pipeline
 * leaves a readable trail instead of only the partial tmp/ files it happened to write before
 * dying (previously the only way to reconstruct what failed was diffing tmp/ output by hand).
 */
export function initRunLogger(runName: string): string {
  mkdirSync(LOG_DIR, { recursive: true });
  const safeName = runName.replace(/[^a-z0-9_-]+/gi, "_");
  logFilePath = path.join(LOG_DIR, `${safeName}.log`);

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    writeLine("LOG", args);
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    writeLine("WARN", args);
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    writeLine("ERROR", args);
  };

  return logFilePath;
}
