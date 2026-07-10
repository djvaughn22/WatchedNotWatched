import { NextRequest, NextResponse } from "next/server";
import type { TrailerReference } from "@/lib/media/types";

interface TrailerResponse {
  configured: boolean;
  trailer: TrailerReference | null;
  searchUrl: string; // always safe: open a YouTube search
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim() ?? "";
  const year = req.nextUrl.searchParams.get("year")?.trim() ?? "";
  const query = `${title} ${year} official trailer`.trim();
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  if (!title) {
    return NextResponse.json<TrailerResponse>({ configured: false, trailer: null, searchUrl });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json<TrailerResponse>({ configured: false, trailer: null, searchUrl });
  }

  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true` +
    `&maxResults=5&q=${encodeURIComponent(query)}&key=${key}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json<TrailerResponse>({ configured: true, trailer: null, searchUrl });
    const data = (await res.json()) as {
      items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }>;
    };
    const items = (data.items ?? []).filter((i) => i.id?.videoId);
    if (items.length === 0) return NextResponse.json<TrailerResponse>({ configured: true, trailer: null, searchUrl });

    // Prefer a result whose title reads as an official trailer.
    const officialish = items.find((i) => /official trailer/i.test(i.snippet?.title ?? ""));
    const chosen = officialish ?? items[0];
    const vidTitle = chosen.snippet?.title ?? "Trailer";
    const trailer: TrailerReference = {
      youtubeId: chosen.id!.videoId!,
      title: vidTitle,
      channelTitle: chosen.snippet?.channelTitle,
      // Conservative: only claim "official" with adequate evidence.
      official: /official trailer/i.test(vidTitle),
    };
    return NextResponse.json<TrailerResponse>({ configured: true, trailer, searchUrl });
  } catch {
    return NextResponse.json<TrailerResponse>({ configured: true, trailer: null, searchUrl });
  } finally {
    clearTimeout(timer);
  }
}
