import type { Algo } from "@/types";

export type ParamText = Record<string, string>;

/** Input disimpan sebagai teks, divalidasi sebelum dikirim. */
export const defaultsAsText = (a: Algo): ParamText =>
  Object.fromEntries(Object.entries(a.defaults).map(([k, v]) => [k, String(v)]));

/** Daftar masalah input (kosong = valid). */
export function validate(params: ParamText, seed: string): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    const n = Number(v);
    if (v.trim() === "" || !Number.isFinite(n) || n < 0) bad.push(`${k} harus angka ≥ 0`);
  }
  if (!/^\d+$/.test(seed.trim())) bad.push("seed harus bilangan bulat ≥ 0");
  return bad;
}

export const toNumbers = (params: ParamText): Record<string, number> =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Number(v)]));
