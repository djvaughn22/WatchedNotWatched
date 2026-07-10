# MVP2 Lite: Commercial-Safe Search & Trusted Title Experience

## Overview

MVP2 Lite adds a commercially defensible search foundation and improves title-detail clarity without rewriting MVP1's Filter Engine, Studio, or profile system.

**Pass 1:** Hybrid search with TVmaze + Wikidata  
**Pass 2:** Clear editorial status and household compatibility display

## Sources

### Approved (Commercial Use)

| Source | Type | License | Attribution |
|--------|------|---------|--------------|
| WatchedNotWatched | Editorial | Proprietary | Required |
| TVmaze | TV search + metadata | Free keyless | Required |
| Wikidata | Movie + title search | CC0 1.0 | Required |
| YouTube | Trailers | Proprietary | Required |

### Rejected (Not Used)

TMDB, Cinemeta, IMDb, OMDb, JustWatch — all restricted for commercial products without explicit agreements.

## Search Flow

1. **Local catalog** (WatchedNotWatched sample records)
2. **TVmaze** (television titles)
3. **Wikidata** (movies, general titles)

Results deduplicated by title + year + type. Local/reviewed items preferred.

## Title Sources

Titles route via `/title/[source]/[id]?mediaType=movie|series`

| Source | Handler | Attributes |
|--------|---------|-----------|
| `sample` | Local catalog | WatchedNotWatched reviewed |
| `tvmaze` | TVmaze API | TV shows, genres, runtime |
| `wikidata` | Wikidata API | Movies, Wikipedia data |
| `editorial` | Editorial drafts | In-review state |

## Editorial Status

Every title displays exactly one state:

- **Reviewed** — WatchedNotWatched detailed guidance + categories
- **In review** — Marked for review, not yet completed
- **Basic info** — External source only (TVmaze/Wikidata)
- **Not reviewed** — External source without guidance entry

Derived from `title.dataStatus` and `title.guidance.categories[].source`.

## Content Guidance

### WatchedNotWatched Guidance (When Available)

- **Categories:** Language, Violence, Sexual content, Nudity, Frightening, Substance use, Religious concern, Other
- **Levels:** None noted, Mild, Moderate, Strong, Severe
- **Never:** "Not reviewed" renders as "None noted"

### External Metadata (Always Shown)

- Title, year, runtime, genres, synopsis
- Official MPAA/TV rating (if present)
- Source attribution

## Household Compatibility

When active profile exists:

- **Guidance available:** "Good match" / "Review first" / "Outside profile"
- **No guidance:** "Not enough information" — explains WatchedNotWatched hasn't reviewed it

Never infers safety from missing guidance, genre, or official rating.

## Filter Status

**Current:** No manifest status display (deferred)  
**Next:** Show manifest availability on title page

## Trailers

- YouTube integration preserved
- Official vs. found result distinction
- Fallback: YouTube search link when unavailable
- Does not imply title is filterable

## Provider Handoffs

Safe actions only:

- "Search Netflix" → provider search with title query
- "Search Prime Video" → provider search
- "Open Apple TV" → store link
- "View source information" → external source URL

**Never:** "Watch Now", "Available on", "Filtering Active" without verified capability.

## Attribution

"Sources and Credits" section shows only used sources with links.

## Image Handling

- Licensed poster from source when available
- Branded fallback (gradient + icon + "No image") when unavailable
- Never scraped or unlicensed

## Build & Deploy

- TypeScript strict mode ✓
- ESLint clean ✓
- Next.js production build ✓
- No database required (in-memory editorial drafts)

## Known Limitations

1. **Editorial drafts** in-memory only (no persistence)
2. **Filter manifest status** not displayed
3. **Admin dashboard** not implemented
4. **Vercel KV** not integrated

## Next Steps

1. Add Vercel KV for editorial draft persistence
2. Implement filter manifest status display
3. Build admin review UI
4. Connect editorial state to Filter Studio

## References

- `/src/lib/media/sources.ts` — source registry
- `/src/lib/editorial-status.ts` — status helpers
- `/src/lib/media/tvmaze.ts` — TV search adapter
- `/src/lib/media/wikidata.ts` — movie search adapter
- `/src/app/api/search/route.ts` — hybrid search
- `/src/app/title/[source]/[id]/TitleDetailClient.tsx` — title display
