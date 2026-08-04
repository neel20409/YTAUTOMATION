import { Client } from "@gradio/client";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const testImg = path.resolve("bloop_and_boo.png");
  if (!fs.existsSync(testImg)) return;

  const hfToken = process.env.HF_TOKEN;
  console.log("Connecting...");
  const client = await Client.connect("multimodalart/stable-video-diffusion", hfToken ? ({ token: hfToken } as any) : undefined);
  
  const imageBuffer = fs.readFileSync(testImg);
  const imageBlob = new Blob([imageBuffer]);

  console.log("Predicting...");
  const result = await client.predict("/video", [
    imageBlob,
    12345,
    true,
    127,
    12,
  ]);

  console.log("=== RAW RESULT DATA ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
