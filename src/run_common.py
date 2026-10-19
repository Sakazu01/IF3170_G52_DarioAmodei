import json
import os
import random

import matplotlib
matplotlib.use("Agg")

from visualize import plot_per_truck_value, plot_state
import matplotlib.pyplot as plt

from algorithms.hill_climbing import (random_restart, sideways_move,
                                      steepest_ascent, stochastic)
from algorithms.genetic_algorithm import genetic_algorithm
from algorithms.simulated_annealing import simulated_annealing
from core.constraints import violations
from core.generator import random_state
from core.io import save_state
from core.objective import total_value
from core.stats import per_truck_stats, unplaced_packages

# tiap algoritma dipanggil sebagai run(inst, seed, **params)
# dan mengembalikan Result


def run_simulated_annealing(inst, seed, **params):
    rng = random.Random(seed)
    initial = random_state(inst, rng)
    return simulated_annealing(inst, initial, rng, **params)


def plot_objective(result, run_dir, run_id, algorithm):
    plt.figure()
    plt.plot(result.history)
    plt.xlabel("Iterasi")
    plt.ylabel("Objective function")
    plt.title("%s run %d - objective" % (algorithm, run_id))
    plt.savefig(os.path.join(run_dir, "objective.png"), bbox_inches="tight")
    plt.close()


def plot_probability(result, run_dir, run_id, algorithm):
    # plot khusus SA: e^(dE/T) terhadap iterasi
    if "prob_history" not in result.extras:
        return
    plt.figure()
    plt.plot(result.extras["prob_history"])
    plt.xlabel("Iterasi")
    plt.ylabel("e^(dE / T)")
    plt.title("%s run %d - acceptance probability" % (algorithm, run_id))
    plt.savefig(os.path.join(run_dir, "probability.png"), bbox_inches="tight")
    plt.close()


def plot_population(result, run_dir, run_id, algorithm):
    # plot khusus GA: objective maksimum dan rata-rata populasi
    plt.figure()
    plt.plot(result.history, label="maks")
    if "history_avg" in result.extras:
        plt.plot(result.extras["history_avg"], label="rata-rata")
    plt.xlabel("Generasi")
    plt.ylabel("Objective function")
    plt.title("%s run %d - populasi" % (algorithm, run_id))
    plt.legend()
    plt.savefig(os.path.join(run_dir, "population.png"), bbox_inches="tight")
    plt.close()


ALGORITHMS = {
    "simulated_annealing": {
        "run": run_simulated_annealing,
        "defaults": {
            "initial_temp": 100.0,
            "min_temp": 0.01,
            "cooling_rate": 0.95,
            "iterations_per_temp": 50,
        },
        "extra_plots": [plot_probability],
    },
    "steepest_ascent": {
        "run": lambda inst, seed, **p: steepest_ascent(inst, seed=seed, **p),
        "defaults": {"max_iter": 300, "n_neighbors": 30},
        "extra_plots": [],
    },
    "sideways_move": {
        "run": lambda inst, seed, **p: sideways_move(inst, seed=seed, **p),
        "defaults": {"max_iter": 300, "n_neighbors": 30, "max_sideways": 50},
        "extra_plots": [],
    },
    "stochastic": {
        "run": lambda inst, seed, **p: stochastic(inst, seed=seed, **p),
        "defaults": {"max_iter": 300, "n_neighbors": 30},
        "extra_plots": [],
    },
    "random_restart": {
        "run": lambda inst, seed, **p: random_restart(inst, seed=seed, **p),
        "defaults": {"max_iter": 200, "n_neighbors": 25, "max_restarts": 5},
        "extra_plots": [],
    },
    "genetic_algorithm": {
        "run": lambda inst, seed, **p: genetic_algorithm(inst, seed=seed, **p),
        "defaults": {"population_size": 20, "iterations": 50},
        "extra_plots": [plot_population],
    },
}

