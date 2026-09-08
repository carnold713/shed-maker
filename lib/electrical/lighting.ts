/**
 * Illuminance targets by area type, foot-candles, and the lumen method
 * used to size lighting (ASABE EP344.4 "Lighting Systems for Agricultural
 * Facilities"; MWPS-1 lighting chapter). Barns are dark, dusty spaces, so a
 * combined coefficient of utilisation × light-loss factor of 0.5 is used —
 * conservative for painted rooms, about right for bare wood and steel.
 */
import type { ZoneType } from "@/lib/model/schema";

export const TARGET_FC: Record<ZoneType, number> = {
  aisle: 20,
  pen: 10,
  kidding: 20,
  tack: 30,
  feed: 30,
  hay: 10,
  wash: 30,
  equipment: 20,
  office: 50,
  utility: 30,
  milking: 50,
  restroom: 30,
  open: 10,
};

/** LED efficacy used for fixture sizing, lumens per watt (vapor-tight strip / high-bay class). */
export const LM_PER_W = 110;
/** Coefficient of utilisation × light-loss factor. */
export const CU_LLF = 0.5;

export function lumensNeeded(type: ZoneType, sqFt: number): number {
  return (TARGET_FC[type] * sqFt) / CU_LLF;
}

export function lumensOf(watts: number): number {
  return watts * LM_PER_W;
}
