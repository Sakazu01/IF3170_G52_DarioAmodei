import { Box as BoxIcon, Moon, Sun } from "lucide-react";
import type { ThemeName } from "@/lib/theme";

/** Kepala panel kiri. */
export function PanelHeader({ theme, onToggleTheme }: { theme: ThemeName; onToggleTheme: () => void }) {
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-3 px-5 pb-4 pt-5">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px]" style={{ background: "var(--tint)", color: "var(--accd)" }}>
        <BoxIcon size={20} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[18px] font-semibold tracking-[-.01em]">DarioAmodei</span>
        <span className="text-[12.5px] text-sub">IF3170 Tugas Besar 1 · Local Search</span>
      </span>
      <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: "50%" }} onClick={onToggleTheme}
        aria-label={dark ? "Pakai tema terang" : "Pakai tema gelap"} title={dark ? "Tema terang" : "Tema gelap"}>
        {dark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
      </button>
    </div>
  );
}

interface RunBarProps {
  total: string;
  focusTag: string;
  busy: boolean;
  elapsed: number;
  hasRun: boolean;
  disabled: boolean;
  reason?: string;
  onRun: () => void;
}

/** Total value dan tombol Jalankan. */
export function RunBar(p: RunBarProps) {
  return (
    <div className="foot">
      {p.busy && <span className="progress"><i /></span>}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow" style={{ letterSpacing: ".06em" }}>Total value{p.focusTag}</span>
        <span className="num text-[30px] font-semibold leading-[1.05] tracking-[-.02em]">{p.total}</span>
      </div>
      <button className="run" onClick={p.onRun} disabled={p.disabled} title={p.reason}>
        {p.busy ? (
          <svg className="spin" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="3" />
            <path d="M12 4a8 8 0 0 1 8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        )}
        {p.busy ? `Menjalankan… ${p.elapsed.toFixed(0)} s` : p.hasRun ? "Jalankan ulang" : "Jalankan"}
      </button>
    </div>
  );
}
