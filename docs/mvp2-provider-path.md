# MVP2 — Path to a Real Filterable Catalog

MVP1 filters only owner/public-domain/licensed video. To filter more, we need a
legally sound source. Routes evaluated below and ranked.

## Option A — Provider licensing / partnerships
Authorized playback access, account authorization, content licensing, platform
agreements, scene-marker rights, technical certification, compliance, support,
and likely TV-device apps.
- Speed: **slow** · Cost: **high** · Legal risk: **low (if licensed)** · Tech risk: high · Maintenance: high · User value: highest · Defensibility: high.

## Option B — Browser extension over protected streams
Permissions, platform terms, DRM limits, fragility, constant update burden,
privacy exposure, store approval, accessibility, legal review.
- Speed: medium · Cost: medium · Legal risk: **high** · Tech risk: **high** · Maintenance: **high** · User value: medium · Defensibility: low. **Do not build in this sprint.**

## Option C — User-owned media (desktop / local-first)
Play files the user legally owns; local manifests; no upload by default; mute/skip;
subtitle handling; privacy; packaging.
- Speed: medium · Cost: low–medium · Legal risk: **low** · Tech risk: medium · Maintenance: medium · User value: medium · Defensibility: medium.

## Option D — Licensed & original media (RECOMMENDED)
Partner with independent filmmakers, churches, educational/family creators,
public-domain libraries, and Open Mirror content. We hold or license the media,
so we can filter it lawfully and end-to-end — the same engine already shipped.
- Speed: **fast** · Cost: low · Legal risk: **low** · Tech risk: **low** · Maintenance: low · User value: medium-high · Defensibility: medium-high.

## Recommendation
Pursue **Option D** for MVP2: a small, growing catalog of licensed/original/PD
titles with owner-authored manifests, authored in the Filter Studio and played
through the existing Filter Engine. It is the fastest lawful path to real,
end-to-end filtering and de-risks later provider conversations (Option A).
