import random
import sys
import time
from core.model import Result
from core.io import load_instance, save_state
from core.constraints import is_valid
from core.objective import total_value
from core.generator import random_state
from core.moves import sample_neighbors


def climb(inst, rng, state, mode, max_iter, n_neighbors, max_sideways):
    cur = state
    cur_val = total_value(cur, inst)
    history = [cur_val]
    sideways = 0

    for _ in range(max_iter):
        neighbors = sample_neighbors(cur, inst, rng, n_neighbors)
        if len(neighbors) == 0:
            break
        scored = [(total_value(nb, inst), nb) for nb in neighbors] 

        if mode == "stochastic":
            better = [s for s in scored if s[0] > cur_val]
            best_val, best = rng.choice(better) if better else max(scored, key=lambda s: s[0])
        else:
            best_val, best = max(scored, key=lambda s: s[0])

        if best_val > cur_val:
            sideways = 0
        elif best_val == cur_val and sideways < max_sideways:
            sideways += 1
        else:
            break   

        cur, cur_val = best, best_val
        history.append(cur_val)

    return cur, history, {"sideways_used": sideways}


def single_run(inst, seed, init_state, mode, max_iter, n_neighbors, max_sideways):
    rng = random.Random(seed)
    start = time.time()
    initial = init_state if init_state is not None else random_state(inst, rng)
    final, history, extras = climb(inst, rng, initial, mode, max_iter, n_neighbors, max_sideways)
    return Result(initial, final, total_value(final, inst), history, time.time() - start, extras)


# 1. Steepest ascent: ambil neighbor terbaik, berhenti jika tidak ada yang lebih baik.
def steepest_ascent(inst, seed=None, init_state=None, max_iter=1000, n_neighbors=50):
    return single_run(inst, seed, init_state, "steepest", max_iter, n_neighbors, 0)


# 2. Sideways move: sama seperti steepest, tapi boleh pindah ke neighbor bernilai sama.
def sideways_move(inst, seed=None, init_state=None, max_iter=1000, n_neighbors=50, max_sideways=100):
    return single_run(inst, seed, init_state, "steepest", max_iter, n_neighbors, max_sideways)


# 3. Stochastic: pilih acak satu dari neighbor yang lebih baik.
def stochastic(inst, seed=None, init_state=None, max_iter=1000, n_neighbors=50):
    return single_run(inst, seed, init_state, "stochastic", max_iter, n_neighbors, 0)


# 4. Random restart: ulangi steepest ascent dari state acak, ambil hasil terbaik.
def random_restart(inst, seed=None, init_state=None, max_iter=1000, n_neighbors=50, max_restarts=10):
    rng = random.Random(seed)
    start = time.time()
    initial = init_state if init_state is not None else random_state(inst, rng)

    final, best_val = initial, -1
    history, per_restart = [], []
    for r in range(max_restarts + 1):
        s0 = initial if r == 0 else random_state(inst, rng)
        s, h, _ = climb(inst, rng, s0, "steepest", max_iter, n_neighbors, 0)
        history += h
        per_restart.append(h[-1])
        if h[-1] > best_val:
            final, best_val = s, h[-1]

    extras = {"restarts": max_restarts, "value_per_restart": per_restart}
    return Result(initial, final, total_value(final, inst), history, time.time() - start, extras)


def main():
    inst = load_instance(sys.argv[1])
    algorithms = (steepest_ascent, sideways_move, stochastic, random_restart)

    for algorithm in algorithms:
        result = algorithm(inst, seed=1)
        assert is_valid(result.final_state, inst)
        print(algorithm.__name__, "->", result.final_value,
              f"{result.duration:.2f}s", result.extras)

        save_state(result.final_state, f"out_state_{algorithm.__name__}.json")


if __name__ == "__main__":
    main()
