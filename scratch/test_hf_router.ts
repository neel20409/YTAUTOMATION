import { writeFile } from "node:fs/promises";
import "dotenv/config";

async function testHuggingFaceRouter() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const prompt = "A majestic ancient Indian temple at sunset, photorealistic";
  const urls = [
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
  ];

  for (const url of urls) {
    console.log(`\nTesting HuggingFace URL: ${url}`);
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
        console.log(`✅ SUCCESS WITH HF URL: ${url}`);
        await writeFile("scratch/hf_success.jpg", buf);
        break;
      } else {
        console.log("Response snippet:", buf.slice(0, 300).toString());
      }
    } catch (e: any) {
      console.error("HF Error:", e.message);
    }
  }
}

testHuggingFaceRouter();
