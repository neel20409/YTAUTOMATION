import dotenv from "dotenv";
import { fal } from "@fal-ai/client";
import { LumaAI } from "lumaai";

dotenv.config();

async function checkAllKeys() {
  console.log("==========================================");
  console.log("🔍 DIAGNOSTIC API KEY & CONNECTION TEST");
  console.log("==========================================\n");

  // 1. Check Luma API Keys
  const lumaKeys = getKeys("LUMAAI_API_KEY", "LUMA_API_KEY", "LUMAAI_API_KEYS");
  console.log(`📌 Luma AI Keys Found: ${lumaKeys.length}`);
  for (let i = 0; i < lumaKeys.length; i++) {
    const k = lumaKeys[i];
    console.log(`  └─ Key #${i + 1}: ${k.slice(0, 10)}... (${k.length} chars)`);
    try {
      const luma = new LumaAI({ authToken: k });
      const res = await luma.generations.list({ limit: 1 });
      console.log(`     ✅ Status: VALID & Authenticated! (Count: ${res.generations?.length ?? 0})`);
    } catch (e: any) {
      console.log(`     ❌ Status: Failed (${e?.message || e})`);
    }
  }

  console.log("\n------------------------------------------\n");

  // 2. Check fal.ai API Keys
  const falKeys = getKeys("FAL_KEY", "FAL_KEYS");
  console.log(`📌 fal.ai (Seedance 2.0) Keys Found: ${falKeys.length}`);
  for (let i = 0; i < falKeys.length; i++) {
    const k = falKeys[i];
    console.log(`  └─ Key #${i + 1}: ${k.slice(0, 10)}... (${k.length} chars)`);
    try {
      fal.config({ credentials: k });
      // Test key validity with a lightweight API ping / model info call
      const response = await fetch("https://rest.alpha.fal.ai/models", {
        headers: { Authorization: `Key ${k}` }
      });
      if (response.ok || response.status === 200 || response.status === 404) {
        console.log(`     ✅ Status: VALID & Authenticated! (HTTP ${response.status})`);
      } else {
        const txt = await response.text();
        console.log(`     ❌ Status: HTTP ${response.status} (${txt.slice(0, 100)})`);
      }
    } catch (e: any) {
      console.log(`     ❌ Status: Failed (${e?.message || e})`);
    }
  }

  console.log("\n==========================================");
}

function getKeys(...envVars: string[]): string[] {
  const keys: string[] = [];
  for (const envVar of envVars) {
    const val = process.env[envVar];
    if (val) {
      const parts = val.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
      keys.push(...parts);
    }
  }
  for (let i = 1; i <= 10; i++) {
    for (const prefix of ["LUMAAI_API_KEY_", "FAL_KEY_"]) {
      const indexedKey = process.env[`${prefix}${i}`];
      if (indexedKey && indexedKey.trim()) {
        keys.push(indexedKey.trim());
      }
    }
  }
  return Array.from(new Set(keys));
}

checkAllKeys();
