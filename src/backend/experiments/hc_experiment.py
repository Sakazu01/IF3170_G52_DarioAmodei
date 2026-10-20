from experiment import Experiment, sweep
from algorithms.hill_climbing import (random_restart, sideways_move,
                                      steepest_ascent, stochastic)


class HCExperiment(Experiment):
    """Dasar semua eksperimen hill climbing: subclass cukup mengisi algorithm dan nilai sweep."""
    family = "hill_climbing"
    algorithm = None

    def run_once(self, seed):
        return self.algorithm(self.inst, seed=seed, **self.params)


class SteepestExperiment(HCExperiment):
    name = "steepest_ascent"
    algorithm = staticmethod(steepest_ascent)

    NEIGHBOR_CONTROL = 30
    ITER_CONTROL = 300
    NEIGHBOR_VALUES = [10, 30, 100]

    @classmethod
    def vary_neighbors(cls, inst, runs=3):
        return sweep(cls, inst, "n_neighbors", cls.NEIGHBOR_VALUES, runs,
                     max_iter=cls.ITER_CONTROL)


class StochasticExperiment(SteepestExperiment):
    name = "stochastic"
    algorithm = staticmethod(stochastic)


class SidewaysExperiment(HCExperiment):
    name = "sideways_move"
    algorithm = staticmethod(sideways_move)

    SIDEWAYS_VALUES = [0, 10, 50]      # 0 = sama dengan steepest ascent
    NEIGHBOR_CONTROL = 30
    ITER_CONTROL = 300

    @classmethod
    def vary_sideways(cls, inst, runs=3):
        return sweep(cls, inst, "max_sideways", cls.SIDEWAYS_VALUES, runs,
                     n_neighbors=cls.NEIGHBOR_CONTROL, max_iter=cls.ITER_CONTROL)


class RandomRestartExperiment(HCExperiment):
    name = "random_restart"
    algorithm = staticmethod(random_restart)

    RESTART_VALUES = [0, 5, 20]         # 0 = hanya satu kali climb
    NEIGHBOR_CONTROL = 30
    ITER_CONTROL = 200

    @classmethod
    def vary_restarts(cls, inst, runs=3):
        return sweep(cls, inst, "max_restarts", cls.RESTART_VALUES, runs,
                     n_neighbors=cls.NEIGHBOR_CONTROL, max_iter=cls.ITER_CONTROL)


def all_hill_climbing(inst, runs=3):
    """Semua sweep hill climbing: 4 algoritma."""
    return (SteepestExperiment.vary_neighbors(inst, runs)
            + StochasticExperiment.vary_neighbors(inst, runs)
            + SidewaysExperiment.vary_sideways(inst, runs)
            + RandomRestartExperiment.vary_restarts(inst, runs))
