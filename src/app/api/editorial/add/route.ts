import { NextRequest, NextResponse } from "next/server";
import { addEditorialDraft } from "@/data/editorial";
import type { SearchResultItem, MediaTitle } from "@/lib/media/types";
import { convertToMediaTitle } from "@/data/editorial";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      source: string;
      sourceId: string;
      item: SearchResultItem;
    };

    if (!body.source || !body.sourceId || !body.item) {
      return NextResponse.json(
        { error: "Missing required fields: source, sourceId, item" },
        { status: 400 },
      );
    }

    const draft = addEditorialDraft(body.source, body.sourceId, body.item);
    const mediaTitle: MediaTitle = convertToMediaTitle(draft);

    return NextResponse.json({ success: true, draft, mediaTitle });
  } catch (err) {
    console.error("Editorial add error:", err);
    return NextResponse.json({ error: "Failed to add to editorial catalog" }, { status: 500 });
  }
}
