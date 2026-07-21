"use client";

import { useState } from "react";
import {
  liveDestinations,
  type DestinationCardContent,
  type ProjectDestination,
} from "../../lib/destinations";

// ─────────────────────────────────────────────────────────────────────────────
// AboutDestinationCard — the one quiet destination container for the lower
// part of the About page. Generic by design: it renders whatever configured
// content it is given; nothing site- or destination-specific may be
// hard-coded here (configuration lives in src/lib/destinations.ts).
//
// Share behavior: native Web Share first; a canceled share is quiet, never an
// error. Fallback copies the message and link; if copying is blocked the
// address itself is shown, so an action always works. Results are announced
// through an aria-live region.
// ─────────────────────────────────────────────────────────────────────────────

function isShareCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "AbortError" || name === "NotAllowedError";
}

function DestinationLink({
  destination,
  primary,
}: {
  destination: ProjectDestination;
  primary: boolean;
}) {
  const cls = primary
    ? "inline-flex min-h-11 items-center rounded-full bg-[#22D3EE] px-5 py-2.5 text-sm font-black text-[#0b1220] transition hover:opacity-90"
    : "inline-flex min-h-11 items-center px-1 text-sm font-bold text-[#22D3EE] hover:underline";
  return (
    <a
      href={destination.href}
      {...(destination.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className={cls}
    >
      <span className="min-w-0 break-words">{destination.label}</span>
    </a>
  );
}

export default function AboutDestinationCard({
  card,
}: {
  card: DestinationCardContent;
}) {
  const [status, setStatus] = useState("");
  const destinations = liveDestinations(card.destinations);
  if (destinations.length === 0) return null;
  const [primary, ...secondary] = destinations;

  async function onShare() {
    const share = card.share;
    if (!share) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: share.title,
          text: share.text,
          url: share.url,
        });
        setStatus("");
        return;
      } catch (error) {
        // Backing out of the native share sheet is a choice, not a failure.
        if (isShareCancel(error)) return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${share.text}\n${share.url}`);
      setStatus("Copied — paste it anywhere.");
    } catch {
      setStatus(`Copying is blocked here. The address is ${share.url}`);
    }
  }

  return (
    <section
      aria-label={card.heading}
      className="rounded-2xl border border-[#26324c] bg-[#141d2e] p-5"
    >
      {card.eyebrow && (
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22D3EE]">
          {card.emblem && (
            <span aria-hidden className="mr-2">
              {card.emblem}
            </span>
          )}
          {card.eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-lg font-bold text-[#e8edf5]">{card.heading}</h2>
      {card.body.map((line) => (
        <p
          key={line}
          className="mt-3 text-pretty text-[15px] leading-relaxed text-[#94a3b8]"
        >
          {line}
        </p>
      ))}
      {card.closing && (
        <p className="mt-3 text-[15px] font-bold leading-relaxed text-[#e8edf5]">
          {card.closing}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <DestinationLink destination={primary} primary />
        {card.share && (
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-11 items-center rounded-full border border-[#26324c] bg-[#0b1220] px-5 py-2.5 text-sm font-black text-[#e8edf5] transition hover:bg-[#1c2740]"
          >
            {card.share.label}
          </button>
        )}
        {secondary.map((d) => (
          <DestinationLink key={d.href} destination={d} primary={false} />
        ))}
      </div>
      <p
        aria-live="polite"
        role="status"
        className="mt-3 min-h-5 text-sm text-[#94a3b8]"
      >
        {status}
      </p>
      {card.attribution && (
        <p className="mt-1 text-xs text-[#64748b]">{card.attribution}</p>
      )}
    </section>
  );
}
