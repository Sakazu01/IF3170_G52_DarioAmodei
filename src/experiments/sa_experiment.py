import random

from experiment import Experiment
from algorithms.simulated_annealing import simulated_annealing
from core.generator import random_state


class SAExperiment(Experiment):
    name = "simulated_annealing"

    def run_once(self, seed):
        rng = random.Random(seed)
        initial = random_state(self.inst, rng)
        return simulated_annealing(self.inst, initial, rng, **self.params)
