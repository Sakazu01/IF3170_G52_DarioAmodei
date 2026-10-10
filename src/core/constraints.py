from dataclasses import replace
from core.model import State, Orientation

# Kotak paket = tuple (x, y, z, ukuran_x, ukuran_y, ukuran_z)
def get_box(pkg, placement):
    d = pkg.dims.oriented(placement.orient)
    return (placement.x, placement.y, placement.z, d.w, d.l, d.h)

def overlap_1d(start_a, len_a, start_b, len_b):
    return start_a < start_b + len_b and start_b < start_a + len_a

def xy_overlap(a, b):
    return overlap_1d(a[0], a[3], b[0], b[3]) and overlap_1d(a[1], a[4], b[1], b[4])

def boxes_overlap(a, b):
    return xy_overlap(a, b) and overlap_1d(a[2], a[5], b[2], b[5])

def in_bounds(box, truck):
    x, y, z, w, l, h = box
    if x < 0 or y < 0 or z < 0:
        return False
    if x + w > truck.dims.w or y + l > truck.dims.l or z + h > truck.dims.h:
        return False
    return True

def fits_somewhere(dims, truck):
    # apakah paket muat di truk kosong pada setidaknya satu orientasi
    for o in Orientation:
        d = dims.oriented(o)
        if d.w <= truck.dims.w and d.l <= truck.dims.l and d.h <= truck.dims.h:
            return True
    return False

def settle(state, inst, moved=()):
    moved = set(moved)
    new_placements = dict(state.placements)

    per_truck = {}
    for pid, pl in state.placements.items():
        if pl is None:
            continue
        if pl.truck not in per_truck:
            per_truck[pl.truck] = []
        per_truck[pl.truck].append(pid)

    for truck_id, ids in per_truck.items():
        others = []
        for pid in ids:
            if pid not in moved:
                others.append((state.placements[pid].z, pid))
        others.sort()

        order = []
        for z, pid in others:
            order.append(pid)
        for pid in ids:
            if pid in moved:
                order.append(pid)

        done = []   
        for pid in order:
            pl = state.placements[pid]
            d = inst.by_id[pid].dims.oriented(pl.orient)
            footprint = (pl.x, pl.y, 0, d.w, d.l, d.h)

            new_z = 0
            for box in done:
                if xy_overlap(footprint, box):
                    roof = box[2] + box[5]
                    if roof > new_z:
                        new_z = roof

            new_pl = replace(pl, z=new_z)
            new_placements[pid] = new_pl
            done.append(get_box(inst.by_id[pid], new_pl))

    return State(new_placements)

def violations(state, inst):
    # Daftar semua pelanggaran. Kosong = state valid.
    result = []

    per_truck = {}
    for pid, pl in state.placements.items():
        if pl is None:
            continue
        if pl.truck < 0 or pl.truck >= len(inst.trucks):
            result.append(pid + ": index truk tidak ada")
            continue
        box = get_box(inst.by_id[pid], pl)
        if pl.truck not in per_truck:
            per_truck[pl.truck] = []
        per_truck[pl.truck].append((pid, box))

    for truck_id, items in per_truck.items():
        truck = inst.trucks[truck_id]

        # 1. seluruh paket harus di dalam dinding truk
        for pid, box in items:
            if not in_bounds(box, truck):
                result.append(pid + ": keluar batas truk")

        # 2. tidak boleh overlap
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if boxes_overlap(items[i][1], items[j][1]):
                    result.append(items[i][0] + " & " + items[j][0] + ": overlap")

        # 3 dan 4. tidak melayang, dan fragile tidak boleh jadi support
        for pid, box in items:
            if box[2] == 0:
                continue    # di lantai, pasti punya support
            supporters = []
            for other_id, other_box in items:
                if other_id == pid:
                    continue
                roof = other_box[2] + other_box[5]
                if roof == box[2] and xy_overlap(box, other_box):
                    supporters.append(other_id)
            if len(supporters) == 0:
                result.append(pid + ": melayang")
            for s in supporters:
                if inst.by_id[s].isFragile:
                    result.append(s + ": fragile jadi support " + pid)

        # 5. total berat tidak boleh melebihi kapasitas
        total = 0
        for pid, box in items:
            total += inst.by_id[pid].weight
        if total > truck.maxCapacity:
            result.append("truk " + str(truck_id) + ": melebihi kapasitas")
    return result

def is_valid(state, inst):
    return len(violations(state, inst)) == 0
