"use client";

import { useState } from "react";

export function SubscribeButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Something went wrong starting checkout.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
    >
      {loading ? "Redirecting..." : "Subscribe"}
    </button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Something went wrong opening the billing portal.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded border px-4 py-2 disabled:opacity-50"
    >
      {loading ? "Redirecting..." : "Manage billing"}
    </button>
  );
}
