/**
 * Build sequence (research: docs/research/construction-details.md §11):
 * the order of work with the check at each step, written for someone who
 * has never framed a building. Numbers come from the model.
 */
import { WAINSCOT_LABEL } from "@/lib/model/looks";
import type { BuildingModel } from "@/lib/model/schema";
import type { FramingSet } from "@/lib/framing/types";
import { formatFtIn } from "@/lib/units";
import { actualFt } from "@/rules/materials/lumber";

export interface BuildStep {
  n: number;
  title: string;
  what: string;
  check: string;
  /** Which sheet or table to have in hand. */
  sheet?: string;
}

export function buildSequence(model: BuildingModel, framing: FramingSet): BuildStep[] {
  if (model.footprint.kind !== "rect") return [];
  const { wFt: W, dFt: D } = model.footprint;
  const diag = Math.hypot(W, D);
  const fr = model.frame;
  const post = actualFt(fr.post.size);
  const girt = actualFt(fr.girts.size);
  const carrier = actualFt(fr.carrier.size);
  const stick = fr.system === "stickFrame";
  const bays = fr.bayFt;
  const trussIn = fr.trusses.spacingIn;
  const posts = framing.posts.length;
  const slab = model.foundation.slab;
  const cornerInset = girt.t + post.t / 2;
  const hasLeanTo = model.leanTos.length > 0;
  const hasElectrical = model.electrical.fixtures.length > 0;
  const hasDrains = model.drainage.drains.length > 0;
  const bigDoors = model.openings.filter((o) => o.type === "overheadDoor" || o.type === "slidingDoor" || o.type === "rollUpDoor").length;
  const steps: BuildStep[] = [];
  const push = (title: string, what: string, check: string, sheet?: string) => steps.push({ n: steps.length + 1, title, what, check, sheet });

  push("Site prep", `Strip the topsoil, cut and fill, and compact a pad at least 5' bigger than the ${formatFtIn(W)} × ${formatFtIn(D)} building on every side, 4–6" above the finished grade around it, with ¾" crushed stone on top. Grade falls away ¼" per foot for the first 10'.`, "Pad extends ≥ 5' past the walls; water runs away from the building on all sides.", "Site plan");
  push("Batter boards and lines", `Set corner stakes from the site plan and batter boards 4' outside them. Run strings on the outside face of the girts — that is the wall line on every sheet.`, `Diagonals equal within ¼" (${formatFtIn(diag, { denom: 8 })} corner to corner); 3-4-5 at every corner.`, "Foundation plan");
  if (!stick) {
    push("Mark the post centres", `From each corner, measure in ${formatFtIn(cornerInset, { denom: 8 })} for the corner post centre, then every ${bays}' along the bearing walls. Mark the end-wall and door-jamb posts from the post schedule.`, `Spacing within ½" of the plan; each post within ¾" of the average (NFBA).`, "Foundation plan · post schedule");
    push("Dig the holes", `${posts} holes, ${fr.post.holeDiaIn}" across and ${fr.post.embedIn}" deep (or frost depth + 6", whichever is deeper). Keep water out of them.`, `Depth −0 / +2"; centred on the mark ±2".`, "Post schedule");
    push("Footings", `${fr.post.foundation === "embedded" ? `Pour a ${fr.post.padDiaIn}" pad 8–9" thick in each hole (2–3 bags), or set precast pads. Fix the uplift cleats and rebar to each post before it goes in.` : "Pour piers to the plan and wet-set the post brackets in them."}`, `Pad tops within ½"; cleats parallel to the wall.`, "Foundation plan");
    push("Set the posts", `Stand each ${fr.post.size.replace("x", "×")} post with the notch face inward, plumb it both ways and brace it with two 2×4s. Its outside face sits ${formatFtIn(girt.t, { denom: 8 })} inside the string (the girts fill that gap).`, `Plumb within ¼" in 8' (NFBA allows 1% of the height); outside face 1½" inside the string within ¼".`, "Foundation plan");
    push("Collars and backfill", `Pour the concrete collar (12" or the full hole per the schedule) and backfill in 6" lifts, tamping each. Leave the braces up.`, "Posts still plumb after backfill.");
    push("Shoot the eave line", `With a laser from the floor datum, mark the wall height (${formatFtIn(model.eaveHeightFt)}) on every post and square the line around all four faces.`, `All marks within ¼"; adjacent posts within 1/200 of the bay (½" at ${bays}').`, "Wall framing elevations");
    push("Cut the post tops and notches", `Cut every post at the eave line. On the bearing-wall posts, measure down ${formatFtIn(carrier.d, { denom: 8 })} and notch the inside face 1½" deep between the two lines: kerf every ½", knock out, pare the shoulder flat.`, `Shoulders flat and level ±⅛"; across the wall within ¼".`, "Cut list · post detail");
    push("Truss carriers", `Set carrier ply 1 into the notches crown up, then ply 2 lapped against it. Splice only over a post and never both plies at the same post. Two ½" × 8" carriage bolts per post, nails at 12" between plies.`, `Top edge string-straight within ¼"; every splice sits on a post.`, "Wall framing elevations · hardware schedule");
    push("Skirt board", `Pressure-treated ${fr.skirt.size.replace("x", "×")} on the outside of the posts with its bottom on the laser line, just below finished grade.`, `Level ±¼" along the wall — it is the datum for the girts.`, "Wall framing elevations");
    push("Girts", `${fr.girts.size.replace("x", "×")} girts every ${fr.girts.spacingIn}" up from the skirt, on the ${fr.girts.mount === "face" ? "outside face of the posts" : "bookshelf hangers between the posts"}. Two bays per stick, splices staggered row to row, stopped at the openings.`, `Spacing ±½"; string every third row.`, "Wall framing elevations · cut list");
  } else {
    push("Slab and anchor bolts", `Form and pour the monolithic slab with the thickened edge; set anchor bolts at 6' and within 12" of every plate end.`, `Top at the 0 datum ±¼"; diagonals equal within ¼".`, "Foundation plan");
    push("Wall framing", `Build each wall flat on the slab from the framing elevation: ${fr.studs.size.replace("x", "×")} studs at ${fr.studs.spacingIn}", double top plate, headers over the openings, then stand and brace it.`, `Walls plumb within ⅛" in 8'; corners square.`, "Wall framing elevations");
  }
  push("Rough openings", `Frame each door and window opening to its rough-opening size: headers, jambs and sills from the opening schedule.`, `Rough opening +0 / −⅛"; diagonals equal within ⅛"; plumb ⅛" over the height.`, "Opening schedule");
  push("End-wall bracing", "Put the 2×6 X-bracing (or strap) in the corner bays of both end walls.", "Corner posts still plumb after bracing.");
  push("Set the trusses", `Mark the layout on both carriers from the same end. Stand the gable truss first and ground-brace it, then the rest at ${trussIn}" on centre with spacer blocks, toe-nails and a hurricane tie at each bearing. ${framing.trussSpec ? `${framing.trussSpec.count} trusses, ${formatFtIn(framing.trussSpec.spanFt)} span.` : ""}`, `Spacing ±½" at the bearings; plumb within 2"; the heel centred on the 3" bearing (BCSI).`, "Roof framing plan · truss order");
  push("Truss bracing", "Temporary top-chord diagonals as you go; then the permanent web and bottom-chord restraints from the truss drawings.", "Every marked web has its restraint before the roof goes on.");
  push("Purlins", `2×4 purlins on edge every ${fr.purlins.spacingIn}" up the slope, lapped 12" past each truss with the lap side alternating row to row, cantilevered at the gables.`, `Every row string-straight within ¼" — the roof screws must find them.`, "Roof framing plan · cut list");
  if (framing.members.some((m) => m.kind === "kneeBrace")) push("Knee braces and gable framing", "One 2×6 knee brace at 45° from each bearing-wall post to the truss beside it (bolt at the post, nails and a block at the truss); sub-fascia, fly rafters, gable studs and eave blocking.", "Brace bolts snug; blocks tight.", "Roof framing plan · hardware schedule");
  if (hasLeanTo) push("Lean-to framing", "Set the lean-to posts and header, lag the ledger to the barn posts, hang the rafters (hanger at the ledger, birdsmouth on the header, tie at each) and run the purlins.", "Rafter tops in one plane; outer edge height per the plan.", "Lean-to detail · cut list");
  push("Roof steel", "Eave trim and outside closures first. Start panels at the downwind gable with a 2\" eave overhang; screw pattern from the hardware schedule; stitch the laps; ridge cap with inside closures.", "Coverage 15'-0\" ±¼\" every 5 panels; no screws that missed a purlin.", "Roof framing plan · hardware schedule");
  if (model.roof.cupola.enabled) push("Cupola and weathervane", `Cut the saddle through the ridge cap and roofing, set the cupola base astride the ridge on a bed of sealant and screw it to the purlins through the roofing; flash the saddle; lift the cupola on and screw it down; set the weathervane rod through the cap.`, `Base level both ways; no daylight at the saddle; the vane turns freely.`, "Roof framing plan · materials");
  push("Wall steel and trims", "Base trim over the treated-wood barrier, first panel plumb, then across; J-channel and head trims at every opening, corner trims last.", "Panel bottoms 1–4\" above the skirt bottom and clear of soil; laps face downwind.", "Wall framing elevations");
  if (model.openings.some((o) => o.awning) || model.materials.trimStyle !== "none" || model.materials.wainscot.enabled) push("Awnings, trim and wainscot", `${model.openings.some((o) => o.awning) ? "Lag the awning ledgers into the headers, hang the rafters and brackets, then the awning steel with a drip edge back under the siding. " : ""}${model.materials.trimStyle !== "none" ? "Trim boards go on over the siding with a bead of sealant behind the head and a drip cap on top. " : ""}${model.materials.wainscot.enabled ? `The ${WAINSCOT_LABEL[model.materials.wainscot.kind].toLowerCase()} wainscot goes on last with its cap flashed into the siding.` : ""}`.trim(), `Awnings level and pitched away from the wall; every head trim capped; wainscot cap sheds water out, not in.`, "Opening schedule · materials");
  if (hasDrains) push("Under-slab drains", `Trench and lay the ${model.drainage.pipeDiaIn}" PVC from every drain to the outlet at ${model.drainage.slopeInPerFt * 8}/8" per foot on 4" of gravel; set the drain bodies and trench channels on chairs at the finished-floor line; cap the cleanouts; sleeve the pipe through the thickened edge; then cover the pipe. Plumbing inspection before anything is buried.`, `Water poured into each drain runs out the outlet; grate frames ⅛" below the slab line; the forms are marked with the slab slopes from the drainage plan.`, "P1 drainage plan");
  if (slab.enabled && !stick) push("Slab", `Pour the ${slab.thicknessIn}" slab over ${slab.gravelBaseIn}" of gravel with the mesh, control joints every 12', thickened edges at the doors${slab.aprons ? ` and the ${slab.apronDepthFt}' aprons outside the big doors` : ""}, ½" isolation around each post.`, `Top at the 0 datum ±¼"; door thresholds on concrete.`, "Foundation plan");
  push("Doors and windows", `${bigDoors ? `${bigDoors} big door${bigDoors > 1 ? "s" : ""} (tracks, leaves or the supplier's overhead units), ` : ""}entry doors and windows per the opening schedule.`, "Sliding leaves plumb with 1\" floor clearance; latches engage; overhead openings square.", "Opening schedule");
  if (hasElectrical) push("Electrical rough-in", "Panel, conduit along the girts at the wiring belt, boxes and runs from the electrical plan — before stall liners go on. Licensed electrician; inspection before covering.", "Every circuit labelled at the panel; GFCI on every outlet.", "Electrical plan · panel schedule");
  if (model.zones.length) push("Stalls and rooms", "U-channels on the posts, kick boards, grilles, stall doors and room doors from the interior sheet; then mats, feeders and waterers.", "Channels plumb; boards tight; latches animal-proof.", "Floor plan · interior schedule");
  if (hasElectrical) push("Fixtures and trim-out", "Lights, switches, outlets and the waterer heaters; test every GFCI.", "Every light switched; every outlet tests correct.", "Electrical plan");
  if (model.runs.length) push("Runs and fencing", `Lay out each run from the site plan with the barn wall as the base line. Set corner and gate posts first (in concrete, below frost) with H-braces on the wire fences, then line posts on the spacing, then stretch or hang the fence and hang the gates so they swing into the run. Grade the ground away from the barn.`, `Gates swing clear and latch; wire tight enough to hum; nothing an animal can hook a leg in; water runs away from the doors.`, "Site plan · fence schedule");
  push("Close-out", "Sealant at J-channels and the ridge, touch-up paint, gutters if wanted, aprons and final grading. Walk the punch list: washers compressed not crushed, no missing braces or blocks, no treated wood against steel.", "Nothing on the punch list.");
  return steps;
}
