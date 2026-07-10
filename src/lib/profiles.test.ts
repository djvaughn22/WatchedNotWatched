import { describe, expect, it } from "vitest";
import { defaultProfiles, getActiveProfile, loadStore } from "./profiles";

describe("profiles", () => {
  it("ships the expected default presets", () => {
    const ids = defaultProfiles().map((p) => p.id);
    expect(ids).toEqual(["little-kids", "kids", "family", "teens", "adults"]);
  });

  it("Little Kids is stricter than Adults for violence", () => {
    const profiles = defaultProfiles();
    const lk = profiles.find((p) => p.id === "little-kids")!;
    const ad = profiles.find((p) => p.id === "adults")!;
    expect(lk.thresholds.violence).toBe("mild");
    expect(ad.thresholds.violence).toBe("severe");
  });

  it("loadStore returns defaults with Family active on the server", () => {
    const store = loadStore();
    expect(store.activeId).toBe("family");
    expect(getActiveProfile(store).id).toBe("family");
  });
});
