import fs from "node:fs";

async function testUrl(url: string, name: string) {
  console.log(`Testing ${name}: ${url}`);
  try {
    const res = await fetch(url);
    console.log(`  ${name} Status:`, res.status, res.statusText);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      fs.mkdirSync("tmp", { recursive: true });
      fs.writeFileSync(`tmp/${name}.jpg`, Buffer.from(buffer));
      console.log(`  ✅ Saved to tmp/${name}.jpg`);
      return true;
    }
  } catch (err: any) {
    console.log(`  ❌ ${name} Error:`, err.message);
  }
  return false;
}

async function main() {
  const prompt = encodeURIComponent("Emperor Ashoka ancient India sandstone palace cinematic 8k");
  await testUrl(`https://pollinations.ai/p/${prompt}?width=1280&height=720&model=flux`, "pollinations_p");
  await testUrl(`https://gen.pollinations.ai/image/${prompt}?width=1280&height=720&model=flux`, "gen_pollinations");
  await testUrl(`https://router.huggingface.co/hf-inference/v1/models/black-forest-labs/FLUX.1-schnell`, "hf_router");
}

main();
