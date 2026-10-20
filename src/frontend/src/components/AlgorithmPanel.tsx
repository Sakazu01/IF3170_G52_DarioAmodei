import type { Algo } from "@/types";

export interface RunInfo { value: number; duration?: number }

interface Props {
  algos: Algo[];
  selected: string;
  runs: Record<string, RunInfo | undefined>;
  upper: number;
  onSelect: (key: string) => void;
}

/** Seksi 2 · Pilih algoritma. Bar = value / batas atas. */
export default function AlgorithmPanel({ algos, selected, runs, upper, onSelect }: Props) {
  let prev = "";
  return (
    <div className="panel-section">
      <span className="eyebrow sec-title">2 · Pilih algoritma</span>
      {algos.map((a) => {
        const on = a.key === selected;
        const r = runs[a.key];
        const head = a.group !== prev ? a.group : "";
        prev = a.group;
        return (
          <div key={a.key} className="contents">
            {head && <span className="group">{head}</span>}
            <button className={on ? "item on" : "item"} aria-pressed={on} onClick={() => onSelect(a.key)}>
              <span className="radio"><i /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex flex-col">
                    <span className="item-name">{a.name}</span>
                    <span className="item-sub num">{r?.duration !== undefined ? r.duration.toFixed(1) + " s" : "belum dijalankan"}</span>
                  </span>
                  <span className="num item-value">{r ? r.value : "-"}</span>
                </span>
                <span className="track">
                  <span className="fill" style={{ width: r && upper > 0 ? Math.min(100, (r.value / upper) * 100).toFixed(0) + "%" : "0%", background: on ? "var(--acc)" : "var(--idle)" }} />
                </span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
