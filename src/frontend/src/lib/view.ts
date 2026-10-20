import type { Layout } from "@/lib/layout";
import type { ChipItem, Instance, View } from "@/types";

/** Label truk di peta. */
export function truckLabel(inst: Instance, result: View | undefined, layout: Layout | null, ti: number): string {
  const T = inst.trucks[ti];
  const st = result?.stats[ti];
  const n = inst.trucks.length;
  const load = st ? ` · ${st.weight_used}/${T.cap} kg` : "";
  if (layout?.all) return n > 4 ? `T${ti + 1}` : `Truk ${ti + 1}${load}`;
  return (n > 1 ? `Truk ${ti + 1} · ` : "Truk · ") + `${T.w}×${T.l}×${T.h}` + (st ? load : ` · maks ${T.cap} kg`);
}

/** Isi popup paket, urut value terbesar. */
export function packageChips(inst: Instance | null, result: View | undefined): { inItems: ChipItem[]; outItems: ChipItem[] } {
  if (!inst || !result) return { inItems: [], outItems: [] };
  const byValue = (a: string, b: string) => inst.packages[b].value - inst.packages[a].value;
  const multi = inst.trucks.length > 1;
  const inItems = Object.keys(result.boxes).sort(byValue).map((id) => ({
    id,
    text: `${id} · ${inst.packages[id].value}` + (multi ? ` · T${result.boxes[id][6] + 1}` : ""),
  }));
  const outItems = result.unplaced.slice().sort(byValue).map((id) => ({ id, text: `${id} · ${inst.packages[id].value}` }));
  return { inItems, outItems };
}
