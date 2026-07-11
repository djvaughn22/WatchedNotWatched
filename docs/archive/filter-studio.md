# Filter Studio

Internal authoring tool for filter manifests. Route: `/studio/filters`.
It is **not** in public navigation and is `noindex`.

## Access
Enabled when `FEATURE_FILTER_STUDIO=true`, or automatically in local
development (`NODE_ENV !== production`). Otherwise it renders a disabled notice.
This is a real gate — not fake security. For a shared/staging environment,
put it behind real authentication before enabling.

## What it does
- Loads the authorized demo video.
- Play / pause; capture the current timestamp.
- Mark start `[` and end `]`; create a mute / skip / warn event with a
  category, severity, label, and your own description.
- Edit, delete, and auto-sort events by timestamp.
- Live validation (errors + overlap warnings).
- **Preview filters** — runs the real Filter Engine on the current draft.
- Export JSON, Copy JSON, Import a manifest, Save on this device.

Keyboard: `Space` play/pause · `[` mark start · `]` mark end · `M` mute · `S` skip.

## Demo asset
Default: `src/data/filterManifests.ts → DEMO_VIDEO.src` (Big Buck Bunny, CC-BY).
To author against your own authorized video, drop a file at
`public/filter-lab/demo.mp4` and set `DEMO_VIDEO.src` to `/filter-lab/demo.mp4`.

## Guardrail
Do not auto-generate advisories from copyrighted video via an unapproved
external service. Descriptions must be original. The manifest format is
versioned; keep the Studio components reusable.
