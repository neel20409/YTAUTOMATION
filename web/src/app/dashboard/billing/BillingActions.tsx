"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** Response bodies aren't guaranteed to be JSON (an unhandled server error can return an empty
 * or HTML body) - parse defensively so a redirect failure always shows the user something
 * instead of an uncaught promise rejection with no visible feedback. */
async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-fault/40 bg-fault-dim/40 px-3 py-2 text-sm text-fault">
      {message}
    </p>
  );
}

export function SubscribeButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "Couldn't start checkout - try again in a moment."));
        return;
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server - check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting…" : "Subscribe"}
      </Button>
      {error && <ErrorNote message={error} />}
    </div>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        setError(await parseErrorMessage(res, "Couldn't open billing - try again in a moment."));
        return;
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server - check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting…" : "Manage billing"}
      </Button>
      {error && <ErrorNote message={error} />}
    </div>
  );
}
