from dataclasses import replace
from core.model import State, Placement, Orientation, rotate
from core.constraints import settle, is_valid
MAX_TRIES = 10

def finish(new_placements, inst, moved):
    new_state = State(new_placements)
    new_state = settle(new_state, inst, moved)
    if not is_valid(new_state, inst):
        return None
    return new_state

def move_relocate(state, inst, rng):
    pid = rng.choice(list(state.placements))
    old = state.placements[pid]
    pkg = inst.by_id[pid]
    new_placements = dict(state.placements)

    if old is not None and rng.random() < 0.3:
        new_placements[pid] = None
        return finish(new_placements, inst, [pid])

    if old is None:
        orient = rng.choice(list(Orientation))
    else:
        orient = old.orient

    truck_id = rng.randrange(len(inst.trucks))
    truck = inst.trucks[truck_id]
    d = pkg.dims.oriented(orient)

    max_x = truck.dims.w - d.w
    max_y = truck.dims.l - d.l
    if max_x < 0 or max_y < 0:
        return None

    x = rng.randint(0, max_x)
    y = rng.randint(0, max_y)

    if old is not None and old.truck == truck_id and old.x == x and old.y == y:
        return None

    new_placements[pid] = Placement(truck_id, x, y, 0, orient)   
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

def random_neighbor(state, inst, rng, max_tries=MAX_TRIES):
    for _ in range(max_tries):
        r = rng.random()
        if r < 0.4:
            nb = move_relocate(state, inst, rng)
        elif r < 0.8:
            nb = move_swap(state, inst, rng)
        else:
            nb = move_rotate(state, inst, rng)
        if nb is not None:
            return nb
    return None
