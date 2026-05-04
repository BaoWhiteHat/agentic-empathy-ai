import os
import sys

from dotenv import load_dotenv

from b1_500_utils import (
    DEFAULT_BENCHMARK_MODE,
    OUTPUT_DIR,
    PLOT_PATH,
    ROUTER_ANALYSIS_PATH,
    ROUTER_DECISIONS_PATH,
    SAFETY_ANALYSIS_PATH,
    SCORED_PATH,
    STATS_PATH,
    SUMMARY_PATH,
    SUMMARY_BY_MODE_PATH,
    finalize_outputs,
    normalize_benchmark_mode,
    setup_paths,
)


def main():
    setup_paths()
    load_dotenv(override=True)
    benchmark_mode = normalize_benchmark_mode(
        os.getenv("B1_BENCHMARK_MODE") or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BENCHMARK_MODE)
    )

    print("=" * 72)
    print("Benchmark 1: finalize existing generation")
    print("=" * 72)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Requested benchmark mode view: {benchmark_mode}")

    finalize_outputs(benchmark_mode=benchmark_mode)

    print(f"Scored responses: {SCORED_PATH}")
    print(f"Summary results: {SUMMARY_PATH}")
    print(f"Summary by mode: {SUMMARY_BY_MODE_PATH}")
    print(f"Statistical tests: {STATS_PATH}")
    print(f"Router decisions: {ROUTER_DECISIONS_PATH}")
    print(f"Router analysis: {ROUTER_ANALYSIS_PATH}")
    print(f"Safety analysis: {SAFETY_ANALYSIS_PATH}")
    print(f"Plot: {PLOT_PATH}")


if __name__ == "__main__":
    main()
