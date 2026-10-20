import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "@/lib/api";
import { layoutTrucks } from "@/lib/layout";
import { rangesOf } from "@/lib/colors";
import { paletteFor, type ThemeName } from "@/lib/theme";
import { defaultsAsText, toNumbers, validate, type ParamText } from "@/lib/params";
import { packageChips, truckLabel } from "@/lib/view";
import { useCatalog } from "@/hooks/useCatalog";
import { useRunner } from "@/hooks/useRunner";
import type { Box, ColorMode, Instance, ViewKind } from "@/types";
import Scene from "@/components/Scene";
import InstancePanel from "@/components/InstancePanel";
import AlgorithmPanel, { type RunInfo } from "@/components/AlgorithmPanel";
import ResultPanel from "@/components/ResultPanel";
import ChartsDrawer from "@/components/ChartsDrawer";
import ExperimentsDrawer from "@/components/ExperimentsDrawer";
import { PanelHeader, RunBar } from "@/components/Panel";
import { BottomBar, EmptyState, ViewControls, Legend, PackageCard, TopBar } from "@/components/Overlays";

const NO_BOXES: Record<string, Box> = {};
const THEME_KEY = "darioamodei-theme";

/** Tema tersimpan, kalau tidak ada ikut sistem. */
const initialTheme = (): ThemeName => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* storage diblok */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * Alur: katalog dari server -> pilih data/algoritma/parameter -> Jalankan (kirim lalu polling)
 * -> hasil -> buildScene -> gambar. Semua state di sini; panel hanya menampilkan.
 */
