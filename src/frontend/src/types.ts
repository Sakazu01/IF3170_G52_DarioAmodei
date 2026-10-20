/** [x, y, z, w, l, h, truk], ukuran setelah rotasi */
export type Box = [number, number, number, number, number, number, number];

export interface Truck { w: number; l: number; h: number; cap: number }
export interface Pkg { w: number; l: number; h: number; value: number; weight: number; fragile: boolean; eta: number }
export interface Instance { name: string; trucks: Truck[]; packages: Record<string, Pkg>; upper_bound: number }
export interface InstanceItem { name: string; source: "bawaan" | "upload"; trucks?: number; packages?: number; error?: string }
export interface Algo { key: string; name: string; code: string; group: string; defaults: Record<string, number> }

export interface TruckStat {
  truck: number; value: number; weight_used: number; max_capacity: number;
  capacity_utilization: number; package_count: number;
  volume_used: number; truck_volume: number; volume_utilization: number; package_ids: string[];
}
export interface View { boxes: Record<string, Box>; stats: TruckStat[]; unplaced: string[]; value: number }

export interface Job {
  id: string; instance: string; algorithm: string; seed: number;
  status: "running" | "done" | "error"; elapsed: number; error?: string;
  initial?: View; final?: View; params?: Record<string, number>;
  duration?: number; iterations?: number;
  /** metrik khusus algoritma */
  extras?: Record<string, number | number[]>;
  history?: number[]; prob_history?: number[] | null; history_avg?: number[] | null;
  /** SA: stuck kumulatif */
  stuck_history?: number[] | null;
}

export type ColorMode = "value" | "fragile" | "weight";
export type ViewKind = "initial" | "final";

/** Ringkasan satu setelan eksperimen */
export interface ExpSummary {
  name: string; params: Record<string, number>;
  mean: number; best: number; stdev: number; mean_duration: number; mean_iterations?: number;
  values: number[];
  runs: ExpRun[];
}

/** Satu run dalam eksperimen */
export interface ExpRun {
  seed: number | null; initial_value: number | null; final_value: number;
  iterations: number; duration: number;
  history: number[]; history_avg: number[] | null;
  extras: Record<string, number | number[]>;
}

/** Chip di popup paket */
export interface ChipItem { id: string; text: string }
