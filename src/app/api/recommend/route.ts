import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createOpenLibraryAdapter, relatedByAuthor, relatedBySubject } from "@/lib/media/openlibrary";
import type { MediaType, SearchResultItem } from "@/lib/media/types";

// For You: personal picks from the titles the user thumbed up. The client
// sends its liked titles (the library lives on-device, never on a server);
// for movies/TV we pull TMDB's recommendations for each seed. For books,
// Open Library has no recommendation graph, so we look up each seed's own
// author + subjects and query for other books that share them — deterministic,
// no AI, no fabricated ranking. Ranked by how many seeds agree, weighted by
// how much the user liked each seed.

interface Seed {
  sourceId: string;
  mediaType: MediaType;
  weight: number; // loved = 3, liked = 2
}

interface RecommendResponse {
  items: Array<SearchResultItem & { because?: string }>;
  supported: boolean;
}

const MAX_SEEDS = 8;
const MAX_RESULTS = 40;

export const maxDuration = 15;

async function bookRecommendations(seeds: Seed[], seedTitles: Record<string, string>, signal: AbortSignal) {
  const seedIds = new Set(seeds.map((s) => `openlibrary:${s.sourceId}`));
  const adapter = createOpenLibraryAdapter();
  const perSeed = await Promise.all(
    seeds.map(async (seed) => {
      try {
        const work = await adapter.getTitle(seed.sourceId, "book");
        if (!work) return { seed, items: [] as SearchResultItem[] };
        const author = work.creators?.[0];
        const subject = work.genres?.[0];
        const [byAuthor, bySubject] = await Promise.all([
          author ? relatedByAuthor(author, seedIds, 12, signal).catch(() => []) : Promise.resolve([]),
          subject ? relatedBySubject(subject, seedIds, 12, signal).catch(() => []) : Promise.resolve([]),
        ]);
        return { seed, items: [...byAuthor, ...bySubject] };
      } catch {
        return { seed, items: [] as SearchResultItem[] };
      }
    }),
  );

  const scored = new Map<string, { item: SearchResultItem; score: number; because: string }>();
  for (const { seed, items } of perSeed) {
    for (const item of items) {
      if (seedIds.has(item.id)) continue;
      const prev = scored.get(item.id);
      if (prev) {
        prev.score += seed.weight;
      } else {
        scored.set(item.id, { item, score: seed.weight, because: seedTitles[seed.sourceId] ?? "" });
      }
    }
  }
  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ item, because }) => (because ? { ...item, because } : item));
}

export async function POST(req: NextRequest) {
  let seeds: Seed[] = [];
  let seedTitles: Record<string, string> = {};
  try {
    const body = await req.json();
    if (Array.isArray(body?.seeds)) {
      seeds = (body.seeds as Seed[])
        .filter((s) => s && typeof s.sourceId === "string")
        .slice(0, MAX_SEEDS);
    }
    if (body?.seedTitles && typeof body.seedTitles === "object") seedTitles = body.seedTitles;
  } catch {
    /* fall through to empty seeds */
  }

  if (seeds.length === 0) {
    return NextResponse.json<RecommendResponse>({ items: [], supported: true });
  }

  if (seeds.every((s) => s.mediaType === "book")) {
    try {
      const items = await bookRecommendations(seeds, seedTitles, req.signal);
      return NextResponse.json<RecommendResponse>({ items, supported: true });
    } catch {
      return NextResponse.json<RecommendResponse>({ items: [], supported: true });
    }
  }

  if (!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json<RecommendResponse>({ items: sampleRecs(), supported: true });
    }
    return NextResponse.json<RecommendResponse>({ items: [], supported: false });
  }

  // Only numeric TMDB ids reach the real adapter.
  seeds = seeds.filter((s) => /^\d+$/.test(s.sourceId));
  if (seeds.length === 0) {
    return NextResponse.json<RecommendResponse>({ items: [], supported: true });
  }

  try {
    const adapter = createTmdbAdapter();
    const perSeed = await Promise.all(
      seeds.map((s) =>
        adapter
          .getSimilar!(s.sourceId, s.mediaType === "series" ? "series" : "movie")
          .then((items) => ({ seed: s, items: items ?? [] }))
          .catch(() => ({ seed: s, items: [] as SearchResultItem[] })),
      ),
    );

    const seedIds = new Set(seeds.map((s) => `tmdb:${s.sourceId}`));
    const scored = new Map<string, { item: SearchResultItem; score: number; because: string }>();
    for (const { seed, items } of perSeed) {
      for (const item of items) {
        if (seedIds.has(item.id)) continue;
        const prev = scored.get(item.id);
        if (prev) {
          prev.score += seed.weight;
        } else {
          scored.set(item.id, {
            item,
            score: seed.weight,
            because: seedTitles[seed.sourceId] ?? "",
          });
        }
      }
    }

    const items = [...scored.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(({ item, because }) => (because ? { ...item, because } : item));
    return NextResponse.json<RecommendResponse>({ items, supported: true });
  } catch {
    return NextResponse.json<RecommendResponse>({ items: [], supported: true });
  }
}

function sampleRecs(): Array<SearchResultItem & { because?: string }> {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `sample:pick-${i + 1}`,
    source: "sample",
    sourceId: `pick-${i + 1}`,
    mediaType: "movie" as MediaType,
    title: `Sample Pick ${i + 1}`,
    releaseYear: 1990 + i,
    dataStatus: "sample" as const,
    because: "Sample Movie 1",
  }));
}
