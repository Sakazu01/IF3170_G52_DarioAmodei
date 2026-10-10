from core.model import State, Placement, Orientation
from core.constraints import settle, is_valid


def random_state(inst, rng, p_try=0.7, tries=5):
    # buat var random state bisa ubah2 
    state = State({})
    for p in inst.packages:
        state.placements[p.id] = None

    order = list(inst.packages)
    rng.shuffle(order)

    for pkg in order:
        if rng.random() > p_try:
            continue
        for _ in range(tries):
            truck_id = rng.randrange(len(inst.trucks))
            truck = inst.trucks[truck_id]
            orient = rng.choice(list(Orientation))
            d = pkg.dims.oriented(orient)

            max_x = truck.dims.w - d.w
            max_y = truck.dims.l - d.l
            if max_x < 0 or max_y < 0:
                continue

            x = rng.randint(0, max_x)
            y = rng.randint(0, max_y)

            new_placements = dict(state.placements)
            new_placements[pkg.id] = Placement(truck_id, x, y, 0, orient)
            candidate = settle(State(new_placements), inst, [pkg.id])
            if is_valid(candidate, inst):
                state = candidate
                break
    return state
