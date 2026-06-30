// OMDB calls moved to client-side (NEXT_PUBLIC_OMDB_API_KEY).
// This route is kept as a no-op placeholder so existing imports don't break.
import { NextResponse } from 'next/server';

export type MovieMeta = {
  poster: string | null;
  plot: string | null;
  genres: string[];
  imdbRating: number | null;
  contentRating: string | null;
  runtimeSeconds: number | null;
};

export async function GET() {
  return NextResponse.json(null);
}
