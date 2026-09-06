/** Feet-inches display with fractional inches to 1/16 (SPEC §3.4). */
export function formatFtIn(ft: number, opts: { denom?: 16 | 8 | 4 | 2 | 1 } = {}): string {
  const denom = opts.denom ?? 16;
  const sign = ft < 0 ? "-" : "";
  const totalSixteenths = Math.round(Math.abs(ft) * 12 * denom);
  let feet = Math.floor(totalSixteenths / (12 * denom));
  const rem = totalSixteenths - feet * 12 * denom;
  let inches = Math.floor(rem / denom);
  const frac = rem - inches * denom;
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  let fracStr = "";
  if (frac > 0) {
    let n = frac;
    let d = denom;
    while (n % 2 === 0 && d > 1) {
      n /= 2;
      d /= 2;
    }
    fracStr = `${n}/${d}`;
  }
  const inchPart = inches > 0 || fracStr ? `${inches}${fracStr ? " " + fracStr : ""}"` : "";
  if (feet === 0 && !inchPart) return `0'`;
  if (feet === 0) return `${sign}${inchPart}`;
  return `${sign}${feet}'${inchPart ? " " + inchPart : ""}`;
}

/** Parse "24", "24'", "24' 6\"", "24.5", "24-6" into decimal feet. Returns null if unparsable. */
export function parseFtIn(input: string): number | null {
  const s = input.trim().replace(/[”″]/g, '"').replace(/[’′]/g, "'");
  if (!s) return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:[-\s]\s*(\d+(?:\.\d+)?)(?:\s*(\d+)\/(\d+))?\s*(?:"|in)?)?$/i);
  if (!m) return null;
  const feet = parseFloat(m[1]);
  const inches = m[2] ? parseFloat(m[2]) : 0;
  const fracN = m[3] ? parseInt(m[3], 10) : 0;
  const fracD = m[4] ? parseInt(m[4], 10) : 1;
  if (fracD === 0) return null;
  const sign = feet < 0 ? -1 : 1;
  return sign * (Math.abs(feet) + (inches + fracN / fracD) / 12);
}

export function sqFt(wFt: number, dFt: number): number {
  return wFt * dFt;
}
