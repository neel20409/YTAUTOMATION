import { writeFile } from "node:fs/promises";

async function testPollinations() {
  const prompt = encodeURIComponent("A majestic sunset over ancient Indian temple");
  const urls = [
    `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=720&nologo=true`,
    `https://pollinations.ai/p/${prompt}?width=1280&height=720&nologo=true`,
    `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=720&model=flux&nologo=true`,
  ];

  for (const url of urls) {
    console.log("\nTesting URL:", url);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      console.log("Status:", res.status, res.statusText);
      console.log("Content-Type:", res.headers.get("content-type"));
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("Buffer size:", buf.length, "bytes");
      if (buf.length > 0) {
        console.log("Header snippet:", buf.slice(0, 50).toString());
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testPollinations();
