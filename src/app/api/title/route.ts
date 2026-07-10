import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { sampleGetTitle } from "@/data/catalog";
import type { MediaType } from "@/lib/media/types";

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "tmdb";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaType = (req.nextUrl.searchParams.get("mediaType") as MediaType) || "movie";
  if (!id) return NextResponse.json(null, { status: 400 });

  if (source === "sample") {
    return NextResponse.json(sampleGetTitle(id));
  }

  const hasTmdb = Boolean(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY);
  if (source === "tmdb" && hasTmdb) {
    try {
      const title = await createTmdbAdapter().getTitle(id, mediaType);
      return NextResponse.json(title);
    } catch {
      return NextResponse.json(null, { status: 200 });
    }
  }
  return NextResponse.json(null, { status: 200 });
}
