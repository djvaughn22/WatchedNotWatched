"use client";

// Email list signup. Renders nothing until /api/subscribe says it's
// configured, and nothing ever again on this device once you're on the list
// (wnw.email.v1). One input, one button, no modal, no nag.

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

const DONE_KEY = "wnw.email.v1";

export default function EmailSignup() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DONE_KEY)) return;
    } catch {
      /* storage blocked — still offer the form */
    }
    const controller = new AbortController();
    fetch("/api/subscribe", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => {
        if (data.enabled) setShow(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!show) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending" || state === "done") return;
    setState("sending");
    fetch("/api/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean }) => {
        if (data.ok) {
          setState("done");
          track("email_subscribed");
          try {
            window.localStorage.setItem(DONE_KEY, new Date().toISOString());
          } catch {
            /* ignore */
          }
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  };

  return (
    <section className="border-t border-[#26324c] py-6">
      <h2 className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Get updates</h2>
      {state === "done" ? (
        <p className="mt-2.5 text-sm font-bold text-[#e8edf5]">
          You&apos;re on the list <span className="text-[#22D3EE]">✓</span>
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#64748b]">
            One email when something new ships. No spam, unsubscribe anytime.
          </p>
          <form onSubmit={submit} className="mt-2.5 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              className="min-w-0 flex-1 rounded-full border border-[#26324c] bg-[#141d2e] px-4 py-2 text-sm text-[#e8edf5] placeholder-[#64748b] outline-none focus:border-[#22D3EE]"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="shrink-0 rounded-full bg-[#22D3EE] px-4 py-2 text-sm font-black text-[#06131a] transition-opacity disabled:opacity-60"
            >
              {state === "sending" ? "Signing up…" : "Sign up"}
            </button>
          </form>
          {state === "error" && (
            <p className="mt-2 text-xs text-[#94a3b8]">That didn&apos;t go through. Try again in a moment.</p>
          )}
        </>
      )}
    </section>
  );
}
