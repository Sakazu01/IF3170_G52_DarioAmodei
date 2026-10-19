import argparse
import json

from core.io import load_instance
from run_common import ALGORITHMS, ALIASES, resolve_algorithm, run_experiment


def parse_params(pairs):
    params = {}
    for pair in pairs or []:
        key, sep, value = pair.partition("=")
        if not sep:
            raise ValueError("--set harus berformat KEY=VALUE, dapat: %s" % pair)
        try:
            params[key] = json.loads(value)
        except json.JSONDecodeError:
            params[key] = value
    return params


def main():
    parser = argparse.ArgumentParser(
        description="Jalankan local search (pilih algoritma) pada instance "
                    "satu truk atau multi-truk.")
    parser.add_argument("instance", help="path file instance JSON")
    parser.add_argument("-a", "--algorithm", required=True,
                        help="algoritma: %s (atau alias: %s)" % (
                            ", ".join(sorted(ALGORITHMS)),
                            ", ".join(sorted(ALIASES))))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--runs", type=int, default=3,
                        help="jumlah run (seed berurutan)")
    parser.add_argument("--output", default=None,
                        help="folder output (default: output/<algoritma>)")
    parser.add_argument("--set", dest="params", action="append",
                        metavar="KEY=VALUE",
                        help="override parameter algoritma, bisa berulang "
                             "(mis. --set initial_temp=80 --set cooling_rate=0.9)")
    args = parser.parse_args()

    algorithm = resolve_algorithm(args.algorithm)
    inst = load_instance(args.instance)
    out_dir = args.output or ("output/" + algorithm)
    run_experiment(algorithm, inst, params=parse_params(args.params),
                   seed=args.seed, runs=args.runs, out_dir=out_dir)


if __name__ == "__main__":
    main()
