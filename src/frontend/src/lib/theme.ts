import { mix, type RGB } from "@/lib/colors";

export type ThemeName = "light" | "dark";

export const ACCENT_HEX = "#1A73E8";
const hexRgb = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16)) as RGB;
const rgbCss = (c: RGB) => "rgb(" + c.map((v) => Math.round(v)).join(",") + ")";

export interface Palette {
  dark: boolean;
  acc: string;
  accd: string;
  tint: string;
  /** ujung ramp value */
  pale: RGB;
  deep: RGB;
}

/** Aksen diangkat di tema gelap agar kontras. */
export function paletteFor(theme: ThemeName, hex = ACCENT_HEX): Palette {
  const dark = theme === "dark";
  const base = hexRgb(hex);
  const W: RGB = [255, 255, 255];
  const acc = dark ? mix(base, W, 0.35) : base;
  const surface: RGB = dark ? [23, 27, 33] : W;
  return {
    dark,
    acc: rgbCss(acc),
    accd: rgbCss(dark ? mix(base, W, 0.62) : mix(acc, [0, 0, 0], 0.25)),
    tint: rgbCss(dark ? mix(surface, base, 0.26) : mix(acc, W, 0.9)),
    pale: dark ? mix(base, surface, 0.65) : mix(acc, W, 0.68),
    deep: dark ? mix(base, W, 0.5) : (acc.map((v) => v * 0.5) as RGB),
  };
}
