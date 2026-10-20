import { BarChart3, FlaskConical, Minus, Plus, RotateCcw, RotateCw, X } from "lucide-react";
import { legend, type Ranges } from "@/lib/colors";
import type { Palette } from "@/lib/theme";
import type { Box, ChipItem, ColorMode, Pkg, ViewKind } from "@/types";

type Pop = "" | "in" | "out";

const SEG_ARIA = { view: "Tampilan state", mode: "Warna paket", list: "Daftar paket" };
const MODES: [ColorMode, string][] = [["value", "Value"], ["fragile", "Fragile"], ["weight", "Berat"]];

interface TopBarProps {
  view: ViewKind; onView: (v: ViewKind) => void;
  mode: ColorMode; onMode: (m: ColorMode) => void;
  hasResult: boolean; onCharts: () => void; onExperiments: () => void;
}

/** Bar atas: state, mode warna, Grafik, Eksperimen. */
export function TopBar(p: TopBarProps) {
  return (
    <div className="topbar">
      <div className="seg" role="group" aria-label={SEG_ARIA.view}>
        <button className={p.view === "initial" ? "seg-btn on" : "seg-btn"} aria-pressed={p.view === "initial"} onClick={() => p.onView("initial")}>Awal (acak)</button>
        <button className={p.view === "final" ? "seg-btn on" : "seg-btn"} aria-pressed={p.view === "final"} onClick={() => p.onView("final")}>Hasil akhir</button>
      </div>
      <div className="seg" role="group" aria-label={SEG_ARIA.mode}>
        {MODES.map(([m, label]) => (
          <button key={m} className={p.mode === m ? "seg-btn on" : "seg-btn"} aria-pressed={p.mode === m} onClick={() => p.onMode(m)}>{label}</button>
        ))}
      </div>
      <div className="seg">
        <button className="seg-btn" disabled={!p.hasResult} onClick={p.onCharts} title="Objective, probabilitas SA, populasi GA, value per truk">
          <BarChart3 size={16} /> Grafik
        </button>
        <button className="seg-btn" onClick={p.onExperiments} title="Perbandingan parameter dari experiments/">
          <FlaskConical size={16} /> Eksperimen
        </button>
      </div>
    </div>
  );
}

interface BottomProps {
  hasResult: boolean; inCount: number; outCount: number;
  pop: Pop; onPop: (p: Pop) => void;
  inItems: ChipItem[]; outItems: ChipItem[]; onPick: (id: string) => void;
}

/** Toggle Masuk / Tidak muat + popup daftarnya. */
export function BottomBar(p: BottomProps) {
  const items = p.pop === "in" ? p.inItems : p.pop === "out" ? p.outItems : [];
  const title = p.pop === "in" ? "Paket masuk · klik untuk menyorot" : "Paket tidak muat";
  return (
    <>
      {p.pop && (
        <div className="popup" role="dialog" aria-label={title}>
          <span className="eyebrow">{title}</span>
          <div className="flex flex-wrap gap-1.5">
            {items.map((u) => (
              <button key={u.id} className={"chip num" + (p.pop === "out" ? " off" : "")} onClick={() => p.onPick(u.id)}>{u.text}</button>
            ))}
            {items.length === 0 && <span className="text-[13px] text-sub">kosong</span>}
          </div>
        </div>
      )}
      <div className="seg botbar" role="group" aria-label={SEG_ARIA.list}>
        <button className={p.pop === "in" ? "seg-btn on" : "seg-btn"} aria-pressed={p.pop === "in"} disabled={!p.hasResult} onClick={() => p.onPop(p.pop === "in" ? "" : "in")}>
          Masuk <span className="num">{p.hasResult ? p.inCount : 0}</span>
        </button>
        <button className={p.pop === "out" ? "seg-btn on" : "seg-btn"} aria-pressed={p.pop === "out"} disabled={!p.hasResult} onClick={() => p.onPop(p.pop === "out" ? "" : "out")}>
          Tidak muat <span className="num">{p.hasResult ? p.outCount : 0}</span>
        </button>
      </div>
    </>
  );
}

