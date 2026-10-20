import argparse
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.io import load_instance, save_instance
from core.model import Dimensions, Instance, Package, Truck


def random_instance(n_trucks, n_packages, rng, hetero=False):
    trucks = []
    for _ in range(n_trucks):
        if hetero:
            trucks.append(Truck(
                Dimensions(rng.randint(8, 12), rng.randint(12, 20), rng.randint(4, 8)),
                rng.randint(200, 600)))
        else:
            trucks.append(Truck(Dimensions(10, 20, 5), 500))

    # paket dibuat muat di trku terkecil supaya validate_instance lolos
    smallest = trucks[0].dims
    for t in trucks[1:]:
        smallest = Dimensions(min(smallest.w, t.dims.w),
                              min(smallest.l, t.dims.l),
                              min(smallest.h, t.dims.h))

    packages = []
    for i in range(n_packages):
        packages.append(Package(
            "P%02d" % (i + 1),
            Dimensions(rng.randint(1, min(5, smallest.w)),
                       rng.randint(1, min(6, smallest.l)),
                       rng.randint(1, min(3, smallest.h))),
            rng.randint(10, 100),
            rng.randint(1, 30),
            rng.random() < 0.2,
            rng.randint(1, 7)))

    return Instance(packages, trucks)


def main():
    parser = argparse.ArgumentParser(description="Generate random instance (seedable).")
    parser.add_argument("--trucks", type=int, default=1, help="jumlah truk")
    parser.add_argument("--packages", type=int, default=20, help="jumlah paket")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--hetero", action="store_true",
                        help="truk berbeda dimensi/kapasitas")
    parser.add_argument("--output", required=True, help="path file JSON output")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    inst = random_instance(args.trucks, args.packages, rng, hetero=args.hetero)

    save_instance(inst, args.output)
    load_instance(args.output)  # validasi roundtrip

    total_value = sum(p.value for p in inst.packages)
    total_weight = sum(p.weight for p in inst.packages)
    capacity = sum(t.max_capacity for t in inst.trucks)
    print("instance %s: %d truk, %d paket, total value=%d, total berat=%d/%d" % (
        args.output, len(inst.trucks), len(inst.packages),
        total_value, total_weight, capacity))


if __name__ == "__main__":
    main()
