import { NextRequest, NextResponse } from 'next/server';

export type SearchResult = {
  tmdbId: number;
  name: string;
  year: number | null;
  mediaType: 'movie' | 'tv';
  poster: string | null;
  overview: string;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    // No key: return empty so the companion falls back to local titles
    return NextResponse.json({ error: 'no_key' }, { status: 200 });
  }

  const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json() as {
      results: Array<{
        id: number;
        title?: string;
        name?: string;
        release_date?: string;
        first_air_date?: string;
        media_type: string;
        poster_path?: string;
        overview?: string;
      }>;
    };

    const results: SearchResult[] = (data.results ?? [])
      .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 8)
      .map((r) => ({
        tmdbId: r.id,
        name: (r.title ?? r.name ?? '').trim(),
        year: r.release_date
          ? Number(r.release_date.slice(0, 4))
          : r.first_air_date
          ? Number(r.first_air_date.slice(0, 4))
          : null,
        mediaType: r.media_type as 'movie' | 'tv',
        poster: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : null,
        overview: r.overview ?? '',
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
