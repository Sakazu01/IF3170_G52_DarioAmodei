def total_value(state, inst):
    # total value semua paket yang ada di dalam truk
    total = 0
    for pid, pl in state.placements.items():
        if pl is not None:
            total += inst.by_id[pid].value
    return total
