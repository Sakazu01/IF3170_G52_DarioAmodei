import math
import os
import sys

import matplotlib
matplotlib.use("Agg")

# workaround environment
if "mpl_toolkits" in sys.modules:
    _user_root = os.path.abspath(os.path.join(
        os.path.dirname(matplotlib.__file__), os.pardir))
    _user_mpl_toolkits = os.path.join(_user_root, "mpl_toolkits")
    if os.path.isdir(_user_mpl_toolkits):
        import importlib.util
        for _name in [m for m in sys.modules
                      if m == "mpl_toolkits" or m.startswith("mpl_toolkits.")]:
            del sys.modules[_name]
        _spec = importlib.util.spec_from_file_location(
            "mpl_toolkits", os.path.join(_user_mpl_toolkits, "__init__.py"),
            submodule_search_locations=[_user_mpl_toolkits])
        if _spec is None:
            # namespace package 
            import importlib.machinery
            _spec = importlib.machinery.ModuleSpec(
                "mpl_toolkits", None, is_package=True)
            _spec.submodule_search_locations = [_user_mpl_toolkits]
        _mod = importlib.util.module_from_spec(_spec)
        sys.modules["mpl_toolkits"] = _mod

import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

from core.stats import unplaced_packages


def _box_faces(x, y, z, w, l, h):
    # 6 sisi kubus: (x,y,z) = sudut kiri-bawah-bawah
    v = [
        (x, y, z), (x + w, y, z), (x + w, y + l, z), (x, y + l, z),
        (x, y, z + h), (x + w, y, z + h), (x + w, y + l, z + h), (x, y + l, z + h),
    ]
    return [
        [v[0], v[1], v[2], v[3]],  # alas
        [v[4], v[5], v[6], v[7]],  # atas
        [v[0], v[1], v[5], v[4]],  # depan
        [v[2], v[3], v[7], v[6]],  # belakang
        [v[1], v[2], v[6], v[5]],  # kanan
        [v[3], v[0], v[4], v[7]],  # kiri
    ]


def plot_container(ax, state, inst, truck_id, value_norm):
    truck = inst.trucks[truck_id]
    d = truck.dims

    # dinding packaging (transparan)
    walls = Poly3DCollection(_box_faces(0, 0, 0, d.w, d.l, d.h),
                             alpha=0.08, linewidths=0.5, edgecolor="gray")
    ax.add_collection3d(walls)

    for pid, pl in state.placements.items():
        if pl is None or pl.truck != truck_id:
            continue
        pkg = inst.by_id[pid]
        pd = pkg.dims.oriented(pl.orient)
        color = plt.cm.viridis(value_norm(pkg.value))
        face = color[:3] + (0.55,)
        box = Poly3DCollection(_box_faces(pl.x, pl.y, pl.z, pd.w, pd.l, pd.h),
                               facecolors=face,
                               edgecolors="red" if pkg.is_fragile else color[:3] + (1.0,),
                               linewidths=1.5 if pkg.is_fragile else 0.4)
        ax.add_collection3d(box)

    ax.set_xlim(0, d.w)
    ax.set_ylim(0, d.l)
    ax.set_zlim(0, d.h)
    ax.set_box_aspect((d.w, d.l, d.h))
    ax.set_xlabel("w")
    ax.set_ylabel("l")
    ax.set_zlabel("h")

    placed_value = sum(inst.by_id[pid].value
                       for pid, pl in state.placements.items()
                       if pl is not None and pl.truck == truck_id)
    ax.set_title("truk %d (value %d)" % (truck_id, placed_value), fontsize=10)


def plot_state(state, inst, path, title=""):
    # render 3D container for each truck
    n = len(inst.trucks)
    cols = min(n, 3)
    rows = math.ceil(n / cols)
    fig = plt.figure(figsize=(4.5 * cols, 4 * rows))

    all_values = [p.value for p in inst.packages]
    vmax = max(all_values) if all_values else 1
    value_norm = lambda v: v / vmax

    for truck_id in range(n):
        ax = fig.add_subplot(rows, cols, truck_id + 1, projection="3d")
        plot_container(ax, state, inst, truck_id, value_norm)

    outside = unplaced_packages(state)
    if title:
        fig.suptitle("%s | di luar truk: %d paket (%s)" % (
            title, len(outside), ", ".join(outside[:10]) + ("..." if len(outside) > 10 else "")),
            fontsize=11)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def plot_per_truck_value(initial_stats, final_stats, path, title="Per-truck value"):
    # bar chart kontribusi value tiap truk (initial vs final)
    ids = [s["truck"] for s in final_stats]
    initial_values = [s["value"] for s in initial_stats]
    final_values = [s["value"] for s in final_stats]

    x = range(len(ids))
    width = 0.38
    fig, ax = plt.subplots(figsize=(max(5, 1.6 * len(ids)), 4))
    ax.bar([i - width / 2 for i in x], initial_values, width, label="initial", color="steelblue")
    ax.bar([i + width / 2 for i in x], final_values, width, label="final", color="orange")
    ax.set_xticks(list(x))
    ax.set_xticklabels(["truk %d" % t for t in ids])
    ax.set_ylabel("value")
    ax.set_title("%s (total final %d)" % (title, sum(final_values)))
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
