// Native-canvas PNG cards of the library summary — same process as the
// CrossHeartPray / iDontCry share systems: no APIs, nothing auto-sent.
// Downloading an image also copies the text summary so a caption is ready.

import { entriesToSummary } from "./export";
import type { LibraryEntry } from "./library";

export type ShareImageSize = "square" | "portrait";

const SIZES: Record<ShareImageSize, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

// Family palette (flat, no gradients, no red).
const BG = "#0b1220";
const BORDER = "#26324c";
const TEXT = "#e8edf5";
const MUTED = "#94a3b8";
const ACCENT = "#22D3EE";

const sans = "Arial, Helvetica, sans-serif";

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export function renderLibraryImage(
  canvas: HTMLCanvasElement,
  entries: LibraryEntry[],
  size: ShareImageSize,
) {
  const { w, h } = SIZES[size];
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const finished = entries.filter((e) => e.status === "watched");
  const upNext = entries.filter((e) => e.status === "want_to_watch");
  const loved = finished.filter((e) => e.myTake === "loved");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  // Rounded inner frame.
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 4;
  const m = 44;
  const r = 56;
  ctx.beginPath();
  ctx.moveTo(m + r, m);
  ctx.arcTo(w - m, m, w - m, h - m, r);
  ctx.arcTo(w - m, h - m, m, h - m, r);
  ctx.arcTo(m, h - m, m, m, r);
  ctx.arcTo(m, m, w - m, m, r);
  ctx.closePath();
  ctx.stroke();

  const padX = 108;
  const contentWidth = w - padX * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = w / 2;

  // Eyebrow.
  ctx.font = `900 30px ${sans}`;
  ctx.fillStyle = ACCENT;
  ctx.fillText("MY LIBRARY", cx, size === "portrait" ? 170 : 140);

  // Headline counts.
  ctx.font = `900 58px ${sans}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(
    `${finished.length} finished · ${upNext.length} up next`,
    cx,
    size === "portrait" ? 260 : 225,
  );

  // Two list blocks: Loved, Up next. Left-aligned rows inside a card box.
  ctx.textAlign = "left";
  const blocks: Array<{ heading: string; items: LibraryEntry[] }> = [
    { heading: "Loved", items: loved },
    { heading: "Up next", items: upNext },
  ].filter((b) => b.items.length > 0);

  const perBlock = size === "portrait" ? 5 : 4;
  let y = size === "portrait" ? 370 : 320;
  const bottomLimit = h - 250;

  for (const block of blocks) {
    if (y + 60 > bottomLimit) break;
    ctx.font = `900 30px ${sans}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText(block.heading.toUpperCase(), padX, y);
    y += 58;

    for (const e of block.items.slice(0, perBlock)) {
      if (y > bottomLimit) break;
      ctx.font = `700 36px ${sans}`;
      ctx.fillStyle = TEXT;
      const label = `${e.title}${e.releaseYear ? ` (${e.releaseYear})` : ""}`;
      ctx.fillText(truncate(ctx, label, contentWidth), padX, y);
      y += 54;
    }
    const extra = block.items.length - perBlock;
    if (extra > 0 && y <= bottomLimit) {
      ctx.font = `600 28px ${sans}`;
      ctx.fillStyle = MUTED;
      ctx.fillText(`+ ${extra} more`, padX, y);
      y += 54;
    }
    y += 30;
  }

  // Footer.
  ctx.textAlign = "center";
  ctx.font = `600 28px ${sans}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("One list for what you watch and read.", cx, h - 158);
  ctx.font = `900 30px ${sans}`;
  ctx.fillStyle = ACCENT;
  ctx.fillText("WATCHEDNOTWATCHED.COM", cx, h - 92);
}

/** Downloads the PNG and copies the text summary so a caption is ready. */
export async function downloadLibraryImage(
  entries: LibraryEntry[],
  size: ShareImageSize,
): Promise<"saved" | "failed"> {
  if (typeof document === "undefined") return "failed";

  const canvas = document.createElement("canvas");
  renderLibraryImage(canvas, entries, size);

  try {
    await navigator.clipboard.writeText(entriesToSummary(entries));
  } catch {
    // Caption copy is best-effort; the image download still proceeds.
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve("failed");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchednotwatched-library-${
        size === "portrait" ? "1080x1350" : "1080x1080"
      }.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      resolve("saved");
    }, "image/png");
  });
}
