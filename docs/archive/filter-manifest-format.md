# Filter Manifest Format (v1)

A manifest is owner-authored/editorial/sample filter data for ONE piece of
authorized media. It is versioned. It is **never** scene claims about a
commercial title we have no rights to.

```jsonc
{
  "id": "demo-reel-v1",
  "version": 1,
  "mediaId": "sample:demo-reel",
  "title": "Demo reel",
  "durationSeconds": 596,
  "source": "sample",            // "editorial" | "owner-authored" | "sample"
  "createdAt": "2026-07-09T00:00:00.000Z",
  "updatedAt": "2026-07-09T00:00:00.000Z",
  "events": [
    {
      "id": "d2",
      "startSeconds": 14,
      "endSeconds": 18,           // must be > startSeconds
      "action": "mute",           // "mute" | "skip" | "warn"
      "category": "language",     // see FilterCategory
      "severity": "moderate",     // "mild" | "moderate" | "strong"
      "label": "Language muted",
      "description": "Author's own words (optional)",
      "enabledByDefault": true     // optional; false = off until enabled
    }
  ]
}
```

Categories: `language, violence, sexual-content, nudity, frightening,
substance-use, religious-concern, other`.

## Validation
`validateManifest(input)` returns `{ valid, errors, warnings }`. Errors are
fatal (bad types, `endSeconds <= startSeconds`, unknown action/category/severity).
Warnings are non-fatal (overlaps, events past the media duration). Overlaps are
allowed at runtime. Validate imported/stored manifests before use.

## Versioning
Bump `version` on breaking shape changes and add a migration in `manifest.ts`.
