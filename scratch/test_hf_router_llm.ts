import "dotenv/config";

async function testHfRouterLlm() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const models = [
    "Qwen/Qwen2.5-72B-Instruct",
    "meta-llama/Llama-3.2-3B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
  ];

  for (const m of models) {
    console.log(`\nTesting model: ${m}`);
    const url = `https://router.huggingface.co/hf-inference/models/${m}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: "Hello, write a short 1-line video script.",
          parameters: { max_new_tokens: 50 },
        }),
      });

      console.log("Status:", res.status, res.statusText);
      console.log("Content-Type:", res.headers.get("content-type"));
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

testHfRouterLlm();
