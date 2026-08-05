import "dotenv/config";

async function testHFLlmEndpoints() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const models = [
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "meta-llama/Llama-3.2-3B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "HuggingFaceH4/zephyr-7b-beta",
  ];

  for (const m of models) {
    console.log(`\nTesting model: ${m}`);
    const url = `https://api-inference.huggingface.co/models/${m}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: "<|system|>\nYou are a script writer.<|user|>\nWrite a 1-sentence intro.<|assistant|>",
          parameters: { max_new_tokens: 100 },
        }),
      });

      console.log("Status:", res.status, res.statusText);
      const text = await res.text();
      console.log("Response snippet:", text.slice(0, 250));
      if (res.ok) {
        console.log(`🎉 SUCCESSFUL FREE SERVERLESS LLM RESPONSE: ${m}`);
        break;
      }
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }
}

testHFLlmEndpoints();
