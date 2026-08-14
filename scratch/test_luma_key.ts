import dotenv from "dotenv";
dotenv.config();

async function checkLumaKey() {
  const apiKey = (process.env.LUMAAI_API_KEY || process.env.LUMA_API_KEY || "").trim();
  
  console.log("Checking API key in .env...");
  console.log(`Key prefix: ${apiKey.slice(0, 12)}... Length: ${apiKey.length}`);

  // Test 1: Luma AI Dream Machine API (Bearer token)
  try {
    const res1 = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    });
    console.log(`[Luma AI Dream Machine API] Status: ${res1.status} - ${await res1.text()}`);
  } catch (e: any) {
    console.log(`[Luma AI Dream Machine API] Error: ${e.message}`);
  }
}

checkLumaKey();
