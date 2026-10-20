import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/types";

interface Running { key: string; id: string; started: number }

/** Kirim run ke server, polling sampai selesai. Hasil disimpan per "data|algoritma". */
export function useRunner(onError: (e: unknown) => void) {
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(Date.now());
  const failures = useRef(0);

  useEffect(() => {
    if (!running) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api.job(running.id);
        if (stop) return;
        failures.current = 0;
        if (j.status === "running") { timer = setTimeout(tick, 700); return; }
        setJobs((p) => ({ ...p, [running.key]: j }));
        if (j.status === "error") onError(new Error(j.error ?? "run gagal"));
        setRunning(null);
      } catch (e) {
        if (stop) return;
        if (++failures.current >= 5) { onError(e); setRunning(null); } else timer = setTimeout(tick, 1000);
      }
    };
    timer = setTimeout(tick, 400);
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => { stop = true; clearTimeout(timer); clearInterval(clock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const start = async (key: string, instance: string, algorithm: string, params: Record<string, number>, seed: number) => {
    try {
      const { id } = await api.run(instance, algorithm, params, seed);
      setRunning({ key, id, started: Date.now() });
      return true;
    } catch (e) { onError(e); return false; }
  };

  return { jobs, running, elapsed: running ? (now - running.started) / 1000 : 0, start };
}
