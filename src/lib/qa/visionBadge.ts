export type VisionBadgeColor = "green" | "yellow" | "red" | "none";

// Vision-QA-Score -> Badge-Farbe.
// Cutoffs: >=0.8 gruen (gut), 0.5..0.8 gelb (review), <0.5 rot (nachbessern).
// null/undefined = noch nicht analysiert -> 'none'.
export function visionBadgeColor(
  score: number | null | undefined
): VisionBadgeColor {
  if (score === null || score === undefined) return "none";
  if (score >= 0.8) return "green";
  if (score >= 0.5) return "yellow";
  return "red";
}
