// Real file exports of the library. JSON keeps the full store shape so a
// future import can restore it. CSV/Markdown are for spreadsheets and notes.

import {
  AGAIN_LABELS,
  MY_TAKE_LABELS,
  mediaTypeLabel,
  statusLabel,
  type LibraryEntry,
} from "./library";

const CSV_HEADER = [
  "Title",
  "Year",
  "Type",
  "Status",
  "My Take",
  "Again",
  "Genres",
  "Date Added",
  "Date Finished",
  "ID",
];

function csvCell(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function entriesToCsv(entries: LibraryEntry[]): string {
  const rows = entries.map((e) =>
    [
      csvCell(e.title),
      csvCell(e.releaseYear),
      csvCell(mediaTypeLabel(e.mediaType)),
      csvCell(statusLabel(e.status, e.mediaType)),
      csvCell(e.myTake ? MY_TAKE_LABELS[e.myTake] : ""),
      csvCell(e.again ? AGAIN_LABELS[e.again] : ""),
      csvCell((e.genres ?? []).join("; ")),
      csvCell(day(e.addedAt)),
      csvCell(day(e.watchedAt)),
      csvCell(e.id),
    ].join(","),
  );
  return [CSV_HEADER.join(","), ...rows].join("\n") + "\n";
}

/** Full-fidelity export; enough to restore the library later. */
export function entriesToJson(entries: LibraryEntry[]): string {
  return JSON.stringify(
    {
      app: "WatchedNotWatched",
      format: "wnw-library",
      version: 2,
      exportedAt: new Date().toISOString(),
      entries,
    },
    null,
    2,
  );
}

export function entriesToMarkdown(entries: LibraryEntry[]): string {
  const lines: string[] = ["# My WatchedNotWatched library", ""];
  const sections: Array<[string, (e: LibraryEntry) => boolean]> = [
    ["Want to Watch", (e) => e.status === "want_to_watch" && e.mediaType !== "book"],
    ["Want to Read", (e) => e.status === "want_to_watch" && e.mediaType === "book"],
    ["Watched", (e) => e.status === "watched" && e.mediaType !== "book"],
    ["Read", (e) => e.status === "watched" && e.mediaType === "book"],
  ];
  for (const [heading, match] of sections) {
    const group = entries.filter(match);
    if (group.length === 0) continue;
    lines.push(`## ${heading} (${group.length})`, "");
    for (const e of group) {
      const bits = [
        `**${e.title}**${e.releaseYear ? ` (${e.releaseYear})` : ""}`,
        mediaTypeLabel(e.mediaType),
        e.myTake ? `My Take: ${MY_TAKE_LABELS[e.myTake]}` : "",
        e.again ? `Again: ${AGAIN_LABELS[e.again]}` : "",
      ].filter(Boolean);
      lines.push(`- ${bits.join(" · ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Short plain-text summary for share/email. */
export function entriesToSummary(entries: LibraryEntry[]): string {
  const want = entries.filter((e) => e.status === "want_to_watch");
  const watched = entries.filter((e) => e.status === "watched");
  const booksToRead = want.filter((e) => e.mediaType === "book");
  const booksRead = watched.filter((e) => e.mediaType === "book");
  const toWatch = want.filter((e) => e.mediaType !== "book");
  const seen = watched.filter((e) => e.mediaType !== "book");
  const loved = watched.filter((e) => e.myTake === "loved");
  const list = (es: LibraryEntry[], cap: number) =>
    es.slice(0, cap).map((e) => `- ${e.title}${e.releaseYear ? ` (${e.releaseYear})` : ""}`).join("\n");

  const parts = [
    `My WatchedNotWatched library: ${seen.length} watched, ${toWatch.length} to watch, ${booksRead.length} read, ${booksToRead.length} to read.`,
  ];
  if (loved.length > 0) parts.push(`\nLoved:\n${list(loved, 10)}`);
  if (want.length > 0) parts.push(`\nUp next:\n${list(want, 10)}`);
  return parts.join("\n");
}

// ---- Browser-side helpers -------------------------------------------------

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportCsv(entries: LibraryEntry[]) {
  downloadFile(`watchednotwatched-${stamp()}.csv`, entriesToCsv(entries), "text/csv");
}

export function exportJson(entries: LibraryEntry[]) {
  downloadFile(`watchednotwatched-${stamp()}.json`, entriesToJson(entries), "application/json");
}

export function exportMarkdown(entries: LibraryEntry[]) {
  downloadFile(`watchednotwatched-${stamp()}.md`, entriesToMarkdown(entries), "text/markdown");
}

/** Web Share where available; clipboard fallback. Returns what happened. */
export async function shareSummary(entries: LibraryEntry[]): Promise<"shared" | "copied" | "failed"> {
  const text = entriesToSummary(entries);
  try {
    if (navigator.share) {
      await navigator.share({ title: "My WatchedNotWatched library", text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Prefilled email in the user's own mail app. No attachments — mailto can't. */
export function emailSummaryUrl(entries: LibraryEntry[]): string {
  const subject = "My WatchedNotWatched library";
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(entriesToSummary(entries))}`;
}
