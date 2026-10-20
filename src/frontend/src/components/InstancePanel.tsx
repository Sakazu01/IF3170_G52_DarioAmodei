import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { InstanceItem } from "@/types";

interface Props {
  items: InstanceItem[];
  selected: string;
  onSelect: (name: string) => void;
  onUploaded: (name: string) => void;
}

/** Seksi 1 · Data input */
export default function InstancePanel({ items, selected, onSelect, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<{ file: string; list: string[] } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setProblems(null);
    try {
      const res = await api.upload(f.name, await f.text());
      onUploaded(res.name);
    } catch (err) {
      const a = err as ApiError;
      setProblems({ file: f.name, list: a.details?.length ? a.details : [a.message] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-section">
      <span className="eyebrow sec-title">1 · Data input</span>
      {items.map((it) => {
        const on = it.name === selected;
        return (
          <button key={it.name} disabled={!!it.error} onClick={() => onSelect(it.name)}
            className={on ? "item on" : "item"} aria-pressed={on}>
            <span className="radio"><i /></span>
            <span className="flex min-w-0 flex-col">
              <span className="item-name truncate">{it.name}</span>
              <span className="item-sub">
                {it.error ? "tidak valid: " + it.error : `${it.trucks} truk · ${it.packages} paket${it.source === "upload" ? " · upload" : ""}`}
              </span>
            </span>
          </button>
        );
      })}
      <div className="flex flex-col gap-2.5 px-3 pt-2">
        <label className="upload-btn self-start" aria-disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <Upload size={18} strokeWidth={1.8} />}
          Pilih file JSON
          <input className="sr-only" type="file" accept=".json,application/json" onChange={onFile} />
        </label>
        {problems ? (
          <div role="alert" className="whitespace-pre-line text-[13px] leading-normal" style={{ color: "var(--err)" }}>
            {problems.file}: {problems.list.length} masalah{"\n"}
            {problems.list.slice(0, 4).join("\n")}{problems.list.length > 4 ? "\n…" : ""}
          </div>
        ) : (
          <div className="text-[13px] leading-normal text-sub">Aturan validasi sama persis dengan <span className="mono text-[12px]">load_instance</span> di repo.</div>
        )}
      </div>
    </div>
  );
}
