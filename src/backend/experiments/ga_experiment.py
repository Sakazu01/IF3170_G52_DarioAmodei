from experiment import Experiment, sweep
from algorithms.genetic_algorithm import genetic_algorithm


class GAExperiment(Experiment):
    name = "genetic_algorithm"
    family = "genetic_algorithm"

    POPULATION_CONTROL = 20
    ITERATION_VALUES = [10, 50, 150]
    ITERATION_CONTROL = 50
    POPULATION_VALUES = [5, 30, 100]

    def run_once(self, seed):
        return genetic_algorithm(self.inst, seed=seed, **self.params)

    @classmethod
    def vary_iterations(cls, inst, runs=3):
        return sweep(cls, inst, "iterations", cls.ITERATION_VALUES, runs,
                     population_size=cls.POPULATION_CONTROL)

    @classmethod
    def vary_population(cls, inst, runs=3):
        return sweep(cls, inst, "population_size", cls.POPULATION_VALUES, runs,
                     iterations=cls.ITERATION_CONTROL)
