// Source registry: commercial terms, licenses, and attribution rules.
// All searches and metadata must attribute to the source that provided it.

export interface MediaSource {
  id: string; // "tvmaze", "wikidata", "youtube", etc.
  name: string;
  license: string; // e.g. "CC0", "proprietary", "free-keyless"
  commercial: "approved" | "restricted" | "rejected";
  attribution: {
    required: boolean;
    text: string;
    url?: string;
  };
}

export const MEDIA_SOURCES: Record<string, MediaSource> = {
  watched_not_watched: {
    id: "watched_not_watched",
    name: "WatchedNotWatched Editorial",
    license: "Proprietary",
    commercial: "approved",
    attribution: {
      required: true,
      text: "Reviewed by WatchedNotWatched",
    },
  },

  tvmaze: {
    id: "tvmaze",
    name: "TVmaze",
    license: "Free API",
    commercial: "approved",
    attribution: {
      required: true,
      text: "Television data from TVmaze.",
      url: "https://www.tvmaze.com/",
    },
  },

  wikidata: {
    id: "wikidata",
    name: "Wikidata",
    license: "CC0 1.0 Universal",
    commercial: "approved",
    attribution: {
      required: true,
      text: "Title data from Wikidata (CC0 1.0).",
      url: "https://www.wikidata.org/",
    },
  },

  youtube: {
    id: "youtube",
    name: "YouTube",
    license: "Proprietary",
    commercial: "approved",
    attribution: {
      required: true,
      text: "Trailer via YouTube.",
      url: "https://www.youtube.com/",
    },
  },

  tmdb: {
    id: "tmdb",
    name: "The Movie Database (TMDB)",
    license: "Free with attribution while non-commercial",
    // "restricted" = fine while the app is free with attribution; charging
    // money requires TMDB's commercial license (~$149/mo) FIRST.
    commercial: "restricted",
    attribution: {
      required: true,
      text: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
      url: "https://www.themoviedb.org/",
    },
  },

  justwatch: {
    id: "justwatch",
    name: "JustWatch",
    license: "Via TMDB watch-providers endpoint",
    commercial: "restricted",
    attribution: {
      required: true,
      text: "Streaming availability data provided by JustWatch.",
      url: "https://www.justwatch.com/",
    },
  },

  // Rejected sources

  cinemeta: {
    id: "cinemeta",
    name: "Cinemeta / IMDb",
    license: "IMDb data",
    commercial: "rejected",
    attribution: {
      required: false,
      text: "Cinemeta/IMDb: restricted for commercial products.",
    },
  },

  imdb: {
    id: "imdb",
    name: "IMDb",
    license: "Proprietary",
    commercial: "rejected",
    attribution: {
      required: false,
      text: "IMDb: restricted for commercial use.",
    },
  },

  omdb: {
    id: "omdb",
    name: "OMDb API",
    license: "Proprietary",
    commercial: "rejected",
    attribution: {
      required: false,
      text: "OMDb: restricted for commercial products.",
    },
  },

  stremio: {
    id: "stremio",
    name: "Stremio / Cinemeta",
    license: "Proprietary",
    commercial: "rejected",
    attribution: {
      required: false,
      text: "Stremio metadata: not for commercial redistribution.",
    },
  },
};

export function getSource(id: string): MediaSource | undefined {
  return MEDIA_SOURCES[id];
}

export function isCommercialApproved(sourceId: string): boolean {
  const source = getSource(sourceId);
  return source ? source.commercial === "approved" : false;
}
