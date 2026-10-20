import type { Truck } from "@/types";

/** Posisi truk di peta: truk mana yang tampil dan di mana letaknya. */
export interface Layout {
  visible: number[];   // indeks truk yang digambar
  ox: number[];        // geser tiap truk (satuan data)
  oy: number[];
  width: number;       // ukuran seluruh susunan
  length: number;
  scale: number;       // piksel per satuan sebelum zoom
  multi: boolean;
  all: boolean;        // semua truk tampil berdampingan
}

const GAP = 3;

/** Satu baris sampai 4 truk, selebihnya dua baris. Fokus ke satu truk menampilkan truk itu saja. */
export function layoutTrucks(trucks: Truck[], focus: number | "all"): Layout {
  const n = trucks.length;
  const multi = n > 1;
  const all = multi && focus === "all";
  const one = Math.min(focus === "all" ? 0 : focus, n - 1);
  const visible = all ? trucks.map((_, i) => i) : [one];
  const ox = trucks.map(() => 0);
  const oy = trucks.map(() => 0);

  let width: number, length: number;
  if (all) {
    const cols = n > 4 ? Math.ceil(n / 2) : n;
    const rows = Math.ceil(n / cols);
    const colW: number[] = [], rowL: number[] = [];
    trucks.forEach((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      colW[c] = Math.max(colW[c] ?? 0, t.w);
      rowL[r] = Math.max(rowL[r] ?? 0, t.l);
    });
    const colX: number[] = [], rowY: number[] = [];
    let a = 0;
    for (let c = 0; c < cols; c++) { colX[c] = a; a += colW[c] + GAP; }
    width = a - GAP;
    a = 0;
    for (let r = 0; r < rows; r++) { rowY[r] = a; a += rowL[r] + GAP; }
    length = a - GAP;
    trucks.forEach((_, i) => { ox[i] = colX[i % cols]; oy[i] = rowY[Math.floor(i / cols)]; });
  } else {
    width = trucks[one].w;
    length = trucks[one].l;
  }
  const scale = all ? Math.min(24, 880 / Math.hypot(width, length)) : 38;
  return { visible, ox, oy, width, length, scale, multi, all };
}
