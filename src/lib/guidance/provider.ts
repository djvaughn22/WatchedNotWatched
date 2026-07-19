// AI provider for the decision card (SERVER ONLY — only import from API
// routes). Smallest clean abstraction: one function, one provider (Anthropic),
// typed failure states instead of thrown errors, so the title page can never
// crash because of AI.
//
// Env (server only, never exposed to the client):
//   ANTHROPIC_API_KEY — required for live guidance; absent = "unconfigured".
//   WNW_AI_MODEL      — optional model override (default claude-opus-4-8).

import Anthropic from "@anthropic-ai/sdk";
import { buildUserPrompt, GUIDANCE_JSON_SCHEMA, GUIDANCE_SYSTEM_PROMPT } from "./prompt";
import { parseGuidance, type GuidanceRequest, type TitleGuidance } from "./types";

export const DEFAULT_MODEL = "claude-opus-4-8";

export type ProviderResult =
  | { status: "ok"; guidance: TitleGuidance }
  | { status: "unconfigured" }
  | { status: "rate_limited" }
  | { status: "error" };

/** Injectable for tests: takes the prompts, returns the model's raw JSON text. */
export type ModelCall = (args: {
  model: string;
  system: string;
  user: string;
}) => Promise<string>;

async function callAnthropic({ model, system, user }: { model: string; system: string; user: string }): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY server-side
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: {
      format: { type: "json_schema", schema: GUIDANCE_JSON_SCHEMA },
    },
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("refused"), { status: 422 });
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("empty response");
  return text;
}

/**
 * Generate generic (non-personalized) guidance for one title. Never throws.
 * Callers cache the "ok" results; failures are typed so the UI can offer the
 * right fallback (retry, "try later", or "AI not set up yet").
 */
export async function generateGuidance(
  req: GuidanceRequest,
  call: ModelCall = callAnthropic,
): Promise<ProviderResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "unconfigured" };
  if (!req.title?.trim()) return { status: "error" };

  const model = process.env.WNW_AI_MODEL || DEFAULT_MODEL;
  let text: string;
  try {
    text = await call({ model, system: GUIDANCE_SYSTEM_PROMPT, user: buildUserPrompt(req) });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429 || status === 529) return { status: "rate_limited" };
    return { status: "error" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: "error" };
  }
  const guidance = parseGuidance(parsed);
  if (!guidance) return { status: "error" };
  return { status: "ok", guidance };
}