export default function App() {
  // pilihan
  const [instName, setInstName] = useState("");
  const [inst, setInst] = useState<Instance | null>(null);
  const [algoKey, setAlgoKey] = useState("");
  const [paramText, setParamText] = useState<Record<string, ParamText>>({});
  const [seed, setSeed] = useState("1");
  // tampilan
  const [view, setView] = useState<ViewKind>("final");
  const [mode, setMode] = useState<ColorMode>("value");
  const [yaw, setYaw] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<number | "all">("all");
  const [sel, setSel] = useState("");
  const [pop, setPop] = useState<"" | "in" | "out">("");
  const [charts, setCharts] = useState(false);
  const [experiments, setExperiments] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ThemeName>(initialTheme);

  const pal = useMemo(() => paletteFor(theme), [theme]);
  const toggleTheme = () => setTheme((t) => {
    const next = t === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage diblok */ }
    return next;
  });
  const report = useCallback((e: unknown) => setError(e instanceof Error ? e.message : String(e)), []);

  // 1. katalog
  const { items, algos, reloadItems } = useCatalog(report);

  // isi parameter default, pilih SA
  useEffect(() => {
    if (algos.length === 0) return;
    setParamText(Object.fromEntries(algos.map((a) => [a.key, defaultsAsText(a)])));
    setAlgoKey((algos.find((a) => a.key === "simulated_annealing") ?? algos[0]).key);
  }, [algos]);

  // pilih data valid pertama
  useEffect(() => {
    if (!instName) setInstName(items.find((i) => !i.error)?.name ?? "");
  }, [items, instName]);

  // 2. muat data terpilih
  useEffect(() => {
    if (!instName) return;
    setInst(null);
    api.instance(instName).then((i) => { setInst(i); setFocus("all"); setSel(""); setPop(""); }).catch(report);
  }, [instName, report]);

  const algo = algos.find((a) => a.key === algoKey);
  const params = paramText[algoKey] ?? {};
  const invalid = useMemo(() => validate(params, seed), [params, seed]);

  // 3. run
  const { jobs, running, elapsed, start } = useRunner(report);
  const key = instName + "|" + algoKey;
  const busy = !!running && running.key === key;

  // "Lihat di peta" dari eksperimen: pasang pilihan lalu jalan otomatis
  const [autoRun, setAutoRun] = useState(false);
  const openRun = (stem: string, algorithm: string, p: Record<string, number>, s: number) => {
    const file = items.find((i) => i.name === stem + ".json" && !i.error)?.name;
    const a = algos.find((x) => x.key === algorithm);
    if (!file || !a) return report(new Error(`Data ${stem}.json atau algoritma ${algorithm} tidak ditemukan`));
    setParamText((prev) => ({ ...prev, [algorithm]: { ...defaultsAsText(a), ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) } }));
    setInstName(file);
    setAlgoKey(algorithm);
    setSeed(String(s));
    setExperiments(false);
    setAutoRun(true);
  };

  const run = async () => {
    if (!algo || !instName || running) return;
    const started = await start(key, instName, algoKey, toNumbers(params), parseInt(seed, 10));
    if (started) { setSel(""); setPop(""); setView("final"); }
  };

  // jalan setelah data selesai dimuat
  useEffect(() => {
    if (autoRun && inst && inst.name === instName && algo && !running) { setAutoRun(false); run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, inst, instName, algo, running]);

  // 4. hasil
  const job = jobs[key];
  const hasRun = job?.status === "done";
  const result = hasRun ? job[view] : undefined;
  const nTrucks = inst?.trucks.length ?? 0;

  // hasil terakhir tiap algoritma
  const runs: Record<string, RunInfo | undefined> = {};
  for (const a of algos) {
    const j = jobs[instName + "|" + a.key];
    runs[a.key] = j?.status === "done" && j.final ? { value: j.final.value, duration: j.duration } : undefined;
  }

  // 5. gambar
  const zoomBy = (d: number) => setZoom((z) => Math.max(0.4, Math.min(3, z * d)));
  const rotate = (d: number) => setYaw((y) => y + d);
  const layout = useMemo(() => (inst ? layoutTrucks(inst.trucks, focus) : null), [inst, focus]);
  const labels = useMemo(() => (inst && layout ? inst.trucks.map((_, t) => truckLabel(inst, result, layout, t)) : []), [inst, layout, result]);
  const ranges = useMemo(() => rangesOf(inst?.packages ?? {}), [inst]);
  const { inItems, outItems } = useMemo(() => packageChips(inst, result), [inst, result]);

  // sorot paket, pindah fokus ke truknya
  const pickPackage = (id: string) => {
    if (pop === "out") return;
    setSel(id);
    setPop("");
    const box = result?.boxes[id];
    if (box && focus !== "all") setFocus(box[6]);
  };

  const total = !result ? "-" : String(focus === "all" ? result.value : (result.stats[focus]?.value ?? 0));
  const focusTag = focus === "all" || nTrucks < 2 ? "" : " · Truk " + (Number(focus) + 1);
  const algoName = algo?.name ?? "algoritma";

  return (
    <div className="app relative h-full w-full overflow-hidden" data-theme={theme}
      style={{ background: "var(--bg)", color: "var(--text)", ["--acc" as string]: pal.acc, ["--accd" as string]: pal.accd, ["--tint" as string]: pal.tint }}>

      {/* peta 3D */}
      {layout && inst && (
        <Scene trucks={inst.trucks} boxes={result?.boxes ?? NO_BOXES} layout={layout} packages={inst.packages}
          mode={mode} ranges={ranges} pal={pal} yaw={yaw} zoom={zoom} sel={sel} onSel={setSel} labels={labels}
          onTruck={(t) => setFocus(layout.all ? t : "all")} onRotate={rotate} onZoom={zoomBy} />
      )}
      {!inst && instName && <div className="absolute inset-0 grid place-items-center text-sub">Memuat instance…</div>}
      {inst && !result && (
        <EmptyState title={busy ? "Sedang berjalan" : "Belum ada hasil"}
          body={busy ? `Menjalankan ${algoName}…` : "Tolong jalankan dengan algoritma apapun."} />
      )}

      {/* panel kiri */}
      <div className="panel">
        <PanelHeader theme={theme} onToggleTheme={toggleTheme} />
        <div className="scroll">
          <InstancePanel items={items} selected={instName} onSelect={setInstName}
            onUploaded={(name) => { reloadItems(); setInstName(name); }} />
          {algos.length > 0 && (
            <AlgorithmPanel algos={algos} selected={algoKey} runs={runs} upper={inst?.upper_bound ?? 0}
              onSelect={(k) => { setAlgoKey(k); setSel(""); setPop(""); }} />
          )}
          {inst && (
            <ResultPanel inst={inst} job={job} view={result} viewKind={view} algoName={algo?.name ?? ""} focus={focus}
              onFocus={(f) => { setFocus(f); setSel(""); }}
              params={params} seed={seed} invalid={invalid}
              onParam={(k, v) => setParamText((p) => ({ ...p, [algoKey]: { ...p[algoKey], [k]: v } }))}
              onSeed={setSeed}
              onResetParams={() => algo && setParamText((p) => ({ ...p, [algoKey]: defaultsAsText(algo) }))} />
          )}
        </div>
        <RunBar total={total} focusTag={focusTag} busy={busy} elapsed={elapsed} hasRun={hasRun}
          disabled={!algo || !instName || busy || invalid.length > 0}
          reason={invalid.length ? invalid.join("\n") : undefined} onRun={run} />
      </div>

      {/* kontrol peta */}
      <TopBar view={view} onView={(v) => { setView(v); setSel(""); }} mode={mode} onMode={setMode}
        hasResult={!!result}
        onCharts={() => { setExperiments(false); setCharts(true); }}
        onExperiments={() => { setCharts(false); setExperiments(true); }} />
      <BottomBar hasResult={!!result} inCount={inItems.length} outCount={outItems.length} pop={pop} onPop={setPop}
        inItems={inItems} outItems={outItems} onPick={pickPackage} />
      <Legend mode={mode} ranges={ranges} pal={pal} />
      <ViewControls onZoom={zoomBy} onRotate={rotate} />

      {/* detail paket, grafik, eksperimen */}
      {sel && inst?.packages[sel] && !charts && !experiments && (
        <PackageCard id={sel} pkg={inst.packages[sel]} box={result?.boxes[sel]} onClose={() => setSel("")} />
      )}
      {charts && job?.status === "done" && <ChartsDrawer job={job} onClose={() => setCharts(false)} />}
      {experiments && <ExperimentsDrawer algos={algos} onClose={() => setExperiments(false)} onOpenRun={openRun} />}

      {error && (
        <div role="alert" className="toast">
          <AlertTriangle size={18} className="mt-0.5 flex-none" style={{ color: "var(--err)" }} />
          <span className="whitespace-pre-line">{error}</span>
          <button className="cursor-pointer border-0 bg-transparent p-0 text-sub" onClick={() => setError("")} aria-label="Tutup"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
