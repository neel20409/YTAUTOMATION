import "dotenv/config";

async function testImageModels() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const prompt = encodeURIComponent("Emperor Ashoka on an ancient Indian Mauryan throne, photorealistic documentary style");
  
  // Test Hugging Face spaces & router image endpoints
  const candidates = [
    { name: "HF Space FLUX.1-schnell", url: "https://black-forest-labs-flux-1-schnell.hf.space/api/predict" },
    { name: "Pollinations basic", url: `https://image.pollinations.ai/prompt/${prompt}?nologo=true` },
    { name: "Pollinations genai", url: `https://genai.pollinations.ai/image/${prompt}` },
  ];

  for (const c of candidates) {
    console.log(`\nTesting: ${c.name}`);
    try {
      const res = await fetch(c.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "image/jpeg,image/png,image/*,*/*",
        },
      });
      console.log("Status:", res.status, res.statusText);
      console.log("Content-Type:", res.headers.get("content-type"));
      const buf = Buffer.from(await res.arrayBuffer());
      console.log("Buffer length:", buf.length);
      const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
      console.log("Is Valid Image:", isJpeg || isPng);
      if (!isJpeg && !isPng) {
        console.log("Snippet:", buf.slice(0, 150).toString());
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testImageModels();
