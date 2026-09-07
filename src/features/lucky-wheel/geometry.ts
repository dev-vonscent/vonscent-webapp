/**
 * Wheel geometry.
 *
 * Convention (shared by the SVG and the animation): the pointer sits at
 * 12 o'clock and slot 1 starts there, running **clockwise**. The wheel's
 * `rotate` is also clockwise-positive, so a segment whose centre sits at angle
 * `c` arrives under the pointer when the wheel has turned `-c` (mod 360).
 *
 * The animation only ever increases `rotate` — a wheel that rewinds to reach a
 * nearer angle looks broken — so `targetRotation` returns the next angle above
 * `from + turns * 360` that satisfies the landing condition.
 */

/** Degrees per segment. */
export function segmentAngle(count: number): number {
  return 360 / count;
}

/** Middle of slot `slot` (1-based) in wheel space, clockwise from the top. */
export function slotCenter(slot: number, count: number): number {
  return (slot - 0.5) * segmentAngle(count);
}

/** Normalise any angle into [0, 360). */
export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Which slot is under the pointer at a given wheel rotation. */
export function slotAtRotation(rotation: number, count: number): number {
  const angle = norm360(-rotation);
  return Math.floor(angle / segmentAngle(count)) + 1;
}

/**
 * Final rotation that parks `slot` under the pointer.
 *
 * `jitter` (−1…1) offsets the landing inside the segment so ten spins on the
 * same prize don't stop at the pixel-identical angle. It is scaled to 70% of
 * the half-segment, keeping a margin from the divider line — a pointer sitting
 * exactly on the seam reads as "which one did I win?".
 */
export function targetRotation(
  from: number,
  slot: number,
  count: number,
  turns = 6,
  jitter = 0,
): number {
  const seg = segmentAngle(count);
  const offset = Math.max(-1, Math.min(1, jitter)) * (seg / 2) * 0.7;
  const desired = norm360(-slotCenter(slot, count) + offset);
  const base = from + turns * 360;
  return base + norm360(desired - base);
}

/**
 * SVG path for one segment of a disc of radius `r` centred at (0,0),
 * measured clockwise from 12 o'clock like everything else here.
 */
export function segmentPath(
  slot: number,
  count: number,
  r: number,
  inner = 0,
): string {
  const seg = segmentAngle(count);
  const a0 = (slot - 1) * seg;
  const a1 = slot * seg;
  const p = (angle: number, radius: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [radius * Math.cos(rad), radius * Math.sin(rad)] as const;
  };
  const [x0, y0] = p(a0, r);
  const [x1, y1] = p(a1, r);
  const large = seg > 180 ? 1 : 0;
  if (inner <= 0) {
    return `M 0 0 L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
  }
  const [ix1, iy1] = p(a1, inner);
  const [ix0, iy0] = p(a0, inner);
  return [
    `M ${x0} ${y0}`,
    `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
    `L ${ix1} ${iy1}`,
    `A ${inner} ${inner} 0 ${large} 0 ${ix0} ${iy0}`,
    "Z",
  ].join(" ");
}
