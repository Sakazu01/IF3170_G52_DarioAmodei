def per_truck_stats(state, inst):
    # state per truk: value, berat/kapasitas, jumlah paket, utilisasi volume
    stats = []
    for truck_id, truck in enumerate(inst.trucks):
        value = 0
        weight = 0
        volume = 0
        package_ids = []
        for pid, pl in state.placements.items():
            if pl is None or pl.truck != truck_id:
                continue
            pkg = inst.by_id[pid]
            d = pkg.dims.oriented(pl.orient)
            value += pkg.value
            weight += pkg.weight
            volume += d.w * d.l * d.h
            package_ids.append(pid)

        truck_volume = truck.dims.w * truck.dims.l * truck.dims.h
        stats.append({
            "truck": truck_id,
            "value": value,
            "weight_used": weight,
            "max_capacity": truck.max_capacity,
            "capacity_utilization": (weight / truck.max_capacity if truck.max_capacity > 0 else 0.0),
            "package_count": len(package_ids),
            "volume_used": volume,
            "truck_volume": truck_volume,
            "volume_utilization": (volume / truck_volume if truck_volume > 0 else 0.0),
            "package_ids": sorted(package_ids),
        })
    return stats


def unplaced_packages(state):
    return sorted(pid for pid, pl in state.placements.items() if pl is None)
