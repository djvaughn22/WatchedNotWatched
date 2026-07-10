// Local-first family viewing profiles. No account, no birth dates, no real
// names required. Stored on this device only.
import { ALL_CATEGORIES, type FilterCategory } from "./filter/types";
import type { GuidanceLevel } from "./guidance";

export type ProfileLevel = Exclude<GuidanceLevel, "not-reviewed">;

export interface ViewingProfile {
  id: string;
  name: string;
  thresholds: Partial<Record<FilterCategory, ProfileLevel>>;
  enabledFilterCategories: FilterCategory[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "wnw.profiles.v1";
const SCHEMA_VERSION = 1;

interface ProfileStore {
  version: number;
  profiles: ViewingProfile[];
  activeId: string;
}

const now = () => new Date().toISOString();

function preset(
  id: string,
  name: string,
  thresholds: Partial<Record<FilterCategory, ProfileLevel>>,
): ViewingProfile {
  return {
    id,
    name,
    thresholds,
    enabledFilterCategories: (Object.keys(thresholds) as FilterCategory[]).length
      ? ALL_CATEGORIES
      : ALL_CATEGORIES,
    createdAt: now(),
    updatedAt: now(),
  };
}

const strictAll: ProfileLevel = "none-noted";
export function defaultProfiles(): ViewingProfile[] {
  return [
    preset("little-kids", "Little Kids", {
      language: strictAll,
      violence: "mild",
      "sexual-content": strictAll,
      nudity: strictAll,
      frightening: strictAll,
      "substance-use": strictAll,
    }),
    preset("kids", "Kids", {
      language: "mild",
      violence: "mild",
      "sexual-content": strictAll,
      nudity: strictAll,
      frightening: "mild",
      "substance-use": strictAll,
    }),
    preset("family", "Family", {
      language: "moderate",
      violence: "moderate",
      "sexual-content": "mild",
      nudity: "mild",
      frightening: "moderate",
      "substance-use": "mild",
    }),
    preset("teens", "Teens", {
      language: "strong",
      violence: "strong",
      "sexual-content": "moderate",
      nudity: "moderate",
      frightening: "strong",
      "substance-use": "moderate",
    }),
    preset("adults", "Adults", {
      language: "severe",
      violence: "severe",
      "sexual-content": "severe",
      nudity: "severe",
      frightening: "severe",
      "substance-use": "severe",
    }),
  ];
}

function freshStore(): ProfileStore {
  const profiles = defaultProfiles();
  return { version: SCHEMA_VERSION, profiles, activeId: "family" };
}

// ---- persistence (client only) ----------------------------------------
export function loadStore(): ProfileStore {
  if (typeof window === "undefined") return freshStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshStore();
    const parsed = JSON.parse(raw) as Partial<ProfileStore>;
    // Migration: unknown/old versions fall back to defaults, keeping any
    // well-formed custom profiles the user made.
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.profiles)) {
      return freshStore();
    }
    const valid = parsed.profiles.filter(
      (p) => p && typeof p.id === "string" && typeof p.name === "string" && p.thresholds,
    );
    const base = freshStore();
    const byId = new Map(base.profiles.map((p) => [p.id, p]));
    for (const p of valid) byId.set(p.id, { ...p });
    const profiles = [...byId.values()];
    const activeId = profiles.some((p) => p.id === parsed.activeId)
      ? (parsed.activeId as string)
      : "family";
    return { version: SCHEMA_VERSION, profiles, activeId };
  } catch {
    return freshStore();
  }
}

export function saveStore(store: ProfileStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, version: SCHEMA_VERSION }));
  } catch {
    /* ignore */
  }
}

export function getActiveProfile(store: ProfileStore): ViewingProfile {
  return store.profiles.find((p) => p.id === store.activeId) ?? store.profiles[0];
}

export function resetStore(): ProfileStore {
  const store = freshStore();
  saveStore(store);
  return store;
}

export type { ProfileStore };
