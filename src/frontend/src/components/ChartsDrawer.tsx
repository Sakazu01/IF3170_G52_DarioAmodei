import { useState } from "react";
import { X } from "lucide-react";
import { BarChart, LineChart } from "@/components/Charts";
import type { Job } from "@/types";

/** Grafik hasil run. */
export default function ChartsDrawer({ job, onClose }: { job: Job; onClose: () => void }) {
  const ga = !!job.history_avg;
  const tabs = [
    { kind: "objective", label: "Objective" },
    ...(job.prob_history ? [{ kind: "probability", label: "Probabilitas SA" }] : []),
    ...(job.stuck_history ? [{ kind: "stuck", label: "Stuck SA" }] : []),
    ...(ga ? [{ kind: "population", label: "Populasi GA" }] : []),
    { kind: "per_truck", label: "Value per truk" },
  ];
  const [kind, setKind] = useState("objective");
  const xLabel = ga ? "Generasi" : "Iterasi";
  const history = job.history ?? [];
  const ini = job.initial?.stats ?? [], fin = job.final?.stats ?? [];

  return (
    <aside className="drawer" aria-label="Grafik">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <span className="text-[18px] font-semibold">Grafik</span>
        <button className="icon-btn" style={{ width: 32, height: 32, borderRadius: "50%" }} onClick={onClose} aria-label="Tutup"><X size={18} /></button>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-3" role="tablist">
        {tabs.map((t) => (
          <button key={t.kind} role="tab" aria-selected={kind === t.kind} onClick={() => setKind(t.kind)}
            className={"seg-btn " + (kind === t.kind ? "on" : "")} style={{ height: 32, border: "1px solid var(--line-2)", fontSize: 13 }}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 border-t border-line p-4">
        {kind === "objective" && <LineChart series={[{ name: "objective", values: history, color: "var(--acc)" }]} xLabel={xLabel} yLabel="Objective function" xMax={job.iterations} />}
        {kind === "probability" && job.prob_history && <LineChart series={[{ name: "e^(ΔE/T)", values: job.prob_history, color: "var(--acc)" }]} xLabel="Iterasi" yLabel="e^(ΔE / T)" yMin={0} xMax={job.iterations} />}
        {kind === "stuck" && job.stuck_history && <LineChart series={[{ name: "stuck", values: job.stuck_history, color: "var(--acc)" }]} xLabel="Iterasi" yLabel="Frekuensi stuck (kumulatif)" yMin={0} xMax={job.iterations} />}
        {kind === "population" && job.history_avg && (
          <LineChart series={[{ name: "maksimum", values: history, color: "var(--acc)" }, { name: "rata-rata populasi", values: job.history_avg, color: "var(--idle)" }]} xLabel="Generasi" yLabel="Objective function" xMax={job.iterations} />
        )}
        {kind === "per_truck" && <BarChart labels={fin.map((s) => "Truk " + (s.truck + 1))} a={ini.map((s) => s.value)} b={fin.map((s) => s.value)} aName="State awal" bName="Hasil akhir" />}
      </div>
      <div className="border-t border-line px-5 py-3 text-[12.5px] text-sub">
        {job.algorithm} · seed {job.seed} · {job.iterations} {xLabel.toLowerCase()} · {job.duration?.toFixed(2)} s
      </div>
    </aside>
  );
}
