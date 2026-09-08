"use client";

// Book cover with a real fallback chain: Open Library cover id → ISBN cover →
// a polished placeholder showing the title and author. `?default=false` on
// every Open Library cover URL (see lib/media/openlibrary.ts) makes a missing
// cover 404 instead of silently rendering Open Library's own generic icon, so
// onError below can reliably detect it and swap in ours — never a broken
// image icon.

import { useState } from "react";
import { isbnCoverUrl } from "@/lib/media/openlibrary";

function initials(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || "📚";
}

function Placeholder({ title, author, className }: { title: string; author?: string; className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#1c2740] to-[#0e1626] p-3 text-center ${className ?? ""}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#22D3EE]/15 text-sm font-black text-[#22D3EE]" aria-hidden>
        {initials(title)}
      </span>
      <span className="line-clamp-3 text-xs font-bold leading-snug text-[#e8edf5]">{title}</span>
      {author && <span className="line-clamp-1 text-[10px] text-[#64748b]">{author}</span>}
    </div>
  );
}

export default function BookCover({
  title,
  author,
  coverUrl,
  isbn,
  className,
}: {
  title: string;
  author?: string;
  coverUrl?: string;
  isbn?: string;
  className?: string;
}) {
  // Fallback chain: given cover → ISBN cover → placeholder.
  const chain = [coverUrl, isbn ? isbnCoverUrl(isbn) : undefined].filter((u): u is string => !!u);
  const [step, setStep] = useState(0);
  const src = chain[step];

  if (!src) return <Placeholder title={title} author={author} className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${title} cover`}
      loading="lazy"
      className={`h-full w-full object-cover ${className ?? ""}`}
      onError={() => setStep((s) => s + 1)}
    />
  );
}
