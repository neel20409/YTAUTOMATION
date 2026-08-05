import express from "express";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { spawn, exec, type ChildProcess } from "node:child_process";
import { CHANNELS, type ChannelId } from "./config.js";
import { addTopics } from "./topicQueue.js";

const app = express();
const PORT = process.env.PORT || 3000;
const TOPICS_PATH = path.resolve("data/topics.json");

app.use(express.json());
app.use(express.static(path.resolve("public")));

function readTopicsFile() {
  try {
    const raw = readFileSync(TOPICS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return { bharatkaal: [], heritage_unfolded: [], bloop_and_boo: [] };
  }
}

function writeTopicsFile(data: any) {
  writeFileSync(TOPICS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// 1. Get all channels metadata and topics
app.get("/api/topics", (req, res) => {
  const topics = readTopicsFile();
  res.json({
    channels: CHANNELS,
    topics,
  });
});

// 2. Add custom topic
app.post("/api/topics/add", (req, res) => {
  const { channelId, title } = req.body;
  if (!channelId || !title || !CHANNELS[channelId as ChannelId]) {
    res.status(400).json({ error: "Invalid channelId or title" });
    return;
  }
  const channel = CHANNELS[channelId as ChannelId];
  addTopics(channelId as ChannelId, channel.language, [{ title }]);
  res.json({ success: true, topics: readTopicsFile() });
});

// 3. Delete a topic
app.post("/api/topics/delete", (req, res) => {
  const { channelId, topicId } = req.body;
  const topics = readTopicsFile();
  if (topics[channelId]) {
    topics[channelId] = topics[channelId].filter((t: any) => t.id !== topicId);
    writeTopicsFile(topics);
  }
  res.json({ success: true, topics: readTopicsFile() });
});

// 4. Toggle or set topic status ("pending" <-> "done")
app.post("/api/topics/status", (req, res) => {
  const { channelId, topicId, status } = req.body;
  const topics = readTopicsFile();
  if (topics[channelId]) {
    const topic = topics[channelId].find((t: any) => t.id === topicId);
    if (topic) {
      topic.status = status;
      writeTopicsFile(topics);
    }
  }
  res.json({ success: true, topics: readTopicsFile() });
});

let activeChildProcess: ChildProcess | null = null;

function killActiveProcess() {
  if (activeChildProcess && activeChildProcess.pid) {
    try {
      if (process.platform === "win32") {
        exec(`taskkill /pid ${activeChildProcess.pid} /T /F`);
      } else {
        activeChildProcess.kill("SIGKILL");
      }
    } catch (e) {
      console.error("Failed to kill process:", e);
    }
    activeChildProcess = null;
  }
}

// 5. Endpoint to stop any currently running background command
app.post("/api/run-stop", (req, res) => {
  if (activeChildProcess) {
    killActiveProcess();
    res.json({ success: true, message: "Running process stopped by user." });
  } else {
    res.json({ success: true, message: "No active process running." });
  }
});

// 6. SSE stream endpoint to execute topup or pipeline with live console logs
app.get("/api/run-stream", (req, res) => {
  const action = req.query.action as string; // "topup" or "pipeline"
  const channel = (req.query.channel as string) || "all";

  // If a command is already running, terminate it before starting a new one
  killActiveProcess();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: "start", action, channel });

  const env = { ...process.env };
  if (channel !== "all") {
    env.CHANNEL = channel;
  } else {
    env.CHANNEL = "all";
  }

  let args: string[] = [];
  if (action === "topup") {
    args = ["tsx", "src/topUpTopics.ts"];
    if (channel === "all") args.push("--all");
  } else if (action === "pipeline") {
    args = ["tsx", "src/index.ts"];
    if (channel === "all") args.push("--all");
  } else {
    sendEvent({ type: "error", message: "Invalid action" });
    res.end();
    return;
  }

  const child = spawn("npx", args, {
    cwd: process.cwd(),
    env,
    shell: true,
  });

  activeChildProcess = child;

  child.stdout.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) sendEvent({ type: "log", text: line });
    }
  });

  child.stderr.on("data", (chunk) => {
    const lines = chunk.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) sendEvent({ type: "log", text: `[stderr] ${line}` });
    }
  });

  child.on("close", (code) => {
    activeChildProcess = null;
    sendEvent({ type: "done", code, success: code === 0 });
    res.end();
  });

  child.on("error", (err) => {
    activeChildProcess = null;
    sendEvent({ type: "error", message: err.message });
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`\n🎉 YouTube Automation Dashboard is live at: http://localhost:${PORT}`);
});
