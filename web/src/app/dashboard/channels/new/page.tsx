"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

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
      window.location.href = `/api/youtube/connect?channelId=${data.channel.id}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/dashboard" className="text-sm text-dim hover:text-paper">
          ← Back to channels
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">Add a channel</h1>
        <p className="mt-1 text-sm text-dim">
          Describe the persona once - every script and image prompt is generated from this.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Channel name">
            <Input
              required
              placeholder="e.g. Heritage Unfolded"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Language">
              <Input required value={form.language} onChange={(e) => update("language", e.target.value)} />
            </Field>
            <Field label="Format">
              <Select value={form.aspectRatio} onChange={(e) => update("aspectRatio", e.target.value)}>
                <option value="WIDE">16:9 · Long-form</option>
                <option value="TALL">9:16 · Shorts</option>
              </Select>
            </Field>
          </div>

          <Field label="Scenes per video">
            <Input
              type="number"
              min={2}
              max={12}
              value={form.sceneCount}
              onChange={(e) => update("sceneCount", Number(e.target.value))}
            />
          </Field>

          <Field label="Topic niche">
            <Textarea
              required
              rows={2}
              placeholder="e.g. Indian history for a Hindi-speaking audience - ancient and medieval empires, rulers, and turning points"
              value={form.topicNiche}
              onChange={(e) => update("topicNiche", e.target.value)}
            />
          </Field>

          <Field label="Image style direction">
            <Textarea
              required
              rows={2}
              placeholder="e.g. Photorealistic, like a still from a documentary - natural cinematic lighting, authentic period detail"
              value={form.imageStyle}
              onChange={(e) => update("imageStyle", e.target.value)}
            />
          </Field>

          <Field label="Image accuracy anchor">
            <Textarea
              required
              rows={2}
              placeholder="Guardrail text appended to every image prompt to keep subjects and setting on target"
              value={form.imageAccuracyAnchor}
              onChange={(e) => update("imageAccuracyAnchor", e.target.value)}
            />
          </Field>

          <Field label="TTS voice">
            <Input required value={form.ttsVoice} onChange={(e) => update("ttsVoice", e.target.value)} />
          </Field>

          {error && (
            <p className="rounded-lg border border-fault/40 bg-fault-dim/40 px-3 py-2 text-sm text-fault">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Creating…" : "Continue to connect YouTube"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
