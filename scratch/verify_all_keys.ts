import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

// Extract helper directly to test
function getGrokApiKeys(): string[] {
  const keys: string[] = [];
  const mainEnvs = [
    process.env.GROK_KEYS,
    process.env.GROK_API_KEY,
    process.env.GROK_KEY,
    process.env.XAI_KEYS,
    process.env.XAI_API_KEY,
    process.env.XAI_KEY,
  ];

  for (const mainEnv of mainEnvs) {
    if (mainEnv) {
      const parts = mainEnv.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
      keys.push(...parts);
    }
  }

  for (let i = 1; i <= 10; i++) {
    const candidates = [
      process.env[`GROK_API_KEY${i}`],
      process.env[`GROK_API_KEY_${i}`],
      process.env[`GROK_KEY${i}`],
      process.env[`GROK_KEY_${i}`],
      process.env[`XAI_API_KEY${i}`],
      process.env[`XAI_API_KEY_${i}`],
      process.env[`XAI_KEY${i}`],
      process.env[`XAI_KEY_${i}`],
    ];

    for (const cand of candidates) {
      if (cand && cand.trim()) {
        keys.push(cand.trim());
      }
    }
  }

  return Array.from(new Set(keys));
}

function getManusApiKeys(): string[] {
  const keys: string[] = [];
  const mainEnvs = [
    process.env.MANUS_KEYS,
    process.env.MANUS_API_KEY,
    process.env.MANUS_KEY,
  ];

  for (const mainEnv of mainEnvs) {
    if (mainEnv) {
      const parts = mainEnv.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
      keys.push(...parts);
    }
  }

  for (let i = 1; i <= 10; i++) {
    const candidates = [
      process.env[`MANUS_API_KEY${i}`],
      process.env[`MANUS_API_KEY_${i}`],
      process.env[`MANUS_KEY${i}`],
      process.env[`MANUS_KEY_${i}`],
    ];

    for (const cand of candidates) {
      if (cand && cand.trim()) {
        keys.push(cand.trim());
      }
    }
  }

  return Array.from(new Set(keys));
}

async function verifyAllKeys() {
  console.log("==================================================");
  console.log("🔍 [Pipeline Key Verification Check]");
  console.log("==================================================");

  const grokKeys = getGrokApiKeys();
  const manusKeys = getManusApiKeys();

  console.log(`\n📌 Detected Grok Keys (${grokKeys.length}):`);
  grokKeys.forEach((key, idx) => {
    console.log(`  - Key ${idx + 1}: ${key.substring(0, 8)}...${key.substring(key.length - 4)}`);
  });

  console.log(`\n📌 Detected Manus Keys (${manusKeys.length}):`);
  manusKeys.forEach((key, idx) => {
    console.log(`  - Key ${idx + 1}: ${key.substring(0, 8)}...${key.substring(key.length - 4)}`);
  });

  console.log("\n📡 Testing Grok Key #1...");
  if (grokKeys.length > 0) {
    try {
      const res = await fetch("https://api.x.ai/v1/videos/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${grokKeys[0]}`,
        },
        body: JSON.stringify({
          model: "grok-imagine-video-1.5",
          prompt: "test animation",
          duration: 1,
        }),
      });
      const data = await res.json();
      console.log(`  Grok Key #1 HTTP ${res.status}:`, data?.error || data?.message || data?.request_id || JSON.stringify(data));
    } catch (e: any) {
      console.log(`  Grok Key #1 error:`, e.message || e);
    }
  }

  if (grokKeys.length > 1) {
    console.log("\n📡 Testing Grok Key #2...");
    try {
      const res = await fetch("https://api.x.ai/v1/videos/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${grokKeys[1]}`,
        },
        body: JSON.stringify({
          model: "grok-imagine-video-1.5",
          prompt: "test animation",
          duration: 1,
        }),
      });
      const data = await res.json();
      console.log(`  Grok Key #2 HTTP ${res.status}:`, data?.error || data?.message || data?.request_id || JSON.stringify(data));
    } catch (e: any) {
      console.log(`  Grok Key #2 error:`, e.message || e);
    }
  }

  console.log("\n📡 Testing Manus Key #1...");
  if (manusKeys.length > 0) {
    try {
      const res = await fetch("https://api.manus.ai/v2/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-manus-api-key": manusKeys[0],
          "API_KEY": manusKeys[0],
          "Authorization": `Bearer ${manusKeys[0]}`,
        },
        body: JSON.stringify({
          prompt: "test task",
        }),
      });
      const data = await res.json();
      console.log(`  Manus Key #1 HTTP ${res.status}:`, data?.error || data?.message || data?.task_id || JSON.stringify(data));
    } catch (e: any) {
      console.log(`  Manus Key #1 error:`, e.message || e);
    }
  }


  console.log("\n==================================================");
  console.log("✅ Verification check finished.");
  console.log("==================================================");
}

verifyAllKeys();
