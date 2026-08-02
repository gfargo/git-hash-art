/**
 * OKLCH colour space (Björn Ottosson's OKLab, in cylindrical form).
 *
 * HSL's "lightness" is a geometric convenience, not a perceptual quantity.
 * Twelve hues at HSL L=0.50 span an 11.7× range in actual luminance —
 * yellow reads as near-white, blue as near-black. Every colour decision in
 * this renderer was expressed in that space, and several were quietly
 * compensating for it:
 *
 *   - `enforceContrast` had to *search* for a lightness that produced the
 *     luminance it wanted, because the relationship between the two depends
 *     on hue.
 *   - `adjustLightness(c, -0.18)` for tone-on-tone strokes was a large
 *     perceptual step at hue 60 and nearly invisible at hue 240, so stroke
 *     hierarchy was inconsistent by hue.
 *   - Hue distance in HSL degrees is not perceptually even, so "guaranteed
 *     accent separation" was stricter for some palettes than others.
 *
 * In OKLCH, L *is* perceived lightness and hue steps are near-uniform, so
 * those become arithmetic instead of approximation.
 *
 * Everything still enters and leaves as #rrggbb — the draw layer is
 * untouched.
 */

// ── sRGB transfer ────────────────────────────────────────────────────

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

// ── OKLab core ───────────────────────────────────────────────────────

function linearRgbToOklab(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabToLinearRgb(
  L: number,
  a: number,
  b: number,
): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// ── Public: hex ⇄ OKLCH ──────────────────────────────────────────────

export interface Oklch {
  /** Perceived lightness, 0-1 */
  L: number;
  /** Chroma. 0 is grey; sRGB tops out around 0.37 and varies by hue. */
  C: number;
  /** Hue in degrees, perceptually near-uniform */
  h: number;
}

const _toCache = new Map<string, Oklch>();

export function hexToOklch(hex: string): Oklch {
  const cached = _toCache.get(hex);
  if (cached) return cached;
  const c = hex.charAt(0) === "#" ? hex.substring(1) : hex;
  const r = srgbToLinear(parseInt(c.substring(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(c.substring(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(c.substring(4, 6), 16) / 255);
  const [L, A, B] = linearRgbToOklab(r, g, b);
  const out: Oklch = {
    L,
    C: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  };
  if (_toCache.size >= 1024) _toCache.clear();
  _toCache.set(hex, out);
  return out;
}

function inGamut([r, g, b]: [number, number, number]): boolean {
  const eps = 1e-4;
  return (
    r >= -eps &&
    r <= 1 + eps &&
    g >= -eps &&
    g <= 1 + eps &&
    b >= -eps &&
    b <= 1 + eps
  );
}

/**
 * OKLCH → hex, reducing chroma until the colour fits in sRGB.
 *
 * Clipping RGB channels instead would shift the hue — a too-saturated blue
 * clips its blue channel and drifts toward cyan. Holding L and h and giving
 * up chroma keeps the colour recognisably the one that was asked for, which
 * matters because hue and lightness are what the palette logic reasons about.
 */
export function oklchToHex(L: number, C: number, h: number): string {
  const Lc = Math.max(0, Math.min(1, L));
  const hr = (((h % 360) + 360) % 360) * (Math.PI / 180);
  const cosH = Math.cos(hr);
  const sinH = Math.sin(hr);

  let lo = 0;
  let hi = Math.max(0, C);
  let rgb = oklabToLinearRgb(Lc, hi * cosH, hi * sinH);
  if (!inGamut(rgb)) {
    // 12 halvings resolves chroma to ~0.0001 — well below a visible step.
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinearRgb(Lc, mid * cosH, mid * sinH))) lo = mid;
      else hi = mid;
    }
    rgb = oklabToLinearRgb(Lc, lo * cosH, lo * sinH);
  }

  const to255 = (v: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(linearToSrgb(Math.max(0, Math.min(1, v))) * 255),
      ),
    );
  const [r, g, b] = rgb;
  return `#${to255(r).toString(16).padStart(2, "0")}${to255(g)
    .toString(16)
    .padStart(2, "0")}${to255(b).toString(16).padStart(2, "0")}`;
}

/** Shortest signed hue distance in degrees, -180..180. */
export function hueDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/** Perceived lightness of a hex colour, 0-1. */
export function perceivedLightness(hex: string): number {
  return hexToOklch(hex).L;
}
