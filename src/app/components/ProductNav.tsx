"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/top", label: "Top 222" },
  { href: "/foryou", label: "For You" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
];

export default function ProductNav() {
  const pathname = usePathname() || "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav
      aria-label="WatchedNotWatched"
      className="sticky top-0 z-40 border-b border-[#26324c] bg-[#0b1220]/95 backdrop-blur"
    >
      {/* Quick-nav pills only — the header above already carries the site
          brand, so no second wordmark. Same 680px container so pills align. */}
      <div className="mx-auto flex max-w-[680px] items-center gap-1 overflow-x-auto px-4 py-2 sm:px-5">
        <div className="flex items-center gap-1">
          {LINKS.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive(l.href)
                  ? "bg-[#22D3EE] text-[#06131a]"
                  : "text-[#94a3b8] hover:bg-[#141d2e] hover:text-[#e8edf5]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
