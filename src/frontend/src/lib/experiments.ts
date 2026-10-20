import type { ExpSummary } from "@/types";

/** Eksperimen yang hanya berbeda di satu parameter (sisanya kontrol). */
export interface Sweep {
  param: string;
  control: Record<string, number>;
  items: ExpSummary[];
}

export interface AlgoExperiments { name: string; sweeps: Sweep[]; loose: ExpSummary[]; all: ExpSummary[] }

/** Per parameter k: kelompokkan menurut parameter lain; kelompok dengan >1 nilai k jadi sweep. */
export function groupExperiments(list: ExpSummary[]): AlgoExperiments[] {
  const names = [...new Set(list.map((e) => e.name))];
  return names.map((name) => {
    // buang setelan ganda
    const seen = new Set<string>();
    const entries = list.filter((e) => {
      if (e.name !== name) return false;
      const sig = JSON.stringify(Object.entries(e.params).sort());
      return seen.has(sig) ? false : (seen.add(sig), true);
    });
    const keys = [...new Set(entries.flatMap((e) => Object.keys(e.params)))];
    const sweeps: Sweep[] = [];
    const used = new Set<ExpSummary>();
    for (const k of keys) {
      const groups = new Map<string, ExpSummary[]>();
      for (const e of entries) {
        const rest = Object.fromEntries(Object.entries(e.params).filter(([p]) => p !== k));
        const sig = JSON.stringify(Object.entries(rest).sort());
        groups.set(sig, [...(groups.get(sig) ?? []), e]);
      }
      for (const items of groups.values()) {
        if (new Set(items.map((e) => e.params[k])).size < 2) continue;
        const { [k]: _omit, ...control } = items[0].params;
        void _omit;
        sweeps.push({ param: k, control, items: items.slice().sort((a, b) => a.params[k] - b.params[k]) });
        items.forEach((e) => used.add(e));
      }
    }
    return { name, sweeps, loose: entries.filter((e) => !used.has(e)), all: entries };
  });
}
