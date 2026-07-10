import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createCinemetaAdapter } from "@/lib/media/cinemeta";
import { sampleGetTitle } from "@/data/catalog";
import type { MediaType } from "@/lib/media/types";

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "cinemeta";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaType = (req.nextUrl.searchParams.get("mediaType") as MediaType) || "movie";
  if (!id) return NextResponse.json(null, { status: 400 });

  try {
    if (source === "sample") {
      return NextResponse.json(sampleGetTitle(id));
    }
    if (source === "tmdb" && (process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY)) {
      return NextResponse.json(await createTmdbAdapter().getTitle(id, mediaType));
    }
    if (source === "cinemeta") {
      return NextResponse.json(await createCinemetaAdapter().getTitle(id, mediaType));
    }
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
  return NextResponse.json(null, { status: 200 });
}
