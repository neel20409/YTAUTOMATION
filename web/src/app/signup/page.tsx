"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button, Card, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-signal" aria-hidden />
        <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-dim">
          Production Desk
        </span>
      </div>

      <Card className="w-full max-w-sm p-8">
        <h1 className="font-display text-2xl font-semibold text-paper">Set up your desk</h1>
        <p className="mt-1 text-sm text-dim">One account, as many channels as you run.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="text-xs text-dim">At least 8 characters.</span>
          </Field>

          {error && (
            <p className="rounded-lg border border-fault/40 bg-fault-dim/40 px-3 py-2 text-sm text-fault">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-dim">
        Already set up?{" "}
        <Link href="/login" className="font-medium text-paper underline underline-offset-4 hover:text-signal">
          Log in
        </Link>
      </p>
    </main>
  );
}
