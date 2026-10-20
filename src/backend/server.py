"""Server lokal untuk frontend.

Alur satu run:
  1. frontend kirim POST /api/run (instance, algoritma, parameter, seed)
  2. start_job() cek input, lalu run_job() jalan di thread sendiri
  3. run_job() memanggil algoritma yang sama dengan run.py, lalu mengubah state jadi data kotak 3D
  4. frontend polling GET /api/job/<id> sampai status "done", lalu menggambar hasilnya

Jalankan: cd src/backend && python server.py  (buka http://127.0.0.1:8000)
"""
import argparse
import json
import mimetypes
import os
import sys
import threading
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(HERE, "..", "frontend", "dist"))
UPLOADS = os.path.join(HERE, "uploads")
EXPERIMENTS = os.path.abspath(os.path.join(HERE, "..", "..", "output", "experiments"))

# nama tampil dan kelompok di UI
NAMES = {
    "steepest_ascent": ("Steepest ascent", "HC", "Hill climbing"),
    "sideways_move": ("Sideways move", "HC", "Hill climbing"),
    "stochastic": ("Stochastic", "HC", "Hill climbing"),
    "random_restart": ("Random restart", "HC", "Hill climbing"),
    "simulated_annealing": ("Simulated annealing", "SA", "Simulated annealing"),
    "genetic_algorithm": ("Genetic algorithm", "GA", "Genetic algorithm"),
}
TYPES = {".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml", ".json": "application/json"}
RUN_EXTRAS = ("sideways_used", "restarts", "iterations_per_restart", "stuck_count")   # metrik per run yang ikut ditampilkan
SERIES = ("prob_history", "history_avg", "stuck_history")   # deret untuk grafik, bukan angka ringkasan
JOBS = {}   # id -> job (disimpan di memori saja)
R = {}      # fungsi dari core/ dan run_common, diisi load_modules()


def load_modules():
    sys.dont_write_bytecode = True
    sys.path.insert(0, HERE)
    from core.io import load_instance
    from core.constraints import get_box, violations
    from core.objective import total_value
    from core.stats import per_truck_stats, unplaced_packages
    from run_common import ALGORITHMS
    R.update(data=os.path.join(HERE, "data"), load=load_instance, get_box=get_box,
             violations=violations, value=total_value, stats=per_truck_stats,
             unplaced=unplaced_packages, algos=ALGORITHMS)


# ---------- data input ----------

def find_instance(name):
    """Cari di data/ lalu uploads/. basename mencegah path keluar folder."""
    for folder in (R["data"], UPLOADS):
        path = os.path.join(folder, os.path.basename(name or ""))
        if name and name.endswith(".json") and os.path.isfile(path):
            return path
    raise KeyError(name)


def instance_json(name):
    inst = R["load"](find_instance(name))
    return {
        "name": name,
        "trucks": [{"w": t.dims.w, "l": t.dims.l, "h": t.dims.h, "cap": t.max_capacity} for t in inst.trucks],
        "packages": {p.id: {"w": p.dims.w, "l": p.dims.l, "h": p.dims.h, "value": p.value,
                            "weight": p.weight, "fragile": bool(p.is_fragile), "eta": p.eta}
                     for p in inst.packages},
        "upper_bound": sum(p.value for p in inst.packages),   # semua paket masuk
    }


def list_instances():
    out = []
    for source, folder in (("bawaan", R["data"]), ("upload", UPLOADS)):
        for fn in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            if not fn.endswith(".json"):
                continue
            try:
                inst = R["load"](os.path.join(folder, fn))
                out.append({"name": fn, "source": source, "trucks": len(inst.trucks), "packages": len(inst.packages)})
            except Exception as e:   # satu file rusak jangan menjatuhkan seluruh daftar
                out.append({"name": fn, "source": source, "error": str(e).splitlines()[0]})
    return out


