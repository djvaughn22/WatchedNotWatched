# Data Licensing & Attribution

## Metadata provider — TMDB (`src/lib/media/tmdb.ts`)
- Server-side only. Auth via `TMDB_ACCESS_TOKEN` (preferred) or `TMDB_API_KEY`.
- **Required attribution** (rendered on title pages): _"This product uses the
  TMDB API but is not endorsed or certified by TMDB."_
- **Commercial warning:** a standard TMDB developer key does **not** clear a
  revenue-generating product. A commercial launch requires a data source whose
  licensing permits the intended revenue model. Resolve before charging money.

## Watch-provider availability — JustWatch (via TMDB)
- TMDB's `watch/providers` data is provided by JustWatch.
- **Required attribution:** _"Streaming availability data provided by JustWatch."_
- We treat these as availability signals, **not** verified direct playback
  links. Handoffs go to a provider search or the TMDB/JustWatch watch page.

## Demo video — Big Buck Bunny
- © Blender Foundation, CC-BY 3.0 (peach.blender.org). Attributed in the Filter
  Lab and Studio. Replaceable with owner-supplied authorized media.

## Sample catalog (`src/data/catalog.ts`)
- Public-domain film metadata, minimal factual fields, `dataStatus: "sample"`.
- Never shown as live provider availability.

## Rules
- No fabricated content reviews or scene timestamps for commercial titles.
- No advisories copied from another commercial review service.
- All secrets stay server-side. Attribution renders in the UI where the data is used.
