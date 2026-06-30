import { NextRequest, NextResponse } from 'next/server';

export type MovieMeta = {
  poster: string | null;
  plot: string | null;
  genres: string[];
  imdbRating: number | null;
  contentRating: string | null;
  runtimeSeconds: number | null;
};

// Cache at the Vercel edge for 24h so the same movie costs 1 request/day
export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get('t')?.trim();
  const year  = req.nextUrl.searchParams.get('y')?.trim();
  if (!title) return NextResponse.json(null);

  const key = process.env.OMDB_API_KEY;
  // No key → silent no-op, app degrades gracefully
  if (!key) return NextResponse.json(null);

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('t', title);
  url.searchParams.set('plot', 'short');
  url.searchParams.set('apikey', key);
  if (year) url.searchParams.set('y', year);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    const d = await res.json() as Record<string, string>;

    // OMDB returns Response:"False" on errors (limit hit, not found, etc.)
    // Never throw — always degrade gracefully
    if (d.Response === 'False') return NextResponse.json(null);

    const runtimeMatch = d.Runtime?.match(/(\d+)/);
    const runtimeSeconds = runtimeMatch ? Number(runtimeMatch[1]) * 60 : null;

    const imdbRating = d.imdbRating && d.imdbRating !== 'N/A' ? parseFloat(d.imdbRating) : null;
    const poster = d.Poster && d.Poster !== 'N/A' ? d.Poster : null;
    const plot = d.Plot && d.Plot !== 'N/A' ? d.Plot : null;
    const contentRating = d.Rated && d.Rated !== 'N/A' ? d.Rated : null;
    const genres = d.Genre && d.Genre !== 'N/A' ? d.Genre.split(', ') : [];

    const meta: MovieMeta = { poster, plot, genres, imdbRating, contentRating, runtimeSeconds };
    return NextResponse.json(meta);
  } catch {
    // Network error, parse error, anything — silent null
    return NextResponse.json(null);
  }
}
