import os

from experiment import SRC, sweep
from core.io import load_instance
from ga_experiment import GAExperiment
from sa_experiment import SAExperiment


if __name__ == "__main__":
    inst = load_instance(os.path.join(SRC, "data", "sample.json"))

    experiments = sweep(GAExperiment, inst, "iterations", [5, 10, 20], population_size=10)
    experiments.append(SAExperiment(inst, initial_temp=50, min_temp=1,
                                    cooling_rate=0.8, iterations_per_temp=10))

    for exp in experiments:
        exp.run()
        s = exp.summary()
        print("\n\t", s["name"], s["params"])
        print(f"mean {s['mean']:.0f}\nbest {s['best']}\nstdev {s['stdev']:.1f}\n"
              f"duration {s['mean_duration']:.1f}s")