/** Detail paket yang diklik. */
export function PackageCard({ id, pkg, box, onClose }: { id: string; pkg: Pkg; box?: Box; onClose: () => void }) {
  const rows: [string, string][] = [];
  if (box) {
    if (box[6] !== undefined) rows.push(["Truk", String(box[6] + 1)]);
    rows.push(["Ukuran terpasang", `${box[3]}×${box[4]}×${box[5]}`], ["Posisi", `x ${box[0]}, y ${box[1]}, z ${box[2]}`]);
  } else {
    rows.push(["Ukuran asli", `${pkg.w}×${pkg.l}×${pkg.h}`]);
  }
  rows.push(["Value", String(pkg.value)], ["Berat", pkg.weight + " kg"], ["ETA", String(pkg.eta)]);
  return (
    <div className="pkg-card">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="mono text-[18px] font-semibold">{id}</span>
          <span className="rounded-xl px-2.5 py-0.5 text-[12px] font-semibold"
            style={{ background: pkg.fragile ? "var(--err-bg)" : "var(--chip)", color: pkg.fragile ? "var(--err-fg)" : "var(--chip-fg)" }}>
            {pkg.fragile ? "Fragile" : "Biasa"}
          </span>
        </span>
        <button className="icon-btn" style={{ width: 32, height: 32, borderRadius: "50%" }} onClick={onClose} aria-label="Tutup detail">
          <X size={18} />
        </button>
      </div>
      <span className="text-[13px] text-sub">{box ? "" : "Tidak dimuat di state ini. "}{pkg.fragile ? "Tidak boleh menopang paket lain." : "Boleh menopang paket lain."}</span>
      <div className="mt-0.5 flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-t border-line py-[7px] text-[13.5px]">
            <span className="text-sub">{k}</span><span className="num text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kartu sebelum ada hasil. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-hint">
      <div className="flex max-w-[320px] flex-col gap-1.5 rounded-2xl bg-surface px-5 py-4" style={{ boxShadow: "var(--e2)", pointerEvents: "auto" }}>
        <span className="text-[16px] font-semibold">{title}</span>
        <span className="text-[13.5px] leading-normal text-sub">{body}</span>
      </div>
    </div>
  );
}

/** Putar dan zoom. */
export function ViewControls({ onZoom, onRotate }: { onZoom: (d: number) => void; onRotate: (d: number) => void }) {
  return (
    <div className="view-controls">
      <div className="fab-stack">
        <button className="icon-btn" onClick={() => onRotate(-20)} aria-label="Putar ke kiri" title="Putar ke kiri"><RotateCcw size={22} strokeWidth={1.8} /></button>
        <button className="icon-btn" onClick={() => onRotate(20)} aria-label="Putar ke kanan" title="Putar ke kanan"><RotateCw size={22} strokeWidth={1.8} /></button>
      </div>
      <div className="fab-stack">
        <button className="icon-btn" onClick={() => onZoom(1.15)} aria-label="Perbesar" title="Perbesar"><Plus size={22} strokeWidth={1.8} /></button>
        <button className="icon-btn" onClick={() => onZoom(1 / 1.15)} aria-label="Perkecil" title="Perkecil"><Minus size={22} strokeWidth={1.8} /></button>
      </div>
    </div>
  );
}

/** Legenda warna. */
export function Legend({ mode, ranges, pal }: { mode: ColorMode; ranges: Ranges; pal: Palette }) {
  const l = legend(mode, ranges, pal);
  return (
    <div className="legend">
      <span className="eyebrow">{l.title}</span>
      <span className="block h-2 w-[148px] rounded" style={{ background: l.grad }} />
      <span className="num flex justify-between text-[12px] text-sub"><span>{l.lo}</span><span>{l.hi}</span></span>
    </div>
  );
}
