// Decision-card access policy + orchestration (SERVER ONLY). Every guidance
// request flows through getGuidance(), in this order:
//
//   kill switch → entitlement → cache → cost gates → metadata → AI call
//
// The entitlement check sits BEFORE the AI call and before the cache, so a
// free visitor after the beta gets a typed "entitlement_required" response
// and Anthropic is never contacted. The plan is resolved server-side from
// config — nothing the client sends can influence it.

import { planIncludesGuidance, type Plan } from "../entitlements";
import type { MediaTitle } from "../media/types";
import type { GuidanceConfig } from "./config";
import type { ProviderResult } from "./provider";
import type { GuidanceRequest, GuidanceResponse } from "./types";
import type { UsageTracker } from "./usage";

export interface GuidanceServiceDeps {
  config: GuidanceConfig;
  /** Resolved server-side (resolvePlan) — never from request data. */
  plan: Plan;
  usage: UsageTracker;
  cache: { get(key: string): GuidanceResponse | null; set(key: string, body: GuidanceResponse): void };
  fetchTitle(): Promise<MediaTitle | null>;
  generate(req: GuidanceRequest): Promise<ProviderResult>;
}

export async function getGuidance(cacheKey: string, deps: GuidanceServiceDeps): Promise<GuidanceResponse> {
  // 1. Owner emergency stop — beats every plan, no AI call, no cache reads.
  if (deps.config.killSwitch) return { status: "disabled" };

  // 2. Entitlement — checked before the cache so ending the beta really ends
  //    the feature, not just new generations.
  if (!planIncludesGuidance(deps.plan)) return { status: "entitlement_required" };

  // 3. Cached cards are free to serve — no cost gates for them.
  const cached = deps.cache.get(cacheKey);
  if (cached) return cached;

  // 4. Cost controls for NEW generations (in-memory, approximate — see usage.ts).
  const gate = deps.usage.canGenerate();
  if (!gate.ok) return { status: "limit_reached" };

  // 5. Metadata, then the AI call. Attempts are recorded before the call so
  //    failed requests still count against the budget (they may still bill).
  const title = await deps.fetchTitle();
  if (!title) return { status: "no_metadata" };

  deps.usage.record();
  const result = await deps.generate({
    title: title.title,
    releaseYear: title.releaseYear,
    mediaType: title.mediaType === "series" ? "series" : "movie",
    genres: title.genres,
    officialRating: title.officialRating,
    synopsis: title.synopsis,
  });

  const body: GuidanceResponse =
    result.status === "ok" ? { status: "ok", guidance: result.guidance } : { status: result.status };
  if (body.status === "ok") deps.cache.set(cacheKey, body);
  return body;
}
