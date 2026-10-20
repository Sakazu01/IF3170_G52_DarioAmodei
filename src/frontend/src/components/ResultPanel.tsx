import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Instance, Job, View } from "@/types";

interface Props {
  inst: Instance;
  job?: Job;
  view: View | undefined;
  viewKind: "initial" | "final";
  algoName: string;
  focus: number | "all";
  onFocus: (f: number | "all") => void;
  params: Record<string, string>;
  seed: string;
  invalid: string[];
  onParam: (k: string, v: string) => void;
  onSeed: (v: string) => void;
  onResetParams: () => void;
}

const pct = (a: number, b: number) => (b > 0 ? Math.min(100, (a / b) * 100) : 0);

const Metric = ({ label, text, w, hot }: { label: string; text: string; w: number; hot?: boolean }) => (
  <div className="metric">
    <div className="metric-head"><span>{label}</span><span className="num">{text}</span></div>
    <span className="track thick"><span className="fill" style={{ width: w.toFixed(0) + "%", background: hot ? "var(--err)" : "var(--acc)" }} /></span>
  </div>
);

/** Seksi 3 · Hasil (ikut fokus truk) + parameter yang bisa diubah. */
export default function ResultPanel(p: Props) {
  const { inst, view, focus } = p;
  const [open, setOpen] = useState(false);
  const T = inst.trucks, multi = T.length > 1;
  const done = p.job?.status === "done" && !!view;
  const vis = focus === "all" ? T.map((_, i) => i) : [focus];
  const stats = view?.stats ?? [];
  const sum = (f: (i: number) => number) => vis.reduce((a, i) => a + f(i), 0);
  const n = done ? sum((i) => stats[i].package_count) : 0;
  const wt = done ? sum((i) => stats[i].weight_used) : 0;
  const vol = done ? sum((i) => stats[i].volume_used) : 0;
  const capW = sum((i) => T[i].cap);
  const capV = sum((i) => T[i].w * T[i].l * T[i].h);
  const nPk = Object.keys(inst.packages).length;
  const whole = focus === "all" || !multi;

  const note = !done
    ? (p.job?.status === "error" ? "Gagal: " + p.job.error : "Belum dijalankan · batas atas " + inst.upper_bound)
    : whole
      ? (p.viewKind === "final" && p.job?.initial ? `Naik ${view!.value - p.job.initial.value} dari state awal · ` : "State awal acak · ")
        + ((view!.value / inst.upper_bound) * 100).toFixed(0) + "% dari batas atas " + inst.upper_bound
      : "Bagian dari total " + view!.value;

  const showParams = open || p.invalid.length > 0;
  return (
    <div className="panel-section" style={{ padding: "16px 20px 20px", gap: 16 }}>
      <div className="flex flex-col gap-[3px]">
        <span className="eyebrow">3 · Hasil{focus === "all" ? "" : " · Truk " + (Number(focus) + 1)}</span>
        <span className="mt-1 text-[17px] font-semibold">{p.algoName}</span>
        <span className="text-[13px] leading-normal text-sub">{note}</span>
      </div>

      <div className="flex flex-col gap-3.5">
        <Metric label="Paket masuk" text={done ? (focus === "all" ? `${n} / ${nPk}` : `${n} paket`) : "-"} w={done ? pct(n, nPk) : 0} />
        <Metric label="Berat" text={done ? `${wt} / ${capW} kg` : `maks ${capW} kg`} w={done ? pct(wt, capW) : 0} hot={done && wt / capW >= 0.95} />
        <Metric label="Volume" text={done ? `${((vol / capV) * 100).toFixed(0)}% terpakai` : "-"} w={done ? pct(vol, capV) : 0} />
      </div>

      {multi && (
        <div className="-mx-3 flex max-h-[300px] flex-col gap-0.5 overflow-y-auto">
          <span className="eyebrow" style={{ padding: "0 12px 6px" }}>Truk</span>
          <TruckRow name="Semua truk" sub={`${T.length} truk berdampingan`} val={done ? stats.reduce((a, s) => a + s.value, 0) : undefined}
            w={done ? pct(stats.reduce((a, s) => a + s.weight_used, 0), T.reduce((a, t) => a + t.cap, 0)) : 0}
            on={focus === "all"} onClick={() => p.onFocus("all")} />
          {T.map((t, i) => {
            const s = stats[i];
            const w = done ? pct(s.weight_used, t.cap) : 0;
            return (
              <TruckRow key={i} name={"Truk " + (i + 1)}
                sub={`${t.w}×${t.l}×${t.h} · ` + (done ? `${s.package_count} paket · ${s.weight_used}/${t.cap} kg` : `maks ${t.cap} kg`)}
                val={done ? s.value : undefined} w={w} hot={w >= 95} on={focus === i} onClick={() => p.onFocus(i)} />
            );
          })}
        </div>
      )}

      {done && <RunStats job={p.job!} />}

      <div className="flex flex-col gap-1.5 border-t border-line pt-3">
        <button className="toggle" onClick={() => setOpen(!open)} aria-expanded={showParams}>
          <span className="eyebrow">Parameter &amp; seed</span>
          <ChevronDown size={18} className="text-sub" style={{ transform: showParams ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
        {showParams && (
          <div className="flex flex-col">
            {Object.entries(p.params).map(([k, v]) => (
              <label key={k} className="kv-row">
                <span>{k}</span>
                <input className="field" inputMode="decimal" value={v} aria-invalid={v.trim() === "" || !Number.isFinite(Number(v)) || Number(v) < 0}
                  onChange={(e) => p.onParam(k, e.target.value)} />
              </label>
            ))}
            <label className="kv-row">
              <span>seed</span>
              <input className="field" inputMode="numeric" value={p.seed} aria-invalid={!/^\d+$/.test(p.seed.trim())} onChange={(e) => p.onSeed(e.target.value)} />
            </label>
            {p.invalid.length > 0 && (
              <div role="alert" className="pt-1.5 text-[13px] leading-normal" style={{ color: "var(--err)" }}>{p.invalid.join("\n")}</div>
            )}
            <button className="link-btn self-start" onClick={p.onResetParams}>Kembalikan ke default</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TruckRow(p: { name: string; sub: string; val?: number; w: number; hot?: boolean; on: boolean; onClick: () => void }) {
  return (
    <button onClick={p.onClick} aria-pressed={p.on} className={p.on ? "item on" : "item"} style={{ minHeight: 56 }}>
      <span className="flex min-w-0 flex-1 flex-col gap-[7px]">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex flex-col">
            <span className="item-name">{p.name}</span>
            <span className="item-sub num">{p.sub}</span>
          </span>
          <span className="num item-value">{p.val ?? "-"}</span>
        </span>
        <span className="track">
          <span className="fill" style={{ width: p.w.toFixed(0) + "%", background: p.hot ? "var(--err)" : p.on ? "var(--acc)" : "var(--idle)" }} />
        </span>
      </span>
    </button>
  );
}

const EXTRA_LABEL: Record<string, string> = {
  sideways_used: "Sideways move terpakai",
  restarts: "Jumlah restart",
  iterations_per_restart: "Iterasi per restart",
  value_per_restart: "Value per restart",
  stuck_count: "Frekuensi stuck (total)",
  final_temperature: "Suhu akhir",
  population_size: "Jumlah populasi",
  iterations: "Banyak iterasi",
  mutation_prob: "Probabilitas mutasi",
};

/** Iterasi, durasi, dan metrik khusus algoritma. */
function RunStats({ job }: { job: Job }) {
  const rows: [string, string][] = [
    ["Iterasi sampai berhenti", String(job.iterations ?? "-")],
    ["Durasi pencarian", (job.duration ?? 0).toFixed(2) + " s"],
    ...Object.entries(job.extras ?? {}).map(([k, v]): [string, string] => [
      EXTRA_LABEL[k] ?? k, Array.isArray(v) ? v.join(", ") : String(Number.isInteger(v) ? v : +v.toPrecision(4)),
    ]),
  ];
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <span className="eyebrow">Statistik run</span>
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row" style={{ alignItems: "flex-start" }}>
          <span className="shrink-0">{k}</span>
          <span className="num text-right" style={{ wordBreak: "break-word" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
