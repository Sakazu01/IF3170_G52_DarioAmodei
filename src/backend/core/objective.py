from core.constraints import get_box, overlap_1d, xy_overlap

ETA_WEIGHT = 1   # satu pasangan paket yang urutan bongkarnya terbalik mengurangi skor 1 poin


def total_value(state, inst):
    # total value semua paket yang ada di dalam truk
    total = 0
    for pid, pl in state.placements.items():
        if pl is not None:
            total += inst.by_id[pid].value
    return total


def blocks(a, b):
    # True jika paket a harus dikeluarkan dulu supaya paket b bisa keluar.
    # Pintu truk ada di sisi y = 0. Kotak = (x, y, z, w, l, h).
    in_front = (a[1] + a[4] <= b[1]
                and overlap_1d(a[0], a[3], b[0], b[3])
                and overlap_1d(a[2], a[5], b[2], b[5]))   # a di antara b dan pintu
    on_top = a[2] >= b[2] + b[5] and xy_overlap(a, b)     # a menumpuk di atas b
    return in_front or on_top


def eta_penalty(state, inst):
    # jumlah pasangan paket dalam satu truk yang eta-nya besar tapi menghalangi eta kecil
    per_truck = {}
    for pid, pl in state.placements.items():
        if pl is not None:
            pkg = inst.by_id[pid]
            per_truck.setdefault(pl.truck, []).append((pkg.eta, get_box(pkg, pl)))

    count = 0
    for items in per_truck.values():
        for eta_a, box_a in items:
            for eta_b, box_b in items:
                if eta_a > eta_b and blocks(box_a, box_b):
                    count += 1
    return count


def objective(state, inst):
    # fungsi tujuan yang dimaksimalkan algoritma: value dikurangi penalti urutan bongkar (eta)
    return total_value(state, inst) - ETA_WEIGHT * eta_penalty(state, inst)
