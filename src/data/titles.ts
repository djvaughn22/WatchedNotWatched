export type FilterCategory =
  | 'Profanity'
  | 'Sex / Nudity'
  | 'Gore & Violence'
  | 'Blasphemy'
  | 'Drugs & Alcohol'
  | 'Scary Scenes';

export type FilterAction = 'mute' | 'skip';

export type FilterEvent = {
  at: number;        // seconds from episode/movie start
  duration: number;  // seconds to mute (or seconds to skip forward for 'skip')
  action: FilterAction;
  category: FilterCategory;
  label: string;
};

export type Title = {
  id: string;
  name: string;
  year: number;
  type: 'Movie' | 'Series';
  platform: string;
  runtime: number; // total seconds
  events: FilterEvent[];
};

export const TITLES: Title[] = [
  {
    id: 'the-bear-s1e1',
    name: 'The Bear — S1E1 "System"',
    year: 2022,
    type: 'Series',
    platform: 'Hulu',
    runtime: 2160, // 36 min
    events: [
      { at: 47,   duration: 3,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 134,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'F-word exchange' },
      { at: 198,  duration: 4,  action: 'mute', category: 'Profanity',      label: 'Profanity-heavy argument' },
      { at: 312,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 410,  duration: 3,  action: 'mute', category: 'Profanity',      label: 'Prolonged profanity' },
      { at: 502,  duration: 2,  action: 'mute', category: 'Drugs & Alcohol', label: 'Drug reference' },
      { at: 620,  duration: 3,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 781,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'F-word' },
      { at: 890,  duration: 20, action: 'skip', category: 'Gore & Violence', label: 'Graphic flashback sequence' },
      { at: 1100, duration: 3,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 1380, duration: 2,  action: 'mute', category: 'Profanity',      label: 'F-word' },
      { at: 1502, duration: 3,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 1750, duration: 2,  action: 'mute', category: 'Drugs & Alcohol', label: 'Drug reference dialogue' },
      { at: 1900, duration: 3,  action: 'mute', category: 'Profanity',      label: 'Profanity' },
      { at: 2050, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
    ],
  },
  {
    id: 'top-gun-maverick',
    name: 'Top Gun: Maverick',
    year: 2022,
    type: 'Movie',
    platform: 'Paramount+',
    runtime: 8220, // 137 min
    events: [
      { at: 183,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 520,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief profanity' },
      { at: 1040, duration: 15, action: 'skip', category: 'Sex / Nudity',   label: 'Intimate scene — brief' },
      { at: 1240, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 2100, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief profanity' },
      { at: 3300, duration: 25, action: 'skip', category: 'Gore & Violence', label: 'Combat sequence — intense' },
      { at: 4200, duration: 2,  action: 'mute', category: 'Profanity',      label: 'F-word' },
      { at: 5100, duration: 30, action: 'skip', category: 'Gore & Violence', label: 'Extended combat — aircraft destruction' },
      { at: 6200, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief profanity' },
      { at: 7100, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
    ],
  },
  {
    id: 'stranger-things-s1e1',
    name: 'Stranger Things — S1E1 "The Vanishing"',
    year: 2016,
    type: 'Series',
    platform: 'Netflix',
    runtime: 2940, // 49 min
    events: [
      { at: 60,   duration: 25, action: 'skip', category: 'Scary Scenes',   label: 'Creature — opening horror sequence' },
      { at: 280,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 520,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief profanity' },
      { at: 800,  duration: 30, action: 'skip', category: 'Scary Scenes',   label: 'Intense monster scene' },
      { at: 1100, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Language' },
      { at: 1400, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 1620, duration: 20, action: 'skip', category: 'Scary Scenes',   label: 'Jump scare — dark sequence' },
      { at: 1900, duration: 2,  action: 'mute', category: 'Profanity',      label: 'F-word' },
      { at: 2200, duration: 15, action: 'skip', category: 'Gore & Violence', label: 'Violent scene' },
      { at: 2500, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief profanity' },
      { at: 2750, duration: 30, action: 'skip', category: 'Scary Scenes',   label: 'Extended monster sequence — climax' },
    ],
  },
  {
    id: 'avengers-2012',
    name: 'The Avengers',
    year: 2012,
    type: 'Movie',
    platform: 'Disney+',
    runtime: 8580, // 143 min
    events: [
      { at: 240,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief language' },
      { at: 810,  duration: 20, action: 'skip', category: 'Gore & Violence', label: 'Intense action — graphic violence' },
      { at: 1500, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Language' },
      { at: 2400, duration: 15, action: 'skip', category: 'Gore & Violence', label: 'Battle sequence — intense' },
      { at: 3100, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 4200, duration: 2,  action: 'mute', category: 'Blasphemy',      label: 'Blasphemy' },
      { at: 5100, duration: 30, action: 'skip', category: 'Gore & Violence', label: 'Hulk rage sequence — graphic' },
      { at: 6000, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Language' },
      { at: 7200, duration: 60, action: 'skip', category: 'Gore & Violence', label: 'Major battle climax — extended violence' },
      { at: 7800, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief language' },
    ],
  },
  {
    id: 'barbie-2023',
    name: 'Barbie',
    year: 2023,
    type: 'Movie',
    platform: 'Max',
    runtime: 6900, // 115 min
    events: [
      { at: 180,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief language' },
      { at: 620,  duration: 15, action: 'skip', category: 'Sex / Nudity',   label: 'Brief suggestive content' },
      { at: 900,  duration: 2,  action: 'mute', category: 'Profanity',      label: 'Language' },
      { at: 1400, duration: 2,  action: 'mute', category: 'Blasphemy',      label: 'Blasphemy reference' },
      { at: 2100, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Strong language' },
      { at: 2800, duration: 10, action: 'skip', category: 'Sex / Nudity',   label: 'Adult humor — suggestive' },
      { at: 3600, duration: 2,  action: 'mute', category: 'Profanity',      label: 'F-word' },
      { at: 4500, duration: 2,  action: 'mute', category: 'Drugs & Alcohol', label: 'Alcohol reference' },
      { at: 5200, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Language' },
      { at: 6100, duration: 2,  action: 'mute', category: 'Profanity',      label: 'Brief language' },
    ],
  },
  {
    id: 'moana-2',
    name: 'Moana 2',
    year: 2024,
    type: 'Movie',
    platform: 'Disney+',
    runtime: 5760, // 96 min
    events: [
      { at: 420,  duration: 20, action: 'skip', category: 'Scary Scenes',   label: 'Sea creature — frightening visuals' },
      { at: 1100, duration: 15, action: 'skip', category: 'Scary Scenes',   label: 'Tense dark sequence' },
      { at: 2200, duration: 20, action: 'skip', category: 'Scary Scenes',   label: 'Monster encounter' },
      { at: 3100, duration: 10, action: 'skip', category: 'Gore & Violence', label: 'Brief intense action' },
      { at: 4200, duration: 25, action: 'skip', category: 'Scary Scenes',   label: 'Villain climax sequence — intense' },
      { at: 5000, duration: 2,  action: 'mute', category: 'Blasphemy',      label: 'Deity reference' },
    ],
  },
];
