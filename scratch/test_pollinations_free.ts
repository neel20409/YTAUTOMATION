import fs from "node:fs";
import path from "node:path";

async function testPollinationsFree() {
  const prompts = [
    "Emperor Ashoka on an ancient Indian Mauryan throne, photorealistic historical documentary style",
    "Bloop and Boo fixing a broken craft table, colorful children storybook illustration",
    "Ancient Indian sandstone temple with intricate carvings at golden hour, travel documentary photograph",
  ];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=720&seed=${seed}&nologo=true`;

    console.log(`\n🎨 Requesting image ${i + 1}/${prompts.length}...`);
    try {
      const res = await fetch(url);
      console.log("Status:", res.status, res.statusText);
      console.log("Content-Type:", res.headers.get("content-type"));

      const buf = Buffer.from(await res.arrayBuffer());
      console.log("Buffer length:", buf.length);

      const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;

      if (isJpeg || isPng) {
        console.log("✅ PERFECT BINARY IMAGE RETURNED!");
        fs.mkdirSync("tmp/test_images", { recursive: true });
        const filePath = `tmp/test_images/test_${i}.jpg`;
        fs.writeFileSync(filePath, buf);
        console.log(`Saved to ${filePath}`);
      } else {
        console.log("❌ Non-image payload returned:", buf.slice(0, 100).toString());
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testPollinationsFree();
