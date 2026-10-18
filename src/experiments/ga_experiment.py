from experiment import Experiment
from algorithms.genetic_algorithm import genetic_algorithm


class GAExperiment(Experiment):
    name = "genetic_algorithm"

    def run_once(self, seed):
        return genetic_algorithm(self.inst, seed=seed, **self.params)
