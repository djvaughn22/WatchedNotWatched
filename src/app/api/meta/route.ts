import { NextRequest, NextResponse } from 'next/server';

export type MovieMeta = {
  poster: string | null;
  plot: string | null;
  genres: string[];
  imdbRating: number | null;
  contentRating: string | null;
  runtimeSeconds: number | null;
};

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const title = reqUrl.searchParams.get('t')?.trim();
  const year  = reqUrl.searchParams.get('y')?.trim();
  if (!title) return NextResponse.json({ _debug: 'no_title', url: req.url });

  const key = process.env.OMDB_API_KEY;
  if (!key) return NextResponse.json({ _debug: 'no_key', allKeys: Object.keys(process.env).filter(k => k.includes('OMDB')) });

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('t', title);
  url.searchParams.set('plot', 'short');
  url.searchParams.set('apikey', key);
  if (year) url.searchParams.set('y', year);

  try {
    const res = await fetch(url.toString());
    const d = await res.json() as Record<string, string>;

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
  } catch (e) {
    return NextResponse.json({ _debug: 'catch', error: String(e) });
  }
}
