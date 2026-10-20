import type { Algo, ExpSummary, Instance, InstanceItem, Job } from "@/types";

export class ApiError extends Error {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.details = details;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("Server Python tidak terjangkau. Jalankan: python server.py");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? res.statusText, body.errors ?? []);
  return body as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  instances: () => call<InstanceItem[]>("/api/instances"),
  instance: (name: string) => call<Instance>("/api/instance/" + encodeURIComponent(name)),
  experiments: () => call<Record<string, ExpSummary[]>>("/api/experiments"),
  algorithms: () => call<Algo[]>("/api/algorithms"),
  upload: (name: string, content: string) => call<{ name: string }>("/api/instances", post({ name, content })),
  run: (instance: string, algorithm: string, params: Record<string, number>, seed: number) =>
    call<{ id: string }>("/api/run", post({ instance, algorithm, params, seed })),
  job: (id: string) => call<Job>("/api/job/" + id),
};
