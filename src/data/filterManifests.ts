// Demonstration filter data. These are OWNER-AUTHORED markers on a licensed
// demo video — NOT scene claims about any commercial title. source: "sample".
import type { FilterManifest } from "@/lib/filter/types";

// Default demo asset is bundled locally so the Filter Lab works offline on any
// deploy: public/filter-lab/demo.mp4 — a CC0 (public-domain) sample clip.
// To use your own AUTHORIZED video, replace that file (keep the path) or set
// DEMO_VIDEO.src below. See docs/filter-studio.md.
export const DEMO_VIDEO = {
  src: "/filter-lab/demo.mp4",
  localOverride: "/filter-lab/demo.mp4",
  title: "Demo reel",
  attribution: "Demo clip: “Big Buck Bunny” © Blender Foundation · CC-BY 3.0 · peach.blender.org. Replace with your own authorized video to filter it.",
  isSample: true,
} as const;

// Demonstration markers across the ~10s clip so mute + skip are easy to see.
// Labels are neutral demonstration labels — NOT scene claims about any title.
export const DEMO_MANIFEST: FilterManifest = {
  id: "demo-reel-v1",
  version: 1,
  mediaId: "sample:demo-reel",
  title: DEMO_VIDEO.title,
  durationSeconds: 10,
  source: "sample",
  createdAt: "2026-07-09T00:00:00.000Z",
  updatedAt: "2026-07-09T00:00:00.000Z",
  events: [
    { id: "d1", startSeconds: 1.0, endSeconds: 1.8, action: "warn", category: "frightening", severity: "mild", label: "Heads-up: intense moment", description: "Demonstration warning notice." },
    { id: "d2", startSeconds: 2.2, endSeconds: 3.4, action: "mute", category: "language", severity: "moderate", label: "Language muted", description: "Demonstration mute region." },
    { id: "d3", startSeconds: 4.0, endSeconds: 5.6, action: "skip", category: "violence", severity: "strong", label: "Action moment skipped", description: "Demonstration skip region." },
    { id: "d4", startSeconds: 6.2, endSeconds: 7.0, action: "mute", category: "substance-use", severity: "mild", label: "Reference muted", description: "Demonstration mute region." },
    { id: "d5", startSeconds: 7.4, endSeconds: 8.0, action: "warn", category: "frightening", severity: "moderate", label: "Heads-up: scary visual", description: "Demonstration warning notice." },
    { id: "d6", startSeconds: 8.4, endSeconds: 9.4, action: "skip", category: "frightening", severity: "strong", label: "Frightening scene skipped", description: "Demonstration skip region.", enabledByDefault: true },
  ],
};
