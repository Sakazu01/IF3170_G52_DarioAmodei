import random
import time

from core.constraints import in_bounds, is_valid, xy_overlap
from core.generator import random_state
from core.model import Orientation, Placement, Result, State
from core.moves import random_neighbor
from core.objective import objective

MUTATION_PROB = 0.2
REFILL_TRIES = 10


def fitness(state, inst):
    return max(0, objective(state, inst))   # roulette butuh fitness tidak negatif

def random_selection(population, cumulative, rng):
    total = cumulative[-1]
    if total <= 0:
        return rng.choice(population)
    r = rng.uniform(0, total)
    lo, hi = 0, len(cumulative)
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid] < r:
            lo = mid + 1
        else:
            hi = mid
    idx = lo
    return population[min(idx, len(population) - 1)]


def try_place(done, weight, pkg, truck, x, y, orient, inst):
    d = pkg.dims.oriented(orient)
    if x < 0 or y < 0 or x + d.w > truck.dims.w or y + d.l > truck.dims.l:
        return None
    if weight + pkg.weight > truck.max_capacity:
        return None
    footprint = (x, y, 0, d.w, d.l, d.h)
    z = 0
    for _, b in done:
        if xy_overlap(footprint, b):
            z = max(z, b[2] + b[5])
    box = (x, y, z, d.w, d.l, d.h)
    if not in_bounds(box, truck):
        return None
    if z > 0:
        for other, b in done:
            if inst.by_id[other].is_fragile and b[2] + b[5] == z and xy_overlap(box, b):
                return None
    return box


def repair(state, inst, rng=None, refill_tries=0, refill_order=()):
    new_placements = {pid: None for pid in state.placements}
    per_truck = {}
    for pid, pl in state.placements.items():
        if pl is not None and 0 <= pl.truck < len(inst.trucks):
            per_truck.setdefault(pl.truck, []).append(pid)

    done = {t: [] for t in range(len(inst.trucks))}
    weight = {t: 0 for t in range(len(inst.trucks))}

    for truck_id, ids in per_truck.items():
        truck = inst.trucks[truck_id]
        ids.sort(key=lambda p: (state.placements[p].z, -inst.by_id[p].value, p))
        for pid in ids:
            pkg = inst.by_id[pid]
            pl = state.placements[pid]
            box = try_place(done[truck_id], weight[truck_id], pkg, truck, pl.x, pl.y, pl.orient, inst)
            if box is None:
                continue
            new_placements[pid] = Placement(truck_id, box[0], box[1], box[2], pl.orient)
            done[truck_id].append((pid, box))
            weight[truck_id] += pkg.weight

    if rng is not None and refill_tries > 0:
        orients = list(Orientation)
        for pid in refill_order:
            if new_placements[pid] is not None:
                continue
            pkg = inst.by_id[pid]
            for _ in range(refill_tries):
                truck_id = rng.randrange(len(inst.trucks))
                truck = inst.trucks[truck_id]
                orient = rng.choice(orients)
                d = pkg.dims.oriented(orient)
                if d.w > truck.dims.w or d.l > truck.dims.l:
                    continue
                x = rng.randint(0, truck.dims.w - d.w)
                y = rng.randint(0, truck.dims.l - d.l)
                box = try_place(done[truck_id], weight[truck_id], pkg, truck, x, y, orient, inst)
                if box is not None:
                    new_placements[pid] = Placement(truck_id, box[0], box[1], box[2], orient)
                    done[truck_id].append((pid, box))
                    weight[truck_id] += pkg.weight
                    break
    return State(new_placements)


def reproduce(x, y, inst, rng, refill_tries=0, refill_order=()):
    ids = [p.id for p in inst.packages]
    cut = rng.randint(1, max(1, len(ids) - 1))   # 1 paket: seluruhnya dari x
    placements = {}
    for i, pid in enumerate(ids):
        parent = x if i < cut else y
        placements[pid] = parent.placements[pid]
    return repair(State(placements), inst, rng, refill_tries, refill_order)


def mutate(state, inst, rng):
    neighbour = random_neighbor(state, inst, rng)
    return neighbour if neighbour is not None else state


def refill_order_of(inst):
    t = inst.trucks[0]
    vol = t.dims.w * t.dims.l * t.dims.h

    def score(p):
        return p.value / (p.weight / t.max_capacity + p.dims.w * p.dims.l * p.dims.h / vol + 1e-9)

    return [p.id for p in sorted(inst.packages, key=score, reverse=True)]


# sama kayak yang di PPT random crossover, crossover, lalu mutation
# tapi gene-nya itu penempatan satu paket dengan constraints-nya
def genetic_algorithm(inst, population_size, iterations, seed=None,
                      mutation_prob=MUTATION_PROB, refill_tries=REFILL_TRIES):
    rng = random.Random(seed)
    order = refill_order_of(inst)
    start = time.perf_counter()

    population = [random_state(inst, rng) for _ in range(population_size)]
    fits = [fitness(s, inst) for s in population]

    best_idx = max(range(population_size), key=lambda i: fits[i])
    initial_state = population[best_idx]

    history_max = [max(fits)]
    history_avg = [sum(fits) / len(fits)]

    for _ in range(iterations):
        cumulative = []
        current_sum = 0
        for f in fits:
            current_sum += f
            cumulative.append(current_sum)

        new_population = []
        for _ in range(population_size):
            x = random_selection(population, cumulative, rng)
            y = random_selection(population, cumulative, rng)
            child = reproduce(x, y, inst, rng, refill_tries, order)
            if rng.random() < mutation_prob:
                child = mutate(child, inst, rng)
            new_population.append(child)
        population = new_population
        fits = [fitness(s, inst) for s in population]
        history_max.append(max(fits))
        history_avg.append(sum(fits) / len(fits))

    best_idx = max(range(population_size), key=lambda i: fits[i])
    final_state = population[best_idx]
    assert is_valid(final_state, inst)

    return Result(
        initial_state=initial_state,
        final_state=final_state,
        final_value=fits[best_idx],
        history=history_max,
        duration=time.perf_counter() - start,
        extras={
            "population_size": population_size,
            "iterations": iterations,
            "mutation_prob": mutation_prob,
            "history_avg": history_avg,
        },
    )
