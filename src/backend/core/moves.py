from dataclasses import replace
from core.model import State, Placement, Orientation, rotate
from core.constraints import settle, is_valid, fits_somewhere

MAX_TRIES = 10
REMOVE_PROB = 0.3     # peluang mengeluarkan paket dari truk saat relocate


def finish(new_placements, inst, moved):
    new_state = State(new_placements)
    new_state = settle(new_state, inst, moved)
    if not is_valid(new_state, inst):
        return None
    return new_state


def orient_fits(pkg, truck, orient):
    d = pkg.dims.oriented(orient)
    return d.w <= truck.dims.w and d.l <= truck.dims.l and d.h <= truck.dims.h


def fitting_trucks(pkg, inst):
    # truk yang betulan bisa menampung paket (heuristik)
    return [i for i, t in enumerate(inst.trucks) if fits_somewhere(pkg.dims, t)]


def fitting_orients(pkg, truck):
    return [o for o in Orientation if orient_fits(pkg, truck, o)]


def move_relocate(state, inst, rng):
    pid = rng.choice(list(state.placements))
    old = state.placements[pid]
    pkg = inst.by_id[pid]
    new_placements = dict(state.placements)

    if old is not None and rng.random() < REMOVE_PROB:
        new_placements[pid] = None
        return finish(new_placements, inst, [pid])

    candidates = fitting_trucks(pkg, inst)
    if not candidates:
        if old is not None:
            new_placements[pid] = None
            return finish(new_placements, inst, [pid])
        return None

    truck_id = rng.choice(candidates)
    truck = inst.trucks[truck_id]

    if old is not None and orient_fits(pkg, truck, old.orient):
        orient = old.orient
    else:
        orient = rng.choice(fitting_orients(pkg, truck))

    d = pkg.dims.oriented(orient)
    x = rng.randint(0, truck.dims.w - d.w)
    y = rng.randint(0, truck.dims.l - d.l)

    if (old is not None and old.truck == truck_id
            and old.x == x and old.y == y and old.orient == orient):
        return None

    new_placements[pid] = Placement(truck_id, x, y, 0, orient)
    return finish(new_placements, inst, [pid])


def move_transfer(state, inst, rng):
    # pindahkan paket dari truk paling penuh ke truk paling kosong yang muat,
    inside = {}
    for pid, pl in state.placements.items():
        if pl is not None:
            inside.setdefault(pl.truck, []).append(pid)
    if len(inside) == 0:
        return None

    load = {t: sum(inst.by_id[pid].weight for pid in ids)
            for t, ids in inside.items()}
    max_load = max(load.values())
    source = rng.choice([t for t in load if load[t] == max_load])
    pid = rng.choice(inside[source])
    pkg = inst.by_id[pid]

    targets = [t for t in fitting_trucks(pkg, inst) if t != source]
    if not targets:
        return None

    free = {}
    for t in targets:
        used = sum(inst.by_id[p].weight for p in inside.get(t, []))
        free[t] = inst.trucks[t].max_capacity - used
    max_free = max(free.values())
    target = rng.choice([t for t in targets if free[t] == max_free])

    truck = inst.trucks[target]
    old = state.placements[pid]
    if orient_fits(pkg, truck, old.orient):
        orient = old.orient
    else:
        orient = rng.choice(fitting_orients(pkg, truck))

    d = pkg.dims.oriented(orient)
    x = rng.randint(0, truck.dims.w - d.w)
    y = rng.randint(0, truck.dims.l - d.l)

    new_placements = dict(state.placements)
    new_placements[pid] = Placement(target, x, y, 0, orient)
    return finish(new_placements, inst, [pid])


def move_swap(state, inst, rng):
    ids = list(state.placements)
    if len(ids) < 2:
        return None
    a, b = rng.sample(ids, 2)
    pa = state.placements[a]
    pb = state.placements[b]

    if pa is None and pb is None:
        return None

    new_placements = dict(state.placements)
    new_placements[a] = pb
    new_placements[b] = pa
    return finish(new_placements, inst, [a, b])


def move_rotate(state, inst, rng):
    inside = []
    for pid, pl in state.placements.items():
        if pl is not None:
            inside.append(pid)
    if len(inside) == 0:
        return None

    pid = rng.choice(inside)
    old = state.placements[pid]
    axis = rng.randint(0, 2)

    new_placements = dict(state.placements)
    new_placements[pid] = replace(old, orient=rotate(old.orient, axis))
    return finish(new_placements, inst, [])


def _pick_move(rng):
    # proporsi pemakaian tiap move (heuristik)
    r = rng.random()
    if r < 0.35:
        return move_relocate
    if r < 0.70:
        return move_swap
    if r < 0.85:
        return move_transfer
    return move_rotate


def random_neighbor(state, inst, rng, max_tries=MAX_TRIES):
    for _ in range(max_tries):
        nb = _pick_move(rng)(state, inst, rng)
        if nb is not None:
            return nb
    return None


def sample_neighbors(state, inst, rng, k, max_tries=MAX_TRIES):
    # ambil k neighbor valid
    out = []
    for _ in range(k):
        nb = random_neighbor(state, inst, rng, max_tries)
        if nb is not None:
            out.append(nb)
    return out
