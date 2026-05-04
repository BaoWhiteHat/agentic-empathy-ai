from dotenv import load_dotenv

from b2_200_utils import (
    OUTPUT_DIR,
    PLOT_PATH,
    SCORED_PATH,
    STATS_PATH,
    SUMMARY_PATH,
    finalize_outputs,
    setup_paths,
)


def main():
    setup_paths()
    load_dotenv(override=True)

    print("=" * 72)
    print("Benchmark 2: finalize existing generation")
    print("=" * 72)
    print(f"Output directory: {OUTPUT_DIR}")

    finalize_outputs()

    print(f"Scored responses: {SCORED_PATH}")
    print(f"Summary results: {SUMMARY_PATH}")
    print(f"Statistical tests: {STATS_PATH}")
    print(f"Plot: {PLOT_PATH}")


if __name__ == "__main__":
    main()
