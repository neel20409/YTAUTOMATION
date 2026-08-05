import { writeFile } from "node:fs/promises";

async function testFallback() {
  const seed = Math.floor(Math.random() * 1000);
  const url = `https://picsum.photos/seed/${seed}/1280/720`;
  console.log("Testing fallback URL:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status, res.statusText);
    console.log("Content-Type:", res.headers.get("content-type"));
    const buf = Buffer.from(await res.arrayBuffer());
    console.log("Buffer length:", buf.length);
    await writeFile("scratch/fallback_test.jpg", buf);
    console.log("✅ Fallback image downloaded successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

testFallback();
