import type { Rule } from "../types";
import { recommendedCupolaIn, ridgeLengthFt } from "@/lib/model/looks";
import { isDoor } from "@/lib/model/openings";
import { LIGHT_KINDS } from "@/lib/model/electrical";

/** Looks rules (ADR-0018): advisory, from cupola makers' and lighting rules of thumb. */

export const cupolaSize: Rule = {
  id: "design.roof.cupolaSize",
  title: "Cupola sized to the roof",
  source: "Industry",
  rationale: "Cupola makers size the base at about 1¼\" per foot of ridge (1\" on a small barn, 1½\" on a big one). Too small looks like an afterthought; too big and it dominates the roof.",
  applies: (m) => m.roof.cupola.enabled,
  evaluate: (m) => {
    const want = recommendedCupolaIn(ridgeLengthFt(m));
    const have = m.roof.cupola.sizeIn;
    if (Math.abs(have - want) <= 6) return [];
    return [{ severity: "info", rule: "design.roof.cupolaSize", message: `The ${have}" cupola is ${have < want ? "small" : "big"} for a ${Math.round(ridgeLengthFt(m))}' ridge; about ${want}" looks right.`, entityIds: ["roof"], fix: { label: `Make it ${want}"`, command: "setCupola", args: { sizeIn: want } } }];
  },
};

export const lightAtEveryDoor: Rule = {
  id: "design.lighting.doorLights",
  title: "A light over every outside door",
  source: "Industry",
  rationale: "Chores happen in the dark half the year. A gooseneck over each big door and a lantern beside the entry door light the aprons and the latch you are fumbling for.",
  applies: (m) => m.openings.some((o) => isDoor(o.type)) && m.electrical.fixtures.length > 0,
  evaluate: (m) => {
    const dark = m.openings.filter((o) => {
      if (!isDoor(o.type)) return false;
      const w = m.walls.find((x) => x.id === o.wallId);
      if (!w) return false;
      const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) || 1;
      const u = o.offsetFt + o.widthFt / 2;
      const c = { x: w.start.x + ((w.end.x - w.start.x) / len) * u, y: w.start.y + ((w.end.y - w.start.y) / len) * u };
      return !m.electrical.fixtures.some((f) => LIGHT_KINDS.includes(f.kind) && f.wallId === o.wallId && Math.hypot(f.x - c.x, f.y - c.y) <= o.widthFt / 2 + 4);
    });
    if (!dark.length) return [];
    return [{ severity: "info", rule: "design.lighting.doorLights", message: `${dark.length} outside door${dark.length > 1 ? "s have" : " has"} no light over ${dark.length > 1 ? "them" : "it"}.`, entityIds: dark.map((o) => o.id), fix: { label: "Lights over every door", command: "lightsOverDoors" } }];
  },
};

export const LOOKS_RULES: Rule[] = [cupolaSize, lightAtEveryDoor];
