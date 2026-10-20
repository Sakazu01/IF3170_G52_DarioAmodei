import json
import os
import re
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..")
sys.path.insert(0, SRC)
 
from core.constraints import is_valid
from core.objective import total_value


def to_json(data):
    """JSON berindent; list dan dict paling dalam tetap satu baris supaya file tidak terlalu panjang."""
    text = json.dumps(data, indent=2)
    leaf = re.compile(r"([\[{])\s*([^\[\]{}]*?)\s*([\]}])")
    return leaf.sub(lambda m: m.group(1) + re.sub(r"\s*\n\s*", " ", m.group(2)) + m.group(3), text)


def state_to_dict(state):
    result = {}
    for pid, pl in state.placements.items():
        if pl is None:
            result[pid] = None
        else:
            result[pid] = {"truck": pl.truck, "x": pl.x, "y": pl.y,
                           "z": pl.z, "orient": pl.orient.value}
    return result


class Experiment:
    name = "experiment"
    family = "other"          # folder hasil: hill_climbing, simulated_annealing, genetic_algorithm
    instance_name = ""        # nama data yang dipakai, diisi run_experiment

    def __init__(self, inst, runs=3, seed=0, **params):
        self.inst = inst
        self.runs = runs
        self.seed = seed
        self.params = params
        self.records = []

    def run_once(self, seed):
        raise NotImplementedError

    def run(self):
        self.records = []
        for i in range(self.runs):
            result = self.run_once(self.seed + i)
            assert is_valid(result.final_state, self.inst), "final state tidak memenuhi constraint"
            self.records.append(self.make_record(i, result))
        return self.records

    def make_record(self, i, result):
        record = {
            "run": i,
            "seed": self.seed + i,
            "initial_state": state_to_dict(result.initial_state),
            "final_state": state_to_dict(result.final_state),
            "initial_value": total_value(result.initial_state, self.inst),
            "final_value": result.final_value,
            "iterations": len(result.history) - 1,
            "duration": result.duration,
            "history": result.history,
        }
        record.update(result.extras)
        return record

    def summary(self):
        values = []
        durations = []
        iterations = []
        for record in self.records:
            values.append(record["final_value"])
            durations.append(record["duration"])
            iterations.append(record["iterations"])

        return {
            "name": self.name,
            "instance": self.instance_name,
            "params": self.params,
            "mean": statistics.mean(values),
            "best": max(values),
            "stdev": statistics.pstdev(values),
            "mean_duration": statistics.mean(durations),
            "mean_iterations": statistics.mean(iterations),
        }

    def save(self, folder="output"):
        os.makedirs(folder, exist_ok=True)

        tag = ""
        for key in sorted(self.params):
            tag += "_" + key + str(self.params[key])

        path = os.path.join(folder, self.instance_name + "_" + self.name + tag + ".json")
        with open(path, "w") as f:
            f.write(to_json({"summary": self.summary(), "records": self.records}))
        return path


def sweep(experiment_class, inst, param, values, runs=3, **fixed):
    experiments = []
    for value in values:
        params = dict(fixed)
        params[param] = value
        experiments.append(experiment_class(inst, runs=runs, **params))
    return experiments
