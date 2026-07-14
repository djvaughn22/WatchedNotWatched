import { NextRequest, NextResponse } from "next/server";

// Email list signup → Resend Audience. Needs RESEND_API_KEY and
// RESEND_AUDIENCE_ID (create the audience in the Resend dashboard). Until
// both exist, GET reports enabled:false and the homepage section hides
// itself — same pattern as the TMDB-backed routes. Dev runs keyless with a
// fake accept so the UI is testable.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function config() {
  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  return { key, audienceId, enabled: Boolean(key && audienceId) };
}

export async function GET() {
  const { enabled } = config();
  if (!enabled && process.env.NODE_ENV === "development") {
    return NextResponse.json({ enabled: true });
  }
  return NextResponse.json({ enabled });
}

export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = await req.json();
    if (typeof body?.email === "string") email = body.email.trim().toLowerCase();
  } catch {
    /* fall through to invalid */
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const { key, audienceId, enabled } = config();
  if (!enabled) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[subscribe] dev keyless accept: ${email}`);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    // Already on the list counts as success — the user got what they wanted.
    if (res.ok || res.status === 409) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  } catch {
    return NextResponse.json({ ok: false, error: "upstream" }, { status: 502 });
  }
}
