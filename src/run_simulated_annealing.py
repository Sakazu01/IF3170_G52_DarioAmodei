import argparse

from core.io import load_instance
from run_common import run_experiment

RUNS = 3


def main():
    parser = argparse.ArgumentParser(description="Jalankan Simulated Annealing.")
    parser.add_argument("instance", help="path file instance JSON")
    parser.add_argument("--output", default="output/simulated_annealing",
                        help="folder output")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    inst = load_instance(args.instance)
    run_experiment("simulated_annealing", inst, seed=args.seed, runs=RUNS,
                   out_dir=args.output)


if __name__ == "__main__":
    main()
