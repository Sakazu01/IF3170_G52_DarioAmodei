import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LineChart, SweepChart, type Series } from "@/components/Charts";
import { api } from "@/lib/api";
import { groupExperiments, type Sweep } from "@/lib/experiments";
import type { Algo, ExpRun, ExpSummary } from "@/types";

/** Hasil eksperimen dari output/experiments/. */
export default function ExperimentsDrawer({ algos, onClose, onOpenRun }: {
  algos: Algo[];
  onClose: () => void;
  /** jalankan ulang satu run di peta (seed sama) */
  onOpenRun: (instance: string, algorithm: string, params: Record<string, number>, seed: number) => void;
}) {
  const [data, setData] = useState<Record<string, ExpSummary[]> | null>(null);
  const [inst, setInst] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.experiments().then((d) => { setData(d); setInst(Object.keys(d)[0] ?? ""); }).catch((e) => setErr(String(e.message ?? e)));
  }, []);

  const nameOf = (key: string) => algos.find((a) => a.key === key)?.name ?? key;
  const groups = data && inst ? groupExperiments(data[inst]) : [];
  const instances = Object.keys(data ?? {});

  return (
    <aside className="drawer" aria-label="Hasil eksperimen">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <span className="text-[18px] font-semibold">Hasil eksperimen</span>
        <button className="icon-btn" style={{ width: 32, height: 32, borderRadius: "50%" }} onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      {instances.length > 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3" role="tablist">
          {instances.map((n) => (
            <button key={n} role="tab" aria-selected={n === inst} onClick={() => setInst(n)}
              className={"seg-btn " + (n === inst ? "on" : "")} style={{ height: 32, border: "1px solid var(--line-2)", fontSize: 13 }}>{n}</button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-5 pb-6 pt-4">
        {err && <p className="text-[13px]" style={{ color: "var(--err)" }}>{err}</p>}
        {data && instances.length === 0 && (
          <div className="flex max-w-[440px] flex-col gap-2 text-[13.5px] leading-normal text-sub">
            <span className="text-[16px] font-semibold text-ink">Belum ada hasil eksperimen</span>
            <span>Jalankan eksperimen dulu, lalu buka lagi panel ini:</span>
            <code className="mono rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink">cd src/backend/experiments{"\n"}python run_experiment.py all</code>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.name} className="mb-8 flex flex-col gap-4">
            <h3 className="m-0 text-[16px] font-semibold">{nameOf(g.name)}</h3>
            {g.sweeps.map((s, i) => <SweepCard key={i} sweep={s} />)}
            {g.loose.length > 0 && <ExpTable title="Satu setelan" param="" items={g.loose} />}
            <RunDetail items={g.all} onOpen={(e, r) => r.seed !== null && onOpenRun(inst, g.name, e.params, r.seed)} />
          </section>
        ))}
      </div>
    </aside>
  );
}

function SweepCard({ sweep: s }: { sweep: Sweep }) {
  const control = Object.entries(s.control).map(([k, v]) => `${k}=${v}`).join(" · ");
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14.5px] font-semibold">Pengaruh <span className="mono">{s.param}</span></span>
        {control && <span className="text-[12.5px] text-sub">kontrol: <span className="mono">{control}</span></span>}
      </div>
      <div style={{ height: 240 }}>
        <SweepChart xLabel={s.param} labels={s.items.map((e) => String(e.params[s.param]))}
          means={s.items.map((e) => e.mean)} runs={s.items.map((e) => e.values)} />
      </div>
      <ExpTable title="" param={s.param} items={s.items} />
      <span className="text-[12px] text-sub">Batang = rata-rata value akhir, titik = tiap run ({s.items[0]?.values.length} run per setelan).</span>
    </div>
  );
}

