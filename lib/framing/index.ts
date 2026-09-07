import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "./types";
import { generatePostFrame } from "./postFrame";
import { generateStickFrame } from "./stickFrame";

export * from "./types";
export * from "./roofMath";
export { postLinesForWall, JAMB_POST_MIN_WIDTH_FT } from "./postFrame";
export { headerSizeFor } from "./stickFrame";
export { wallFrame, wallLocalToWorld, openingSpans, freeSegments } from "./wallFrame";

/** Derive the complete framing set for the model. Pure; memoise at the call site. */
export function deriveFraming(model: BuildingModel): FramingSet {
  switch (model.frame.system) {
    case "stickFrame":
      return generateStickFrame(model);
    case "postFrame":
    case "hybrid":
    default:
      return generatePostFrame(model);
  }
}
