import math
import time

from core.model import Result
from core.moves import random_neighbor
from core.objective import total_value


def simulated_annealing(inst, initial_state, rng, initial_temp=100.0,
                        min_temp=0.01, cooling_rate=0.95,
                        iterations_per_temp=50):
    start = time.perf_counter()

    current = initial_state
    current_value = total_value(current, inst)
    best = current
    best_value = current_value

    history = [current_value]
    prob_history = []
    stuck_count = 0

    temp = initial_temp
    while temp > min_temp:
        for _ in range(iterations_per_temp):
            neighbor = random_neighbor(current, inst, rng)
            if neighbor is None:
                continue

            neighbor_value = total_value(neighbor, inst)
            delta = neighbor_value - current_value

            if delta >= 0:
                prob = 1.0
            else:
                prob = math.exp(delta / temp)
            prob_history.append(prob)

            if delta >= 0 or rng.random() < prob:
                current = neighbor
                current_value = neighbor_value

            if neighbor_value > best_value:
                best = neighbor
                best_value = neighbor_value
            else:
                stuck_count += 1

            history.append(current_value)

        temp *= cooling_rate

    duration = time.perf_counter() - start
    extras = {
        "stuck_count": stuck_count,
        "final_temperature": temp,
        "prob_history": prob_history,
    }
    
    return Result(initial_state, best, best_value, history, duration, extras)
