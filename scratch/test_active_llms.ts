import "dotenv/config";

async function testActiveLlmModels() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const models = [
    "meta-llama/Meta-Llama-3-8B-Instruct",
    "microsoft/Phi-3-mini-4k-instruct",
    "google/gemma-2-9b-it",
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
  ];

  for (const m of models) {
    console.log(`\nTesting: ${m}`);
    const url = `https://router.huggingface.co/hf-inference/models/${m}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: "Hello, write a short 1-line script.",
          parameters: { max_new_tokens: 50 },
        }),
      });

      console.log("Status:", res.status, res.statusText);
      const text = await res.text();
      console.log("Response snippet:", text.slice(0, 200));
      if (res.ok) {
        console.log(`🎉 SUCCESS WITH HF ACTIVE SERVERLESS MODEL: ${m}`);
        break;
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testActiveLlmModels();
