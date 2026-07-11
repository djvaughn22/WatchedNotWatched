// Maps a family viewing profile onto engine settings for one manifest.
// Rule: an event is filtered when its severity EXCEEDS what the profile
// accepts for that category. A category with no stated threshold is treated
// as strictest (everything filtered) — never assume tolerance.
import type { ProfileLevel, ViewingProfile } from "../profiles";
import type { EngineSettings } from "./engine";
import type { FilterCategory, FilterManifest, FilterSeverity } from "./types";

const LEVEL_RANK: Record<ProfileLevel, number> = {
  "none-noted": 0,
  mild: 1,
  moderate: 2,
  strong: 3,
  severe: 4,
};

const SEVERITY_RANK: Record<FilterSeverity, number> = {
  mild: 1,
  moderate: 2,
  strong: 3,
};

export function settingsFromProfile(
  profile: ViewingProfile,
  manifest: FilterManifest,
): Pick<EngineSettings, "enabledCategories" | "disabledEventIds"> {
  const usedCategories = new Set<FilterCategory>(manifest.events.map((e) => e.category));
  const enabledCategories = new Set<FilterCategory>(
    [...usedCategories].filter((c) => profile.enabledFilterCategories.includes(c)),
  );
  // Events the profile tolerates (severity within threshold) are disabled.
  const disabledEventIds = new Set<string>(
    manifest.events
      .filter((e) => {
        if (!enabledCategories.has(e.category)) return false;
        const threshold = profile.thresholds[e.category];
        const thresholdRank = threshold !== undefined ? LEVEL_RANK[threshold] : 0;
        return SEVERITY_RANK[e.severity] <= thresholdRank;
      })
      .map((e) => e.id),
  );
  return { enabledCategories, disabledEventIds };
}
