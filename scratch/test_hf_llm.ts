import "dotenv/config";

async function testHuggingFaceLLM() {
  const token = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!token);

  const models = [
    "Qwen/Qwen2.5-72B-Instruct",
    "meta-llama/Llama-3.2-3B-Instruct",
  ];

  for (const model of models) {
    console.log(`\n📡 Testing HuggingFace Serverless LLM: ${model}...`);
    try {
      const response = await fetch(
        `https://router.huggingface.co/hf-inference/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "You are a helpful scriptwriter. Output valid JSON.",
              },
              {
                role: "user",
                content: 'Write a JSON script for a 1-scene video about ancient history: { "videoTitle": "test", "scenes": [] }',
              },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        }
      );

      console.log("Status:", response.status, response.statusText);
      console.log("Content-Type:", response.headers.get("content-type"));
      const data = await response.json();
      console.log("Response:", JSON.stringify(data, null, 2).slice(0, 400));
      if (data?.choices?.[0]?.message?.content) {
        console.log(`🎉 SUCCESS WITH HF SERVERLESS LLM: ${model}`);
        return { model, content: data.choices[0].message.content };
      }
    } catch (e: any) {
      console.error("HF LLM Error:", e.message || e);
    }
  }
}

testHuggingFaceLLM();
