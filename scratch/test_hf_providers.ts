import "dotenv/config";

async function testHfProviders() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  // HuggingFace's official serverless chat completion endpoint format:
  const url = "https://router.huggingface.co/v1/chat/completions";
  const models = [
    "Qwen/Qwen2.5-72B-Instruct",
    "meta-llama/Llama-3.3-70B-Instruct",
    "deepseek-ai/DeepSeek-V3",
  ];

  for (const model of models) {
    console.log(`\nTesting Router Endpoint for: ${model}`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi! Output valid JSON." }],
          max_tokens: 100,
        }),
      });

      console.log("Status:", res.status, res.statusText);
      const text = await res.text();
      console.log("Response:", text.slice(0, 300));
      if (res.ok) {
        console.log(`🎉 SUCCESSFUL HF SERVERLESS CHAT COMPLETION: ${model}`);
        break;
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testHfProviders();
