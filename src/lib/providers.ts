// Centralized streaming-provider registry + honest handoff builder.
// IMPORTANT: WatchedNotWatched only OPENS links. No provider here has
// account-authentication, playback-control, or automatic-filtering — because
// none of those capabilities genuinely exist yet.

export type ProviderCapability =
  | "availability"
  | "external-search"
  | "verified-title-link"
  | "app-handoff"
  | "official-embed"
  | "account-authentication"
  | "playback-control"
  | "automatic-filtering";

export type IntegrationStatus =
  | "available"
  | "handoff-only"
  | "authorization-required"
  | "planned"
  | "unsupported";

export interface StreamingProviderDefinition {
  id: string;
  name: string;
  status: IntegrationStatus;
  capabilities: ProviderCapability[];
  allowedDomains: string[];
  homepageUrl: string;
  searchUrl?: (query: string) => string;
}

const HANDOFF: ProviderCapability[] = ["availability", "external-search", "app-handoff"];

export const PROVIDERS: Record<string, StreamingProviderDefinition> = {
  netflix: {
    id: "netflix",
    name: "Netflix",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["netflix.com"],
    homepageUrl: "https://www.netflix.com/",
    searchUrl: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  },
  prime: {
    id: "prime",
    name: "Prime Video",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["primevideo.com", "amazon.com"],
    homepageUrl: "https://www.primevideo.com/",
    searchUrl: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(q)}`,
  },
  appletv: {
    id: "appletv",
    name: "Apple TV",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["tv.apple.com", "apple.com"],
    homepageUrl: "https://tv.apple.com/",
    searchUrl: (q) => `https://tv.apple.com/search?term=${encodeURIComponent(q)}`,
  },
  peacock: {
    id: "peacock",
    name: "Peacock",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["peacocktv.com"],
    homepageUrl: "https://www.peacocktv.com/",
    searchUrl: (q) => `https://www.peacocktv.com/search?q=${encodeURIComponent(q)}`,
  },
  paramount: {
    id: "paramount",
    name: "Paramount+",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["paramountplus.com"],
    homepageUrl: "https://www.paramountplus.com/",
    searchUrl: (q) => `https://www.paramountplus.com/search/${encodeURIComponent(q)}/`,
  },
  disney: {
    id: "disney",
    name: "Disney+",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["disneyplus.com"],
    homepageUrl: "https://www.disneyplus.com/",
    searchUrl: (q) => `https://www.disneyplus.com/search?q=${encodeURIComponent(q)}`,
  },
  hulu: {
    id: "hulu",
    name: "Hulu",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["hulu.com"],
    homepageUrl: "https://www.hulu.com/",
    searchUrl: (q) => `https://www.hulu.com/search?q=${encodeURIComponent(q)}`,
  },
  max: {
    id: "max",
    name: "Max",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["max.com"],
    homepageUrl: "https://www.max.com/",
    searchUrl: (q) => `https://play.max.com/search?q=${encodeURIComponent(q)}`,
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    status: "handoff-only",
    capabilities: [...HANDOFF, "official-embed"],
    allowedDomains: ["youtube.com", "youtu.be"],
    homepageUrl: "https://www.youtube.com/",
    searchUrl: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  tubi: {
    id: "tubi",
    name: "Tubi",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["tubitv.com"],
    homepageUrl: "https://tubitv.com/",
    searchUrl: (q) => `https://tubitv.com/search/${encodeURIComponent(q)}`,
  },
  pluto: {
    id: "pluto",
    name: "Pluto TV",
    status: "handoff-only",
    capabilities: HANDOFF,
    allowedDomains: ["pluto.tv"],
    homepageUrl: "https://pluto.tv/",
    searchUrl: (q) => `https://pluto.tv/en/search/details?query=${encodeURIComponent(q)}`,
  },
};

export function getProvider(id: string): StreamingProviderDefinition | undefined {
  return PROVIDERS[id];
}

// ---- Handoff building --------------------------------------------------
export interface ProviderHandoff {
  providerId: string;
  providerName: string;
  type: "verified-title" | "provider-search" | "watch-options" | "provider-home" | "unavailable";
  url?: string;
  label: string;
  note?: string;
}

// Only https, and only to a domain the provider actually owns. Guards against
// open redirects / spoofed hosts sneaking into a "verified" link.
export function isSafeProviderUrl(url: string | undefined, provider: StreamingProviderDefinition): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return provider.allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

export interface HandoffInput {
  providerId: string;
  title: string;
  verifiedTitleUrl?: string; // a provider deep link we trust
  watchOptionsUrl?: string; // e.g. a TMDB/JustWatch watch page for the title
}

// Priority: verified title link → provider search → watch-options → home.
export function buildHandoff(input: HandoffInput): ProviderHandoff {
  const provider = PROVIDERS[input.providerId];
  if (!provider) {
    return { providerId: input.providerId, providerName: input.providerId, type: "unavailable", label: "Unavailable" };
  }

  if (isSafeProviderUrl(input.verifiedTitleUrl, provider)) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: "verified-title",
      url: input.verifiedTitleUrl,
      label: `Watch on ${provider.name}`,
    };
  }

  if (provider.searchUrl) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: "provider-search",
      url: provider.searchUrl(input.title),
      label: `Search ${provider.name}`,
      note: "Availability and subscriptions vary by region and provider.",
    };
  }

  if (input.watchOptionsUrl && /^https:\/\//i.test(input.watchOptionsUrl)) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: "watch-options",
      url: input.watchOptionsUrl,
      label: "View watch options",
      note: "Availability and subscriptions vary by region and provider.",
    };
  }

  return {
    providerId: provider.id,
    providerName: provider.name,
    type: "provider-home",
    url: provider.homepageUrl,
    label: `Open ${provider.name}`,
    note: "Availability and subscriptions vary by region and provider.",
  };
}
