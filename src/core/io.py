import json
from core.model import (Dimensions, Package, Truck, Instance,
                        Placement, State, Orientation)
from core.constraints import fits_somewhere

def validate_instance(inst):
    errors = []

    if len(inst.trucks) == 0:
        errors.append("minimal harus ada satu truk")

    for i, t in enumerate(inst.trucks):
        if t.dims.w <= 0 or t.dims.l <= 0 or t.dims.h <= 0 or t.maxCapacity <= 0:
            errors.append("truk " + str(i) + ": dimensi dan kapasitas harus positif")

    ids = set()
    for p in inst.packages:
        if p.id in ids:
            errors.append(p.id + ": id kembar")
        ids.add(p.id)
        if p.dims.w <= 0 or p.dims.l <= 0 or p.dims.h <= 0:
            errors.append(p.id + ": dimensi harus positif")
        if p.value < 0 or p.weight < 0 or p.eta < 0:
            errors.append(p.id + ": value, weight, eta tidak boleh negatif")

        # paket harus dimuate ke salah satu truck dan hrus ad orientasiunya
        if len(inst.trucks) > 0:
            muat = False
            for t in inst.trucks:
                if fits_somewhere(p.dims, t):
                    muat = True
            if not muat:
                errors.append(p.id + ": tidak muat di truk mana pun pada orientasi apa pun")
    return errors

def load_instance(path):
    with open(path) as f:
        data = json.load(f)

    trucks = []
    for t in data["trucks"]:
        d = t["dimensions"]
        trucks.append(Truck(Dimensions(d["w"], d["l"], d["h"]), t["max_capacity"]))

    packages = []
    for p in data["packages"]:
        d = p["dimensions"]
        packages.append(Package(p["id"], Dimensions(d["w"], d["l"], d["h"]),
                                p["value"], p["weight"], p["fragile"], p["eta"]))

    inst = Instance(packages, trucks)
    errors = validate_instance(inst)
    if len(errors) > 0:
        raise ValueError("instance tidak valid:\n" + "\n".join(errors))
    return inst


def save_instance(inst, path):
    data = {"trucks": [], "packages": []}
    for t in inst.trucks:
        data["trucks"].append({
            "dimensions": {"w": t.dims.w, "l": t.dims.l, "h": t.dims.h},
            "max_capacity": t.maxCapacity})
    for p in inst.packages:
        data["packages"].append({
            "id": p.id,
            "dimensions": {"w": p.dims.w, "l": p.dims.l, "h": p.dims.h},
            "value": p.value, "weight": p.weight,
            "fragile": p.isFragile, "eta": p.eta})
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def state_to_dict(state):
    data = {}
    for pid, pl in state.placements.items():
        if pl is None:
            data[pid] = None
        else:
            data[pid] = {"truck": pl.truck, "x": pl.x, "y": pl.y, "z": pl.z,
                         "orient": pl.orient.value}   
    return data

def state_from_dict(data):
    placements = {}
    for pid, pl in data.items():
        if pl is None:
            placements[pid] = None
        else:
            placements[pid] = Placement(pl["truck"], pl["x"], pl["y"], pl["z"],
                                        Orientation(pl["orient"]))
    return State(placements)

def save_state(state, path):
    with open(path, "w") as f:
        json.dump(state_to_dict(state), f, indent=2)

def load_state(path):
    with open(path) as f:
        return state_from_dict(json.load(f))
