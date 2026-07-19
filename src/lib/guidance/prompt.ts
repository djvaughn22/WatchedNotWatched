// Centralized prompt + response schema for the decision card. SERVER ONLY.
// Every rule that keeps the output spoiler-free and honest lives here, in one
// place, and is covered by tests.

import { ATTENTIONS, CATEGORY_IDS, LEVELS, OCCASIONS, PACINGS, TONES, type GuidanceRequest } from "./types";

export const SPOILER_RULES = `Never reveal spoilers of any kind. That includes: plot twists, endings or outcomes, character identities or true allegiances, deaths, who ends up with whom, relationship reveals, and any development from the middle or end of the story. Do not summarize the plot. Describe the viewing EXPERIENCE, not the story.`;

export const HONESTY_RULES = `Be honest about uncertainty. If you are not confident about a content category for this specific title, set its level to "unknown" and leave its note empty — never guess or invent content details. Never invent an official rating. This guidance helps people decide; it is not an official rating and may not capture every concern, so do not overstate certainty.`;

export const GUIDANCE_SYSTEM_PROMPT = `You write short, spoiler-free viewing-decision guidance for WatchedNotWatched, a personal watch list site. Your job is to answer one question better than a synopsis, rating, or review score can: "Do I want to watch this?" — for this person, this family, this particular night.

${SPOILER_RULES}

${HONESTY_RULES}

Style: plain, direct, human. No marketing copy, no hype, no filler. Speak to the viewer ("Watch this when… Skip it tonight if…").

Sections you produce:
- quickTake: 1–3 sharp sentences saying who this title is good for and when someone might want to skip it.
- categories: for each of the six content categories, a level (none/mild/moderate/strong/high, or unknown when unsure) and one brief, non-graphic, spoiler-free description. No graphic or unnecessary detail.
- bestFit: one practical viewer or family recommendation (e.g. "Mature teens and adults who enjoy challenging psychological mysteries.").
- deepDive: ONE concise paragraph on the type of viewing experience: how much attention it demands, its general tone, who may enjoy it, who may want to skip it, and what kind of night it fits. Not a plot synopsis.
- attention / tone / pacing / occasions: your honest classification of the experience.`;

const CATEGORY_HINTS: Record<(typeof CATEGORY_IDS)[number], string> = {
  violence: "Violence",
  language: "Language (profanity, slurs)",
  sexual_content: "Sexual Content",
  scary_intense: "Scary or Intense (fear, tension, disturbing imagery)",
  substances: "Drugs and Alcohol",
  mature_themes: "Mature Themes (grief, abuse, moral ambiguity, etc.)",
};

/** The user turn: title metadata only. Never includes viewer preferences or personal data. */
export function buildUserPrompt(req: GuidanceRequest): string {
  const lines = [
    `Title: ${req.title}`,
    `Type: ${req.mediaType === "series" ? "TV series" : "Movie"}`,
  ];
  if (req.releaseYear) lines.push(`Release year: ${req.releaseYear}`);
  if (req.genres?.length) lines.push(`Genres: ${req.genres.join(", ")}`);
  lines.push(
    req.officialRating
      ? `Official content rating (from metadata): ${req.officialRating}`
      : `Official content rating: not available — do not invent one.`,
  );
  if (req.synopsis) lines.push(`Official synopsis (context only — do NOT restate it): ${req.synopsis}`);
  lines.push(
    "",
    `Categories to assess: ${CATEGORY_IDS.map((id) => `${id} = ${CATEGORY_HINTS[id]}`).join("; ")}.`,
    `Produce the guidance JSON now. Remember: spoiler-free, honest about uncertainty.`,
  );
  return lines.join("\n");
}

/** JSON schema for structured output — keeps the model's response parseable. */
export const GUIDANCE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["quickTake", "categories", "bestFit", "deepDive", "attention", "tone", "pacing", "occasions"],
  properties: {
    quickTake: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "level", "note"],
        properties: {
          id: { type: "string", enum: [...CATEGORY_IDS] },
          level: { type: "string", enum: [...LEVELS] },
          note: { type: "string" },
        },
      },
    },
    bestFit: { type: "string" },
    deepDive: { type: "string" },
    attention: { type: "string", enum: [...ATTENTIONS] },
    tone: { type: "string", enum: [...TONES] },
    pacing: { type: "string", enum: [...PACINGS] },
    occasions: { type: "array", items: { type: "string", enum: [...OCCASIONS] } },
  },
} as const;
