import type { ColorMode, Pkg } from "@/types";
import type { Palette } from "@/lib/theme";

export type RGB = [number, number, number];

export const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

export const css = (c: RGB, m = 1) =>
  "rgb(" + c.map((v) => Math.max(0, Math.min(255, Math.round(v * m)))).join(",") + ")";

const norm = (v: number, lo: number, hi: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);

export interface Ranges { value: [number, number]; weight: [number, number] }

export function rangesOf(pkgs: Record<string, Pkg>): Ranges {
  const vs = Object.values(pkgs);
  if (vs.length === 0) return { value: [0, 1], weight: [0, 1] };
  return {
    value: [Math.min(...vs.map((p) => p.value)), Math.max(...vs.map((p) => p.value))],
    weight: [Math.min(...vs.map((p) => p.weight)), Math.max(...vs.map((p) => p.weight))],
  };
}

// ramp berat dan warna fragile
const W_LIGHT: [RGB, RGB] = [[253, 226, 160], [150, 70, 10]];
const W_DARK: [RGB, RGB] = [[110, 84, 36], [253, 214, 120]];
const FRAG = { light: [[217, 48, 37], [194, 199, 207]], dark: [[232, 78, 68], [92, 102, 116]] } as const;

export function boxColor(mode: ColorMode, p: Pkg, r: Ranges, pal: Palette): RGB {
  if (mode === "fragile") return [...(p.fragile ? FRAG[pal.dark ? "dark" : "light"][0] : FRAG[pal.dark ? "dark" : "light"][1])] as RGB;
  if (mode === "weight") {
    const [a, b] = pal.dark ? W_DARK : W_LIGHT;
    return mix(a, b, norm(p.weight, ...r.weight));
  }
  return mix(pal.pale, pal.deep, norm(p.value, ...r.value));
}

export function legend(mode: ColorMode, r: Ranges, pal: Palette) {
  if (mode === "fragile") {
    const f = FRAG[pal.dark ? "dark" : "light"];
    const n = css([...f[1]] as RGB), y = css([...f[0]] as RGB);
    return { title: "Fragile", grad: `linear-gradient(90deg,${n} 0%,${n} 50%,${y} 50%,${y} 100%)`, lo: "biasa", hi: "fragile" };
  }
  if (mode === "weight") {
    const [a, b] = pal.dark ? W_DARK : W_LIGHT;
    return { title: "Berat paket", grad: `linear-gradient(90deg,${css(a)},${css(b)})`, lo: `${r.weight[0]} kg`, hi: `${r.weight[1]} kg` };
  }
  return { title: "Value paket", grad: `linear-gradient(90deg,${css(pal.pale)},${css(pal.deep)})`, lo: String(r.value[0]), hi: String(r.value[1]) };
}

/** teks kontras di atas warna kotak */
export const textOn = (c: RGB) => (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] > 150 ? "#1B1F24" : "#FFFFFF");