function ExpTable({ title, param, items }: { title: string; param: string; items: ExpSummary[] }) {
  const head = ["", "mean", "best", "stdev", "iterasi", "durasi"];
  return (
    <div className="flex flex-col">
      {title && <span className="eyebrow pb-1">{title}</span>}
      <div className="grid text-[13px]" style={{ gridTemplateColumns: "minmax(0,1.6fr) repeat(5, minmax(0,1fr))" }}>
        {head.map((h, i) => <span key={i} className="eyebrow py-1" style={{ textAlign: i ? "right" : "left" }}>{h || param || "parameter"}</span>)}
        {items.map((e, r) => (
          <div key={r} className="contents">
            <span className="mono border-t border-line py-1.5 text-[12px]">{param ? e.params[param] : Object.entries(e.params).map(([k, v]) => `${k}=${v}`).join(" ")}</span>
            {[e.mean.toFixed(0), String(e.best), e.stdev.toFixed(1), (e.mean_iterations ?? 0).toFixed(0), e.mean_duration.toFixed(1) + " s"].map((c, i) => (
              <span key={i} className="num border-t border-line py-1.5 text-right">{c}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const RUN_COLORS = ["var(--acc)", "var(--text)", "var(--idle)"];
const setting = (e: ExpSummary) => Object.entries(e.params).map(([k, v]) => `${k}=${v}`).join(" ");
const showExtra = (v: number | number[]) => (Array.isArray(v) ? v.join(", ") : String(v));

/** Kurva objective dan tabel per run untuk satu setelan. */
function RunDetail({ items, onOpen }: { items: ExpSummary[]; onOpen: (e: ExpSummary, r: ExpRun) => void }) {
  const [idx, setIdx] = useState(0);
  const e = items[Math.min(idx, items.length - 1)];
  if (!e || !e.runs?.length) return null;

  // GA: rata-rata antar run; lainnya: satu garis per run
  const ga = e.runs.every((r) => r.history_avg);
  const mean = (rows: number[][]) => rows[0].map((_, i) => rows.reduce((a, r) => a + r[i], 0) / rows.length);
  const series: Series[] = ga
    ? [
        { name: "maksimum", values: mean(e.runs.map((r) => r.history)), color: RUN_COLORS[0] },
        { name: "rata-rata populasi", values: mean(e.runs.map((r) => r.history_avg!)), color: RUN_COLORS[2] },
      ]
    : e.runs.map((r, i) => ({ name: `run ${i + 1}`, values: r.history, color: RUN_COLORS[i % RUN_COLORS.length], xMax: r.iterations }));
  const xMax = Math.max(...e.runs.map((r) => r.iterations));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <span className="text-[14.5px] font-semibold">Detail run</span>
      <div className="flex flex-wrap gap-2" role="tablist">
        {items.map((it, i) => (
          <button key={i} role="tab" aria-selected={it === e} onClick={() => setIdx(i)}
            className={"seg-btn " + (it === e ? "on" : "")} style={{ height: 30, border: "1px solid var(--line-2)", fontSize: 12 }}>
            <span className="mono">{setting(it)}</span>
          </button>
        ))}
      </div>
      <div style={{ height: 240 }}>
        <LineChart series={series} xLabel={ga ? "Generasi (rata-rata 3 run)" : "Iterasi"} yLabel="Objective function" xMax={xMax} />
      </div>
      <div className="grid text-[13px]" style={{ gridTemplateColumns: "0.6fr 0.8fr 0.9fr 0.9fr 0.9fr 1.6fr auto" }}>
        {["run", "seed", "value", "iterasi", "durasi", "metrik", ""].map((h, i) => <span key={i} className="eyebrow py-1">{h}</span>)}
        {e.runs.map((r, i) => (
          <div key={i} className="contents">
            <span className="num border-t border-line py-1.5">{i + 1}</span>
            <span className="num border-t border-line py-1.5">{r.seed ?? "-"}</span>
            <span className="num border-t border-line py-1.5">{r.final_value}</span>
            <span className="num border-t border-line py-1.5">{r.iterations}</span>
            <span className="num border-t border-line py-1.5">{r.duration.toFixed(2)} s</span>
            <span className="mono border-t border-line py-1.5 text-[11.5px]" style={{ wordBreak: "break-word" }}>
              {Object.entries(r.extras ?? {}).map(([k, v]) => `${k}=${showExtra(v)}`).join(" ") || "-"}
            </span>
            <span className="border-t border-line py-1">
              <button className="link-btn" onClick={() => onOpen(e, r)} disabled={r.seed === null}>Lihat di peta</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
