import { describe, expect, it } from "vitest";
import { validateManifest, isVerified } from "@/lib/filter/manifest";
import { AUTHORIZED_MEDIA, FILTER_MANIFESTS, watchWithFilterAvailable } from "./filterManifests";

describe("filter manifest registry", () => {
  it("every registered manifest validates", () => {
    for (const m of FILTER_MANIFESTS) {
      const r = validateManifest(m);
      expect(r.errors, `${m.id}: ${r.errors.join("; ")}`).toEqual([]);
    }
  });

  it("every registered manifest is verified (unverified tracks never run automatic actions)", () => {
    for (const m of FILTER_MANIFESTS) {
      expect(isVerified(m), `${m.id} must carry verification`).toBe(true);
    }
  });

  it("every manifest has authorized media and vice versa", () => {
    for (const m of FILTER_MANIFESTS) {
      expect(AUTHORIZED_MEDIA[m.mediaId], `${m.mediaId} missing authorized media`).toBeDefined();
      expect(watchWithFilterAvailable(m.mediaId)).toBe(true);
    }
    for (const mediaId of Object.keys(AUTHORIZED_MEDIA)) {
      expect(FILTER_MANIFESTS.some((m) => m.mediaId === mediaId), `${mediaId} has media but no manifest`).toBe(true);
    }
  });

  it("authorized media is only local or Internet Archive — never a streaming service", () => {
    for (const media of Object.values(AUTHORIZED_MEDIA)) {
      expect(
        media.src.startsWith("/") || media.src.startsWith("https://archive.org/"),
        `${media.mediaId}: unexpected media host ${media.src}`,
      ).toBe(true);
    }
  });
});
