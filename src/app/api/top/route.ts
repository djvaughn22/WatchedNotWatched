import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { isValidDecade, isValidGenre } from "@/lib/media/genres";
import type { SearchResultItem } from "@/lib/media/types";

interface TopResponse {
  items: SearchResultItem[]; // up to 100, rank = array position + 1
  supported: boolean; // false when no TMDB key is configured
}

// Top 100 = five TMDB discover pages. Results change rarely; cache a day.
export const revalidate = 86400;

export async function GET(req: NextRequest) {
  if (!(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
    return NextResponse.json<TopResponse>({ items: [], supported: false });
  }

  const sp = req.nextUrl.searchParams;
  const mediaType = sp.get("type") === "series" ? "series" : "movie";
  const decadeParam = sp.get("decade") ?? "";
  const decade = isValidDecade(decadeParam) ? decadeParam : undefined;
  const genreParam = Number(sp.get("genre") ?? 0);
  const genreId = genreParam && isValidGenre(mediaType, genreParam) ? genreParam : undefined;

  if (!decade && !genreId) {
    return NextResponse.json({ error: "Pick a decade or a genre." }, { status: 400 });
  }

  try {
    const adapter = createTmdbAdapter();
    const pages = await Promise.all(
      [1, 2, 3, 4, 5].map((page) => adapter.discoverTop({ mediaType, decade, genreId, page })),
    );
    const seen = new Set<string>();
    const items = pages
      .flat()
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
      .slice(0, 100);
    return NextResponse.json<TopResponse>({ items, supported: true });
  } catch {
    return NextResponse.json<TopResponse>({ items: [], supported: true });
  }
}
