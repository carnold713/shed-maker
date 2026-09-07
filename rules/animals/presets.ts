import type { Species } from "@/lib/model/schema";

/**
 * Species presets (SPEC §22). Starting defaults from extension guidance;
 * each number is a rule input with its source in Appendix C. Feet.
 */
export interface SpeciesPreset {
  species: Species;
  label: string;
  /** Individual pen minimum and recommended size [w, d]. */
  minPen: [number, number];
  recommendedPen: [number, number];
  /** Group housing, sq ft per head (undefined = individual pens only). */
  groupSqFtPerHead?: number;
  /** Minimum aisle width for this species' handling, feet. */
  aisleMinFt: number;
  aisleRecommendedFt: number;
  /** Stall/pen door width, feet. */
  doorFt: number;
  /** Solid kick-wall height, feet. */
  kickWallFt: number;
  /** Partition top (grille/bars) height, feet. */
  partitionTopFt: number;
  /** Minimum ceiling clear height, feet. */
  ceilingMinFt: number;
  source: `Species:${string}`;
  color: string;
}

export const SPECIES_PRESETS: Record<Species, SpeciesPreset> = {
  horse: { species: "horse", label: "Horse", minPen: [12, 12], recommendedPen: [14, 14], aisleMinFt: 12, aisleRecommendedFt: 14, doorFt: 4, kickWallFt: 4, partitionTopFt: 7.5, ceilingMinFt: 8, source: "Species:extension-equine (Lester/Wick/Armour stall guides)", color: "#c8a27a" },
  pony: { species: "pony", label: "Pony / mini", minPen: [10, 10], recommendedPen: [10, 12], aisleMinFt: 10, aisleRecommendedFt: 12, doorFt: 4, kickWallFt: 3.5, partitionTopFt: 7, ceilingMinFt: 8, source: "Species:extension-equine", color: "#d4b48c" },
  goat: { species: "goat", label: "Goat", minPen: [4, 5], recommendedPen: [5, 6], groupSqFtPerHead: 20, aisleMinFt: 8, aisleRecommendedFt: 10, doorFt: 3, kickWallFt: 4.5, partitionTopFt: 5, ceilingMinFt: 7, source: "Species:NMSU dairy goat housing; UKY AEN-148", color: "#a9c4a0" },
  sheep: { species: "sheep", label: "Sheep", minPen: [4, 4], recommendedPen: [5, 5], groupSqFtPerHead: 16, aisleMinFt: 8, aisleRecommendedFt: 10, doorFt: 3, kickWallFt: 4, partitionTopFt: 4, ceilingMinFt: 7, source: "Species:OSU Sheep Team; UMass sheep housing", color: "#b8c9b1" },
  cattle: { species: "cattle", label: "Cattle", minPen: [10, 10], recommendedPen: [12, 12], groupSqFtPerHead: 20, aisleMinFt: 10, aisleRecommendedFt: 12, doorFt: 5, kickWallFt: 5, partitionTopFt: 5, ceilingMinFt: 9, source: "Species:VersaTube livestock guide", color: "#b39b8a" },
  pig: { species: "pig", label: "Pig", minPen: [5, 7], recommendedPen: [6, 8], groupSqFtPerHead: 10, aisleMinFt: 6, aisleRecommendedFt: 8, doorFt: 3, kickWallFt: 3.5, partitionTopFt: 3.5, ceilingMinFt: 7, source: "Species:extension-swine", color: "#d7b1a8" },
  chicken: { species: "chicken", label: "Chicken", minPen: [4, 4], recommendedPen: [6, 8], groupSqFtPerHead: 4, aisleMinFt: 3, aisleRecommendedFt: 4, doorFt: 2.67, kickWallFt: 2, partitionTopFt: 7, ceilingMinFt: 6.5, source: "Species:extension-poultry (3–4 sq ft/bird)", color: "#e6cf8f" },
  alpaca: { species: "alpaca", label: "Alpaca / llama", minPen: [8, 8], recommendedPen: [10, 10], groupSqFtPerHead: 35, aisleMinFt: 8, aisleRecommendedFt: 10, doorFt: 4, kickWallFt: 4, partitionTopFt: 5, ceilingMinFt: 8, source: "Species:extension-camelid", color: "#c9bfa5" },
  rabbit: { species: "rabbit", label: "Rabbit", minPen: [2, 3], recommendedPen: [3, 4], aisleMinFt: 3, aisleRecommendedFt: 4, doorFt: 2, kickWallFt: 2, partitionTopFt: 3, ceilingMinFt: 6.5, source: "Species:extension-rabbit", color: "#e0d3c2" },
  dog: { species: "dog", label: "Dog kennel", minPen: [4, 6], recommendedPen: [5, 10], aisleMinFt: 4, aisleRecommendedFt: 5, doorFt: 3, kickWallFt: 4, partitionTopFt: 6, ceilingMinFt: 7, source: "Species:extension-kennel", color: "#c7c2d6" },
  generic: { species: "generic", label: "Generic pen", minPen: [4, 4], recommendedPen: [8, 8], aisleMinFt: 4, aisleRecommendedFt: 8, doorFt: 4, kickWallFt: 4, partitionTopFt: 7, ceilingMinFt: 7, source: "Species:none (generic)", color: "#c9c5bd" },
};

export const PEN_SPECIES: Species[] = ["horse", "pony", "goat", "sheep", "cattle", "pig", "chicken", "alpaca", "generic"];
