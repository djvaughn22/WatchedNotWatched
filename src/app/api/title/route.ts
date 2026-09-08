import { NextRequest, NextResponse } from "next/server";
import { createTmdbAdapter } from "@/lib/media/tmdb";
import { createTvmazeAdapter } from "@/lib/media/tvmaze";
import { createWikidataAdapter } from "@/lib/media/wikidata";
import { getTitleCore, getTitleExtended, OpenLibraryNotFoundError, type TitleExtendedPatch } from "@/lib/media/openlibrary";
import type { MediaTitle, MediaType } from "@/lib/media/types";

// Open Library's work.json is sometimes slow (2-10s+); the adapter retries
// once internally. Give the route real headroom rather than racing the
// platform's default function timeout — that race is the reported bug.
export const maxDuration = 20;

export type TitleResponse =
  | { status: "ok"; title: MediaTitle }
  | { status: "not_found" } // Open Library (or the adapter) confirmed this id does not exist
  | { status: "unavailable" }; // timeout / network / 5xx — retryable, NOT a 404

export type TitleExtendedResponse = { status: "ok"; patch: TitleExtendedPatch } | { status: "unavailable" };

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "tmdb";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const mediaType = (req.nextUrl.searchParams.get("mediaType") as MediaType) || "movie";
  const tier = req.nextUrl.searchParams.get("tier");
  if (!id) return NextResponse.json<TitleResponse>({ status: "not_found" }, { status: 400 });

  if (source === "openlibrary") {
    if (tier === "extended") {
      try {
        const patch = await getTitleExtended(id, req.signal);
        return NextResponse.json<TitleExtendedResponse>({ status: "ok", patch });
      } catch {
        return NextResponse.json<TitleExtendedResponse>({ status: "unavailable" });
      }
    }
    try {
      const title = await getTitleCore(id, req.signal);
      return NextResponse.json<TitleResponse>({ status: "ok", title });
    } catch (e) {
      if (e instanceof OpenLibraryNotFoundError) return NextResponse.json<TitleResponse>({ status: "not_found" });
      return NextResponse.json<TitleResponse>({ status: "unavailable" });
    }
  }

  try {
    let title: MediaTitle | null = null;
    if (source === "tmdb") title = await createTmdbAdapter().getTitle(id, mediaType);
    else if (source === "tvmaze") title = await createTvmazeAdapter().getTitle(id, mediaType);
    // Legacy ids from earlier versions of the app.
    else if (source === "wikidata") title = await createWikidataAdapter().getTitle(id, mediaType);
    if (!title) return NextResponse.json<TitleResponse>({ status: "not_found" });
    return NextResponse.json<TitleResponse>({ status: "ok", title });
  } catch {
    return NextResponse.json<TitleResponse>({ status: "unavailable" });
  }
}
