import random

from experiment import Experiment, sweep
from algorithms.simulated_annealing import simulated_annealing
from core.generator import random_state


class SAExperiment(Experiment):
    name = "simulated_annealing"
    family = "simulated_annealing"

    def run_once(self, seed):
        rng = random.Random(seed)
        initial = random_state(self.inst, rng)
        return simulated_annealing(self.inst, initial, rng, **self.params)

    INITIAL_TEMP, MIN_TEMP, COOLING, PER_TEMP = 50, 1, 0.8, 10
    COOLING_VALUES = [0.5, 0.8, 0.95]

    @classmethod
    def vary_cooling(cls, inst, runs=3):
        return sweep(cls, inst, "cooling_rate", cls.COOLING_VALUES, runs, initial_temp=cls.INITIAL_TEMP,
                     min_temp=cls.MIN_TEMP, iterations_per_temp=cls.PER_TEMP)
