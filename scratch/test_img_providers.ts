import { writeFile } from "node:fs/promises";

async function testModels() {
  const prompt = encodeURIComponent("Ancient Indian Temple Sunset");
  const models = ["turbo", "flux", "flux-realism", "flux-anime", "flux-3d"];

  for (const m of models) {
    const url = `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=720&model=${m}&nologo=true&seed=${Math.floor(Math.random()*10000)}`;
    console.log(`\nTesting model: ${m} -> ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
      });
      console.log("Status:", res.status, res.statusText);
      console.log("Content-Type:", res.headers.get("content-type"));
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("Buffer size:", buf.length);
      const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
      console.log("Is Valid Image:", isJpeg || isPng);
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testModels();
