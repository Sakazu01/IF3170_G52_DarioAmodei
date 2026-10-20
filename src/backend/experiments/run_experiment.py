import argparse
import os

from experiment import SRC
from core.io import load_instance
from ga_experiment import GAExperiment
from hc_experiment import (RandomRestartExperiment, SidewaysExperiment, SteepestExperiment,
                           StochasticExperiment, all_hill_climbing)
from sa_experiment import SAExperiment


def build(group, inst, runs):
    experiments = []
    if group == "base":      # satu konfigurasi default tiap algoritma, untuk menguji banyak kasus sekaligus
        return base(inst, runs)
    if group in ("ga", "all"):
        experiments += GAExperiment.vary_iterations(inst, runs) + GAExperiment.vary_population(inst, runs)
    if group in ("sa", "all"):
        experiments += SAExperiment.vary_cooling(inst, runs)
    if group in ("hc", "all"):
        experiments += all_hill_climbing(inst, runs)
    return experiments


def base(inst, runs):
    return ([GAExperiment(inst, runs=runs, iterations=GAExperiment.ITERATION_CONTROL,
                          population_size=GAExperiment.POPULATION_CONTROL),
             SAExperiment(inst, runs=runs, initial_temp=50, min_temp=1, cooling_rate=0.8, iterations_per_temp=10)]
            + [cls(inst, runs=runs, n_neighbors=30, **extra) for cls, extra in (
                (SteepestExperiment, {"max_iter": 300}), (StochasticExperiment, {"max_iter": 300}),
                (SidewaysExperiment, {"max_iter": 300, "max_sideways": 50}),
                (RandomRestartExperiment, {"max_iter": 200, "max_restarts": 5}))])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Eksperimen parameter: hasil disimpan ke output/experiments.")
    parser.add_argument("group", nargs="?", default="all", choices=["hc", "sa", "ga", "all", "base"])
    parser.add_argument("--instance", default=os.path.join(SRC, "data", "dasar_1truk_50paket.json"))
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()

    inst = load_instance(args.instance)
    # hasil di <root repo>/output/experiments/<jenis algoritma>/<data>_<algoritma>_<parameter>.json
    stem = os.path.splitext(os.path.basename(args.instance))[0]
    root = os.path.abspath(os.path.join(SRC, "..", "..", "output", "experiments"))
    for exp in build(args.group, inst, args.runs):
        exp.instance_name = stem
        exp.run()
        s = exp.summary()
        exp.save(os.path.join(root, exp.family))
        print("\n\t", s["name"], s["params"])
        print(f"mean {s['mean']:.0f}\nbest {s['best']}\nstdev {s['stdev']:.1f}\n"
              f"iterations {s['mean_iterations']:.0f}\nduration {s['mean_duration']:.1f}s")
