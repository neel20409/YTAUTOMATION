import { writeFile } from "node:fs/promises";

async function testPollinationsEndpoints() {
  const prompt = encodeURIComponent("A beautiful golden sunset over a peaceful forest");
  const candidates = [
    `https://genai.pollinations.ai/image/${prompt}?width=1280&height=720&nologo=true`,
    `https://genai.pollinations.ai/image/${prompt}?width=1280&height=720&model=flux`,
    `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=720&seed=123`,
    `https://image.pollinations.ai/prompt/${prompt}`,
    `https://pollinations.ai/p/${prompt}?width=1280&height=720`,
  ];

  for (const url of candidates) {
    console.log("\nTesting endpoint:", url);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/jpeg,image/png,image/*,*/*",
        },
      });
      console.log("Status:", res.status, res.statusText);
      console.log("Content-Type:", res.headers.get("content-type"));
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("Buffer size:", buf.length);
      const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
      console.log("Is Valid Image:", isJpeg || isPng);
      if (isJpeg || isPng) {
        console.log("🎉 SUCCESSFUL IMAGE FETCH FROM POLLINATIONS Endpoint!");
        await writeFile("scratch/pollinations_success.jpg", buf);
        break;
      } else {
        console.log("Snippet:", buf.slice(0, 150).toString());
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testPollinationsEndpoints();
