import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createTvmazeAdapter } from "@/lib/media/tvmaze";
import { createWikidataAdapter } from "@/lib/media/wikidata";
import type { MediaType } from "@/lib/media/types";

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "tmdb";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaType = (req.nextUrl.searchParams.get("mediaType") as MediaType) || "movie";
  if (!id) return NextResponse.json(null, { status: 400 });

  try {
    if (source === "tmdb") {
      return NextResponse.json(await createTmdbAdapter().getTitle(id, mediaType));
    }
    if (source === "tvmaze") {
      return NextResponse.json(await createTvmazeAdapter().getTitle(id, mediaType));
    }
    // Legacy ids from earlier versions of the app.
    if (source === "wikidata") {
      return NextResponse.json(await createWikidataAdapter().getTitle(id, mediaType));
    }
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
  return NextResponse.json(null, { status: 200 });
}
