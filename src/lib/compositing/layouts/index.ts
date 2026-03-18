// Layout-Definitionen fuer Server-Side Compositing
// Pro Channel/Format: Dimensionen, Hero-Zone, Text-Zonen, Overlay

export interface TextZone {
  field: string;          // Schluessel aus content dict
  top: number;
  left: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight?: string;
  align?: "left" | "center" | "right";
}

export interface LayoutDefinition {
  width: number;
  height: number;
  heroZone?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  overlay?: {
    top: number;
    left: number;
    width: number;
    height: number;
    opacity: number;
  };
  textZones: TextZone[];
}

// Social Feed (1080x1080)
const SOCIAL_FEED: LayoutDefinition = {
  width: 1080,
  height: 1080,
  heroZone: { top: 0, left: 0, width: 1080, height: 700 },
  overlay: { top: 700, left: 0, width: 1080, height: 380, opacity: 0.9 },
  textZones: [
    { field: "claim", top: 720, left: 40, width: 1000, height: 60, fontSize: 36, fontWeight: "bold", align: "center" },
    { field: "hero_message", top: 790, left: 60, width: 960, height: 50, fontSize: 24, align: "center" },
    { field: "cta", top: 880, left: 340, width: 400, height: 50, fontSize: 22, fontWeight: "bold", align: "center" },
  ],
};

// Social Story (1080x1920)
const SOCIAL_STORY: LayoutDefinition = {
  width: 1080,
  height: 1920,
  heroZone: { top: 0, left: 0, width: 1080, height: 1200 },
  overlay: { top: 1200, left: 0, width: 1080, height: 720, opacity: 0.9 },
  textZones: [
    { field: "hook", top: 1240, left: 60, width: 960, height: 80, fontSize: 40, fontWeight: "bold", align: "center" },
    { field: "claim", top: 1360, left: 60, width: 960, height: 60, fontSize: 28, align: "center" },
    { field: "cta", top: 1520, left: 290, width: 500, height: 60, fontSize: 28, fontWeight: "bold", align: "center" },
  ],
};

// CRM Newsletter (600x400)
const CRM_NEWSLETTER: LayoutDefinition = {
  width: 600,
  height: 400,
  heroZone: { top: 0, left: 0, width: 600, height: 250 },
  overlay: { top: 250, left: 0, width: 600, height: 150, opacity: 0.95 },
  textZones: [
    { field: "headline", top: 260, left: 20, width: 560, height: 40, fontSize: 22, fontWeight: "bold" },
    { field: "claim", top: 310, left: 20, width: 400, height: 30, fontSize: 16 },
    { field: "cta", top: 350, left: 20, width: 200, height: 30, fontSize: 16, fontWeight: "bold" },
  ],
};

// CRM Hero (600x200)
const CRM_HERO: LayoutDefinition = {
  width: 600,
  height: 200,
  heroZone: { top: 0, left: 0, width: 600, height: 200 },
  overlay: { top: 0, left: 0, width: 600, height: 200, opacity: 0.4 },
  textZones: [
    { field: "headline", top: 50, left: 30, width: 540, height: 50, fontSize: 28, fontWeight: "bold", align: "center" },
    { field: "claim", top: 110, left: 50, width: 500, height: 40, fontSize: 18, align: "center" },
  ],
};

// Website Banner (1920x600)
const WEBSITE_BANNER: LayoutDefinition = {
  width: 1920,
  height: 600,
  heroZone: { top: 0, left: 0, width: 1920, height: 600 },
  overlay: { top: 0, left: 0, width: 800, height: 600, opacity: 0.7 },
  textZones: [
    { field: "hero_headline", top: 150, left: 60, width: 680, height: 80, fontSize: 48, fontWeight: "bold" },
    { field: "hero_subline", top: 250, left: 60, width: 680, height: 60, fontSize: 24 },
    { field: "cta_primary", top: 380, left: 60, width: 300, height: 50, fontSize: 22, fontWeight: "bold" },
  ],
};

// Website Hero (1440x600)
const WEBSITE_HERO: LayoutDefinition = {
  width: 1440,
  height: 600,
  heroZone: { top: 0, left: 0, width: 1440, height: 600 },
  overlay: { top: 0, left: 0, width: 700, height: 600, opacity: 0.7 },
  textZones: [
    { field: "hero_headline", top: 140, left: 50, width: 600, height: 80, fontSize: 44, fontWeight: "bold" },
    { field: "hero_subline", top: 240, left: 50, width: 600, height: 50, fontSize: 22 },
    { field: "cta_primary", top: 350, left: 50, width: 280, height: 50, fontSize: 20, fontWeight: "bold" },
  ],
};

// Print Poster (2480x3508 — A4 @ 300dpi)
const PRINT_POSTER: LayoutDefinition = {
  width: 2480,
  height: 3508,
  heroZone: { top: 0, left: 0, width: 2480, height: 2200 },
  overlay: { top: 2200, left: 0, width: 2480, height: 1308, opacity: 0.95 },
  textZones: [
    { field: "headline", top: 2280, left: 120, width: 2240, height: 120, fontSize: 72, fontWeight: "bold", align: "center" },
    { field: "subline", top: 2440, left: 160, width: 2160, height: 80, fontSize: 42, align: "center" },
    { field: "claim", top: 2580, left: 200, width: 2080, height: 60, fontSize: 36, align: "center" },
    { field: "pflichttext", top: 3300, left: 120, width: 2240, height: 40, fontSize: 16 },
  ],
};

// Fallback Layout
const DEFAULT_LAYOUT: LayoutDefinition = {
  width: 1080,
  height: 1080,
  heroZone: { top: 0, left: 0, width: 1080, height: 700 },
  overlay: { top: 700, left: 0, width: 1080, height: 380, opacity: 0.9 },
  textZones: [
    { field: "claim", top: 730, left: 40, width: 1000, height: 60, fontSize: 32, fontWeight: "bold", align: "center" },
    { field: "hero_message", top: 810, left: 60, width: 960, height: 50, fontSize: 22, align: "center" },
  ],
};

// Layout-Matrix
const LAYOUTS: Record<string, Record<string, LayoutDefinition>> = {
  social: {
    feed: SOCIAL_FEED,
    story: SOCIAL_STORY,
  },
  crm: {
    newsletter: CRM_NEWSLETTER,
    hero: CRM_HERO,
  },
  website: {
    banner: WEBSITE_BANNER,
    hero: WEBSITE_HERO,
  },
  print: {
    poster: PRINT_POSTER,
  },
};

export function getLayoutForFormat(channel: string, format: string): LayoutDefinition {
  return LAYOUTS[channel]?.[format] ?? DEFAULT_LAYOUT;
}

export function getAllLayouts(): Record<string, Record<string, LayoutDefinition>> {
  return LAYOUTS;
}
