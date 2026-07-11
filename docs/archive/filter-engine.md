# Filter Engine

Player-agnostic engine that applies mute / skip / warn from a validated manifest.
It never touches a protected stream — it only drives a `ControllablePlayer`.

## Files
- `src/lib/filter/types.ts` — `FilterAction`, `FilterCategory`, `FilterEvent`, `FilterManifest`, `ControllablePlayer`.
- `src/lib/filter/manifest.ts` — validation + parsing (`validateManifest`, `parseManifest`, `sortEvents`).
- `src/lib/filter/engine.ts` — `FilterEngine`.
- `src/lib/filter/html5.ts` — `createHtml5Player(video)` HTML5 `<video>` adapter (rAF ticks).

## Using it
```ts
const player = createHtml5Player(videoEl);
const engine = new FilterEngine(player, manifest, {
  enabledCategories: new Set(["language", "violence"]),
  disabledEventIds: new Set(),
  warnLeadSeconds: 3,
});
const unsub = engine.subscribe((state) => { /* activeEvents, upcoming, counts */ });
engine.start();
// later
engine.setSettings({ enabledCategories, disabledEventIds });
engine.stop(); // restores mute + detaches
```

## Behavior guarantees (see `engine.test.ts`)
- Mutes inside a mute region; **restores the user's prior mute state** on exit.
- Skips to the region end **exactly once**; re-skips if the user scrubs backward in.
- Respects disabled categories and individually disabled events.
- Handles pause/resume/seek; cleans up timers and listeners on `stop()`.
- Emits state only when it meaningfully changes (avoids per-frame React churn).
- Session counts stay in memory. **Nothing is uploaded.**

## Adding a new player
Implement `ControllablePlayer` (get/seek time, get/set muted, `onTimeUpdate`). A
future licensed player would be a new adapter — the engine is unchanged. It is
NOT a protected-stream adapter and must not be presented as one.