def save_upload(name, content):
    """Simpan dulu, lalu validasi pakai load_instance. Kalau gagal, hapus lagi. Return daftar masalah."""
    name = os.path.basename(name or "")
    if not name.endswith(".json"):
        return ["nama file harus berakhiran .json"]
    os.makedirs(UPLOADS, exist_ok=True)
    path = os.path.join(UPLOADS, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    try:
        R["load"](path)
    except ValueError as e:
        os.unlink(path)
        return str(e).replace("instance tidak valid:\n", "").splitlines()
    except (KeyError, TypeError, json.JSONDecodeError) as e:
        os.unlink(path)
        return ["struktur JSON tidak sesuai (%s %s)" % (type(e).__name__, e)]
    return []


def algorithms_json():
    out = []
    for key, algo in R["algos"].items():
        name, code, group = NAMES.get(key, (key, "?", "Lainnya"))
        out.append({"key": key, "name": name, "code": code, "group": group, "defaults": algo["defaults"]})
    return out


# ---------- menjalankan algoritma ----------

def start_job(body):
    """Validasi input dari frontend, buat job, jalankan di thread supaya request langsung kembali."""
    key = body.get("algorithm")
    if key not in R["algos"]:
        raise ValueError("algoritma tidak dikenal")
    defaults = R["algos"][key]["defaults"]

    params = {}
    for k, v in (body.get("params") or {}).items():
        if k not in defaults or isinstance(v, bool) or not isinstance(v, (int, float)) or v < 0:
            raise ValueError("parameter tidak valid: %s" % k)
        params[k] = int(v) if isinstance(defaults[k], int) else float(v)   # tipe ikut default

    seed = body.get("seed", 1)
    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
        raise ValueError("seed harus bilangan bulat >= 0")
    find_instance(body.get("instance"))

    job = {"id": uuid.uuid4().hex[:10], "instance": body["instance"], "algorithm": key,
           "params": params, "seed": seed, "status": "running"}
    JOBS[job["id"]] = job
    threading.Thread(target=run_job, args=(job,), daemon=True).start()
    return job


def run_job(job):
    try:
        inst = R["load"](find_instance(job["instance"]))
        algo = R["algos"][job["algorithm"]]
        params = {**algo["defaults"], **job["params"]}   # yang tidak diisi pakai default
        res = algo["run"](inst, seed=job["seed"], **params)

        bad = R["violations"](res.final_state, inst)     # hasil harus memenuhi semua constraint
        if bad:
            raise AssertionError("state akhir tidak valid:\n" + "\n".join(bad[:10]))

        job["data"] = {
            "initial": view_of(res.initial_state, inst),
            "final": view_of(res.final_state, inst),
            "params": params,
            "duration": res.duration,
            "iterations": len(res.history) - 1,
            "extras": {k: v for k, v in res.extras.items() if k not in SERIES},
            "history": downsample(res.history),
            "prob_history": downsample(res.extras["prob_history"]) if "prob_history" in res.extras else None,
            "history_avg": downsample(res.extras["history_avg"]) if "history_avg" in res.extras else None,
            "stuck_history": downsample(res.extras["stuck_history"]) if "stuck_history" in res.extras else None,
        }
        job["status"] = "done"
    except Exception as e:
        traceback.print_exc()
        job["status"], job["error"] = "error", "%s: %s" % (type(e).__name__, e)


def view_of(state, inst):
    """State -> data untuk digambar: tiap paket jadi [x, y, z, w, l, h, truk] (ukuran setelah rotasi)."""
    boxes = {}
    for pid, pl in state.placements.items():
        if pl is not None:   # None = tidak dimuat
            b = R["get_box"](inst.by_id[pid], pl)
            boxes[pid] = [*b[:6], pl.truck]
    return {"boxes": boxes, "stats": R["stats"](state, inst), "unplaced": R["unplaced"](state),
            "value": R["value"](state, inst)}


def downsample(seq, n=400):
    """Grafik cukup n titik, jadi riwayat yang panjang diambil merata."""
    if len(seq) <= n:
        return list(seq)
    step = (len(seq) - 1) / (n - 1)
    return [seq[round(i * step)] for i in range(n)]


def job_json(job):
    out = {k: job[k] for k in ("id", "instance", "algorithm", "seed", "status")}
    if job["status"] == "done":
        out.update(job["data"])
    if job["status"] == "error":
        out["error"] = job["error"]
    return out


# ---------- hasil eksperimen ----------

def run_json(r):
    """Satu run dalam eksperimen: cukup seed, hasil, dan kurva untuk grafik (state ada di file JSON-nya)."""
    return {"seed": r.get("seed"), "final_value": r["final_value"], "initial_value": r.get("initial_value"),
            "iterations": r["iterations"], "duration": r["duration"],
            "history": downsample(r["history"]),
            "history_avg": downsample(r["history_avg"]) if "history_avg" in r else None,
            "extras": {k: r[k] for k in RUN_EXTRAS if k in r}}


def list_experiments():
    """Baca output/experiments/<jenis algoritma>/*.json (ditulis experiments/run_experiment.py), dikelompokkan per data."""
    out = {}
    for family in sorted(os.listdir(EXPERIMENTS)) if os.path.isdir(EXPERIMENTS) else []:
        folder = os.path.join(EXPERIMENTS, family)
        for fn in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            if not fn.endswith(".json"):
                continue
            try:
                raw = pd.read_json(os.path.join(folder, fn), typ="series")
                runs = pd.DataFrame(raw["records"])
                summary = raw["summary"]
                item = {**summary, "values": runs["final_value"].tolist(),
                        "runs": [run_json({k: v for k, v in r.items() if isinstance(v, list) or pd.notna(v)})
                                 for r in runs.to_dict("records")]}
                out.setdefault(summary.get("instance") or family, []).append(item)
            except (ValueError, KeyError, TypeError):   # file rusak dilewati saja
                continue
    return out


# ---------- HTTP ----------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        if not isinstance(body, bytes):
            body = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def error(self, code, msg, **more):
        self.send(code, {"error": msg, **more})

    def do_GET(self):
        u = urlparse(self.path)
        p = [unquote(x) for x in u.path.strip("/").split("/")]
        try:
            if p[0] != "api":
                return self.static(u.path)   # selain /api = file frontend
            if p == ["api", "instances"]:
                return self.send(200, list_instances())
            if p == ["api", "algorithms"]:
                return self.send(200, algorithms_json())
            if p == ["api", "experiments"]:
                return self.send(200, list_experiments())
            if p[:2] == ["api", "instance"] and len(p) == 3:
                return self.send(200, instance_json(p[2]))
            if p[:2] == ["api", "job"] and len(p) == 3:
                return self.send(200, job_json(JOBS[p[2]]))
            self.error(404, "endpoint tidak ada")
        except KeyError:
            self.error(404, "tidak ditemukan")
        except Exception as e:
            traceback.print_exc()
            self.error(500, "%s: %s" % (type(e).__name__, e))

    def do_POST(self):
        path = urlparse(self.path).path.strip("/")
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            if path == "api/run":
                return self.send(202, {"id": start_job(body)["id"]})
            if path == "api/instances":
                errors = save_upload(body.get("name"), body.get("content", ""))
                if errors:
                    return self.error(422, "instance tidak valid", errors=errors)
                return self.send(201, {"name": os.path.basename(body["name"])})
            self.error(404, "endpoint tidak ada")
        except (ValueError, KeyError, json.JSONDecodeError) as e:
            self.error(400, str(e))
        except Exception as e:
            traceback.print_exc()
            self.error(500, "%s: %s" % (type(e).__name__, e))

    def static(self, path):
        if not os.path.isdir(DIST):
            msg = b"<p>Frontend belum dibuild: jalankan <code>npm install &amp;&amp; npm run build</code> di src/frontend.</p>"
            return self.send(200, msg, "text/html")
        full = os.path.abspath(os.path.join(DIST, os.path.normpath(unquote(path).lstrip("/"))))
        if not full.startswith(DIST + os.sep) or not os.path.isfile(full):
            full = os.path.join(DIST, "index.html")
        ext = os.path.splitext(full)[1].lower()   # Windows kadang salah mengenali .js, jadi ditulis langsung
        ctype = TYPES.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            self.send(200, f.read(), ctype)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Server lokal untuk frontend.")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    load_modules()
    print("buka http://127.0.0.1:%d" % args.port)
    try:
        ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
