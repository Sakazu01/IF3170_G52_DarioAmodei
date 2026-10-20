import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Algo, InstanceItem } from "@/types";

/** Ambil daftar data dan algoritma dari server. */
export function useCatalog(onError: (e: unknown) => void) {
  const [items, setItems] = useState<InstanceItem[]>([]);
  const [algos, setAlgos] = useState<Algo[]>([]);

  useEffect(() => {
    Promise.all([api.instances(), api.algorithms()])
      .then(([its, als]) => { setItems(its); setAlgos(als); })
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadItems = useCallback(() => api.instances().then(setItems).catch(onError), [onError]);
  return { items, algos, reloadItems };
}
