// Lightweight, dependency-free validation + helpers for FilterManifest.
import {
  ALL_CATEGORIES,
  type FilterEvent,
  type FilterManifest,
} from "./types";

const ACTIONS = new Set(["mute", "skip", "warn"]);
const SEVERITIES = new Set(["mild", "moderate", "strong"]);
const SOURCES = new Set(["editorial", "owner-authored", "sample"]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateEvent(e: unknown, index: number): string[] {
  const errs: string[] = [];
  const prefix = `event[${index}]`;
  if (!e || typeof e !== "object") return [`${prefix} is not an object`];
  const ev = e as Record<string, unknown>;
  if (typeof ev.id !== "string" || !ev.id) errs.push(`${prefix}.id missing`);
  if (!isFiniteNumber(ev.startSeconds) || (ev.startSeconds as number) < 0)
    errs.push(`${prefix}.startSeconds must be a number >= 0`);
  if (!isFiniteNumber(ev.endSeconds)) errs.push(`${prefix}.endSeconds must be a number`);
  if (
    isFiniteNumber(ev.startSeconds) &&
    isFiniteNumber(ev.endSeconds) &&
    (ev.endSeconds as number) <= (ev.startSeconds as number)
  )
    errs.push(`${prefix}.endSeconds must be greater than startSeconds`);
  if (!ACTIONS.has(ev.action as string)) errs.push(`${prefix}.action invalid`);
  if (!ALL_CATEGORIES.includes(ev.category as never)) errs.push(`${prefix}.category invalid`);
  if (!SEVERITIES.has(ev.severity as string)) errs.push(`${prefix}.severity invalid`);
  if (typeof ev.label !== "string" || !ev.label) errs.push(`${prefix}.label missing`);
  return errs;
}

export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["manifest is not an object"], warnings };
  }
  const m = input as Record<string, unknown>;

  if (typeof m.id !== "string" || !m.id) errors.push("id missing");
  if (!isFiniteNumber(m.version)) errors.push("version must be a number");
  if (typeof m.mediaId !== "string" || !m.mediaId) errors.push("mediaId missing");
  if (typeof m.title !== "string" || !m.title) errors.push("title missing");
  if (!isFiniteNumber(m.durationSeconds) || (m.durationSeconds as number) <= 0)
    errors.push("durationSeconds must be a number > 0");
  if (!SOURCES.has(m.source as string)) errors.push("source invalid");
  if (!Array.isArray(m.events)) {
    errors.push("events must be an array");
  } else {
    (m.events as unknown[]).forEach((e, i) => errors.push(...validateEvent(e, i)));
    // Duration bounds + overlap warnings (non-fatal).
    if (isFiniteNumber(m.durationSeconds)) {
      (m.events as FilterEvent[]).forEach((e, i) => {
        if (isFiniteNumber(e?.endSeconds) && e.endSeconds > (m.durationSeconds as number))
          warnings.push(`event[${i}] ends after the media duration`);
      });
    }
    warnings.push(...overlapWarnings(m.events as FilterEvent[]));
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Overlaps are allowed at runtime, but the author should know about them.
export function overlapWarnings(events: FilterEvent[]): string[] {
  const warnings: string[] = [];
  const sorted = [...events]
    .filter((e) => Number.isFinite(e?.startSeconds) && Number.isFinite(e?.endSeconds))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startSeconds < sorted[i - 1].endSeconds) {
      warnings.push(
        `events "${sorted[i - 1].label}" and "${sorted[i].label}" overlap`,
      );
    }
  }
  return warnings;
}

export function sortEvents(events: FilterEvent[]): FilterEvent[] {
  return [...events].sort((a, b) => a.startSeconds - b.startSeconds);
}

// Parse untrusted JSON (e.g. an imported/localStorage manifest) safely.
export function parseManifest(json: string): { manifest?: FilterManifest; result: ValidationResult } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { result: { valid: false, errors: ["invalid JSON"], warnings: [] } };
  }
  const result = validateManifest(data);
  return { manifest: result.valid ? (data as FilterManifest) : undefined, result };
}
