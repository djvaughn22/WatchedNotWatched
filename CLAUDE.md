@AGENTS.md

# WatchedNotWatched (watchednotwatched.com)
Personal watch list for movies and TV: search, mark Watched or Want to Watch, add your take, keep going. Local-first, no accounts. Secular. Accent: **#22D3EE**.
- Wordmark renders as Watched + cyan "✓" + NotWatched + cyan ".com" (the ✓ is the brand mark). Shared OpenMirror chrome keeps the plain "WatchedNotWatched.com" string.

## Open Mirror family rules
- One of 11 Open Mirror LLC sites (hub: openmirrorllc.com, repo djvaughn22/open-mirror). Baseline tag: `mvp-1`.
- **Design:** flat + cool. bg `#0b1220`, surface `#141d2e`, border `#26324c`, text `#e8edf5`, muted `#94a3b8`. No glass, no gradients, **no red**.
- **Shared chrome is SYNCED, not owned here:** `OpenMirrorNav.tsx`, `OpenMirrorFooter.tsx`, `OpenMirrorTheme.tsx` in the app folder are copies from the hub repo `packages/openmirror-ui/`. NEVER edit them here — edit in the hub, run its `scripts/sync-ui.sh`, then rebuild/commit each satellite.
- Nav + footer mount in `layout.tsx`. Footer = three centered lines: `OpenMirrorLLC.com · About · ✝️ ❤️ 🙏` (the icons ARE the CrossHeartPray link — no word), `Contact · Disclaimer` (anchors into this site's own `/about#contact` / `/about#disclaimer` sections), then the plain line `Open Mirror LLC is a small independent company.`
- ☀️/🌙 family toggle (`om-theme`) lives in the bar; pages that compute JS colors follow the `om-theme` window event.
- **Copy style:** DJ's words. Short, plain, human. Never wordy or AI-sounding.
- **Deploys:** push to `main` = production deploy (Vercel). Batch related edits into one commit.
