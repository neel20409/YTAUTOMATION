import { writeFile } from "node:fs/promises";
import "dotenv/config";

async function testHuggingFaceModels() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const prompt = "A majestic ancient Indian temple at sunset, photorealistic documentary style";
  const candidateModels = [
    "stabilityai/stable-diffusion-3.5-large",
    "ByteDance/SDXL-Lightning",
    "black-forest-labs/FLUX.1-dev",
    "segmind/SSD-1B",
  ];

  for (const model of candidateModels) {
    const url = `https://router.huggingface.co/hf-inference/models/${model}`;
    console.log(`\nTesting HF Model: ${model}`);
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      });

      console.log("Status:", response.status, response.statusText);
      console.log("Content-Type:", response.headers.get("content-type"));
      const buf = Buffer.from(await response.arrayBuffer());
      console.log("Buffer size:", buf.length);
      const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
      console.log("Is Valid Image:", isJpeg || isPng);
      if (isJpeg || isPng) {
        console.log(`🎉 SUCCESSFUL IMAGE GENERATION WITH HF MODEL: ${model}`);
        await writeFile("scratch/hf_success.jpg", buf);
        return model;
      } else {
        console.log("Response snippet:", buf.slice(0, 200).toString());
      }
    } catch (e: any) {
      console.error("HF Error:", e.message);
    }
  }
}

testHuggingFaceModels();
