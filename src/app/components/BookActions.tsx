"use client";

// "Get this book" — the library-first action order the mission requires:
// 1. Read free / Borrow (only when Open Library's own availability says so)
// 2. Find at my library (Libby/OverDrive, device-local setup, no credentials)
// 3. Buy on Amazon
// 4. Search Audible (never "listen now" — no edition is ever verified)
// Free/library options get the strongest visual weight; Amazon/Audible read
// as clearly commercial, secondary alternatives — never "required."

import { useEffect, useState } from "react";
import type { BookAvailability } from "@/lib/media/openlibrary";
import { AMAZON_DISCLOSURE, amazonStorefrontLink, buildAmazonBookLink, buildAudibleLink } from "@/lib/media/bookRetailers";
import {
  buildLibrarySearchIntent,
  clearReaderLibrary,
  isSafeLibraryUrl,
  LIBBY_APP_URL,
  OVERDRIVE_FIND_LIBRARY_URL,
  readReaderLibrary,
  saveReaderLibrary,
  type ReaderLibrary,
} from "@/lib/media/librarySetup";
import { track } from "@/lib/analytics";

const CARD = "rounded-2xl border border-[#26324c] bg-[#141d2e] p-4";
const PRIMARY_BTN =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-[#22D3EE] px-4 py-3 text-sm font-black text-[#06131a] transition hover:opacity-90";
const SECONDARY_BTN =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#26324c] px-4 py-3 text-sm font-bold text-[#e8edf5] transition hover:border-[#22D3EE]";

function outboundClick(label: string) {
  track("book_action_click", { label });
}

function ReadFreeCard({ availability }: { availability: BookAvailability }) {
  if (availability.readable) {
    return (
      <div className={CARD}>
        <p className="text-xs font-black uppercase tracking-wide text-[#22D3EE]">Read free</p>
        <a
          href={availability.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => outboundClick("read_free")}
          className={`${PRIMARY_BTN} mt-2`}
        >
          <span>📖 Read free on Open Library</span>
          <span>→</span>
        </a>
      </div>
    );
  }
  if (availability.borrowable || availability.waitlisted) {
    return (
      <div className={CARD}>
        <p className="text-xs font-black uppercase tracking-wide text-[#22D3EE]">Borrow free</p>
        <a
          href={availability.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => outboundClick("borrow_free")}
          className={`${PRIMARY_BTN} mt-2`}
        >
          <span>📚 {availability.borrowable ? "Borrow on Open Library" : "Join the waitlist on Open Library"}</span>
          <span>→</span>
        </a>
        {availability.waitlisted && (
          <p className="mt-2 text-xs text-[#94a3b8]">Every copy is checked out right now — you can join the waitlist.</p>
        )}
      </div>
    );
  }
  return null;
}

function LibrarySetupCard({ book }: { book: { isbn?: string; title: string; creators?: string[] } }) {
  const [lib, setLib] = useState<ReaderLibrary | null>(null);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLib(readReaderLibrary());
  }, []);

  const save = () => {
    if (!isSafeLibraryUrl(url.trim())) {
      setUrlError("That doesn't look like an OverDrive or Libby library link. Paste your library's collection URL.");
      return;
    }
    const next: ReaderLibrary = { label: label.trim() || "My library", collectionUrl: url.trim() };
    if (saveReaderLibrary(next)) {
      setLib(next);
      setEditing(false);
      setUrlError("");
      track("library_setup_saved");
    }
  };

  const reset = () => {
    clearReaderLibrary();
    setLib(null);
    setEditing(false);
    track("library_setup_cleared");
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={CARD}>
      <p className="text-xs font-black uppercase tracking-wide text-[#22D3EE]">Find at my library</p>

      {lib && !editing ? (
        (() => {
          const intent = buildLibrarySearchIntent(lib, book);
          return (
            <>
              <a
                href={intent.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => outboundClick("library_search")}
                className={`${PRIMARY_BTN} mt-2`}
              >
                <span>🏛️ Search {lib.label}</span>
                <span>→</span>
              </a>
              <p className="mt-2 text-xs text-[#94a3b8]">
                {intent.isDeepLink
                  ? "If that doesn't land on a search, paste this into your library's search box:"
                  : "Paste this into your library's search box:"}
              </p>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#26324c] bg-[#0b1220] px-3 py-2">
                <code className="flex-1 truncate text-xs text-[#e8edf5]">{intent.copyText}</code>
                <button onClick={() => copy(intent.copyText)} className="shrink-0 text-xs font-bold text-[#22D3EE]">
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-3 flex gap-4">
                <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#64748b] hover:text-[#94a3b8]">
                  Change my library
                </button>
                <button onClick={reset} className="text-xs font-semibold text-[#64748b] hover:text-[#94a3b8]">
                  Remove my library
                </button>
              </div>
            </>
          );
        })()
      ) : (
        <>
          <p className="mt-2 text-sm text-[#94a3b8]">
            Libby is the free app for borrowing ebooks and audiobooks from your public library. Find your library once,
            and every book page can search it directly.
          </p>
          <a
            href={OVERDRIVE_FIND_LIBRARY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-semibold text-[#22D3EE] hover:underline"
          >
            Find your library on OverDrive →
          </a>
          <p className="mt-1">
            <a href={LIBBY_APP_URL} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#94a3b8] hover:text-[#e8edf5]">
              Get the Libby app →
            </a>
          </p>

          <div className="mt-3 space-y-2 border-t border-[#26324c] pt-3">
            <p className="text-xs font-bold text-[#e8edf5]">Set up my library</p>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Library name (e.g. Chicago Public Library)"
              className="w-full rounded-lg border border-[#26324c] bg-[#0b1220] px-3 py-2 text-sm text-[#e8edf5] outline-none placeholder:text-[#64748b] focus:border-[#22D3EE]"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError("");
              }}
              placeholder="Paste your library's OverDrive/Libby collection link"
              className="w-full rounded-lg border border-[#26324c] bg-[#0b1220] px-3 py-2 text-sm text-[#e8edf5] outline-none placeholder:text-[#64748b] focus:border-[#22D3EE]"
            />
            {urlError && <p className="text-xs text-[#f87171]">{urlError}</p>}
            <button onClick={save} disabled={!url.trim()} className="min-h-11 w-full rounded-xl bg-[#22D3EE] px-4 text-sm font-black text-[#06131a] disabled:opacity-40">
              Save my library
            </button>
            <p className="text-[10px] leading-relaxed text-[#64748b]">
              We only save this link on this device. We never ask for your library card number, PIN, password, or borrowing history —
              Libby handles all of that itself, directly with your library.
            </p>
          </div>
          {editing && (
            <button onClick={reset} className="mt-2 text-xs font-semibold text-[#64748b] hover:text-[#94a3b8]">
              Remove saved library
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function BookActions({
  book,
  availability,
}: {
  book: { isbn?: string; title: string; creators?: string[] };
  availability: BookAvailability | null;
}) {
  const amazon = buildAmazonBookLink(book);
  const storefront = amazonStorefrontLink();
  const audible = buildAudibleLink(book);

  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-sm font-bold text-[#e8edf5]">Get this book</h2>

      {availability && <ReadFreeCard availability={availability} />}

      <LibrarySetupCard book={book} />

      <div className={CARD}>
        <p className="text-xs font-black uppercase tracking-wide text-[#94a3b8]">Buy or listen</p>
        <a
          href={amazon.url}
          target="_blank"
          rel="sponsored nofollow noopener"
          onClick={() => outboundClick("amazon")}
          className={`${SECONDARY_BTN} mt-2`}
        >
          <span>🛒 {amazon.label}</span>
          <span>→</span>
        </a>
        {storefront && (
          <a
            href={storefront.url}
            target="_blank"
            rel="sponsored nofollow noopener"
            onClick={() => outboundClick("amazon_storefront")}
            className={`${SECONDARY_BTN} mt-2`}
          >
            <span>🏪 {storefront.label}</span>
            <span>→</span>
          </a>
        )}
        <a
          href={audible.url}
          target="_blank"
          rel="sponsored nofollow noopener"
          onClick={() => outboundClick("audible")}
          className={`${SECONDARY_BTN} mt-2`}
        >
          <span>🎧 {audible.label}</span>
          <span>→</span>
        </a>
        <p className="mt-3 text-[10px] leading-relaxed text-[#64748b]">{AMAZON_DISCLOSURE}</p>
      </div>
    </section>
  );
}
