import "dotenv/config";

async function callMiniMaxCloud(prompt: string) {
  const token = process.env.HF_TOKEN;
  console.log("Using HF_TOKEN:", token ? `${token.substring(0, 8)}...` : "Missing");

  const modelId = "2004Neel2004/MiniMax-H3-NVFP4-bucket";
  const url = `https://router.huggingface.co/hf-inference/models/${modelId}`;

  console.log(`📡 Sending cloud request to Hugging Face model: ${modelId}...`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
        },
      }),
    });

    console.log("Status:", response.status, response.statusText);
    console.log("Content-Type:", response.headers.get("content-type"));

    const data = await response.json();
    console.log("\n--- Cloud Response ---");
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error: any) {
    console.error("Cloud Request Error:", error.message || error);
  }
}

callMiniMaxCloud("Write a 2-sentence YouTube video introduction about ancient Indian history.");
