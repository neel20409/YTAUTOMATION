"use client";

import { useState } from "react";

export default function NewChannelPage() {
  const [form, setForm] = useState({
    displayName: "",
    language: "English",
    aspectRatio: "WIDE",
    sceneCount: 6,
    topicNiche: "",
    imageStyle: "",
    imageAccuracyAnchor: "",
    ttsVoice: "Kore",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      // Hand off to the YouTube OAuth connect flow for this new channel.
      window.location.href = `/api/youtube/connect?channelId=${data.channel.id}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Add a channel</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Channel name
          <input
            required
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Language
          <input
            required
            value={form.language}
            onChange={(e) => update("language", e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Format
          <select
            value={form.aspectRatio}
            onChange={(e) => update("aspectRatio", e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="WIDE">16:9 (long-form)</option>
            <option value="TALL">9:16 (Shorts)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Scenes per video
          <input
            type="number"
            min={2}
            max={12}
            value={form.sceneCount}
            onChange={(e) => update("sceneCount", Number(e.target.value))}
            className="rounded border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Topic niche
          <textarea
            required
            placeholder="e.g. Indian history for a Hindi-speaking audience - ancient and medieval empires, rulers, battles, and turning points"
            value={form.topicNiche}
            onChange={(e) => update("topicNiche", e.target.value)}
            className="rounded border px-3 py-2"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Image style direction
          <textarea
            required
            placeholder="e.g. Photorealistic, like a still from a documentary - natural cinematic lighting, authentic period detail"
            value={form.imageStyle}
            onChange={(e) => update("imageStyle", e.target.value)}
            className="rounded border px-3 py-2"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Image accuracy anchor
          <textarea
            required
            placeholder="Guardrail text appended to every image prompt to keep subjects/setting on-target"
            value={form.imageAccuracyAnchor}
            onChange={(e) => update("imageAccuracyAnchor", e.target.value)}
            className="rounded border px-3 py-2"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          TTS voice
          <input
            required
            value={form.ttsVoice}
            onChange={(e) => update("ttsVoice", e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {loading ? "Creating..." : "Continue to connect YouTube"}
        </button>
      </form>
    </main>
  );
}