ALIASES = {
    "sa": "simulated_annealing",
    "hc": "steepest_ascent",
    "hc_steepest": "steepest_ascent",
    "hc_sideways": "sideways_move",
    "hc_stochastic": "stochastic",
    "hc_restart": "random_restart",
    "ga": "genetic_algorithm",
}


def resolve_algorithm(name):
    name = ALIASES.get(name, name)
    if name not in ALGORITHMS:
        raise KeyError("algoritma tidak dikenal: %s (pilihan: %s)" % (
            name, ", ".join(sorted(ALGORITHMS))))
    return name


def run_experiment(algorithm, inst, params=None, seed=42, runs=3,
                   out_dir="output/run", extra_plots=None):
    # harness semua algoritma: loop run, assert valid
    # simpan state + metrics (per-truck) + plottings
    algorithm = resolve_algorithm(algorithm)
    entry = ALGORITHMS[algorithm]
    run_fn = entry["run"]
    params = dict(params or {})
    merged = dict(entry["defaults"])
    merged.update(params)
    plot_fns = list(entry["extra_plots"] if extra_plots is None else extra_plots)

    os.makedirs(out_dir, exist_ok=True)
    records = []

    for run_id in range(1, runs + 1):
        run_seed = seed + run_id
        result = run_fn(inst, seed=run_seed, **merged)

        viol = violations(result.final_state, inst)
        if viol:
            raise AssertionError("final state run %d tidak valid:\n%s" % (
                run_id, "\n".join(viol)))

        run_dir = os.path.join(out_dir, "run%d" % run_id)
        os.makedirs(run_dir, exist_ok=True)

        initial_stats = per_truck_stats(result.initial_state, inst)
        final_stats = per_truck_stats(result.final_state, inst)

        save_state(result.initial_state, os.path.join(run_dir, "initial_state.json"))
        save_state(result.final_state, os.path.join(run_dir, "final_state.json"))

        metrics = {
            "algorithm": algorithm,
            "run": run_id,
            "seed": run_seed,
            "params": merged,
            "initial_value": total_value(result.initial_state, inst),
            "final_value": result.final_value,
            "iterations": len(result.history) - 1,
            "duration": result.duration,
            "per_truck": {"initial": initial_stats, "final": final_stats},
            "unplaced_final": unplaced_packages(result.final_state),
        }
        metrics.update(result.extras)
        with open(os.path.join(run_dir, "metrics.json"), "w") as f:
            json.dump(metrics, f, indent=2)

        plot_objective(result, run_dir, run_id, algorithm)
        plot_state(result.initial_state, inst,
                   os.path.join(run_dir, "initial_state.png"),
                   title="%s run %d - initial" % (algorithm, run_id))
        plot_state(result.final_state, inst,
                   os.path.join(run_dir, "final_state.png"),
                   title="%s run %d - final" % (algorithm, run_id))
        plot_per_truck_value(initial_stats, final_stats,
                             os.path.join(run_dir, "per_truck_value.png"),
                             title="%s run %d - value per truk" % (algorithm, run_id))
        for fn in plot_fns:
            fn(result, run_dir, run_id, algorithm)

        truck_values = ["truk %d=%d" % (s["truck"], s["value"]) for s in final_stats]
        print("run %d: value %d -> %d, iterasi=%d, durasi=%.3fs, %s" % (
            run_id, metrics["initial_value"], metrics["final_value"],
            metrics["iterations"], metrics["duration"], ", ".join(truck_values)))

        records.append(metrics)

    summary = {
        "algorithm": algorithm,
        "params": merged,
        "seed": seed,
        "runs": runs,
        "mean_final_value": sum(r["final_value"] for r in records) / len(records),
        "best_final_value": max(r["final_value"] for r in records),
        "mean_duration": sum(r["duration"] for r in records) / len(records),
        "results": records,
    }
    with open(os.path.join(out_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    print("ringkasan %s: mean=%d best=%d mean_durasi=%.3fs -> %s" % (
        algorithm, summary["mean_final_value"], summary["best_final_value"],
        summary["mean_duration"], out_dir))
    return summary
