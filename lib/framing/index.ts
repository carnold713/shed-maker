import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "./types";
import { generatePostFrame } from "./postFrame";
import { generateStickFrame } from "./stickFrame";
import { generateLeanTos } from "./leanTo";

export * from "./types";
export * from "./roofMath";
export { postLinesForWall, JAMB_POST_MIN_WIDTH_FT } from "./postFrame";
export { headerSizeFor } from "./stickFrame";
export { wallFrame, wallLocalToWorld, openingSpans, freeSegments } from "./wallFrame";

/** Derive the complete framing set for the model. Pure; memoise at the call site. */
export function deriveFraming(model: BuildingModel): FramingSet {
  const shell = model.frame.system === "stickFrame" ? generateStickFrame(model) : generatePostFrame(model);
  if (model.leanTos.length === 0) return shell;
  const lt = generateLeanTos(model);
  return { ...shell, members: [...shell.members, ...lt.members], posts: [...shell.posts, ...lt.posts] };
}
