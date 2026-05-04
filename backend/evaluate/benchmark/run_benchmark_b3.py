from dotenv import load_dotenv

from b3_utils import (
    LOADED_CASES_PATH,
    OUTPUT_DIR,
    PREDICTIONS_PATH,
    clean_b3_users,
    finalize_b3_outputs,
    load_b3_cases,
    require_memory_for_b3,
    run_router_predictions,
    setup_paths,
)


def main():
    setup_paths()
    load_dotenv(override=True)

    print("=" * 72)
    print("Benchmark 3: routing benchmark")
    print("=" * 72)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Loaded cases: {LOADED_CASES_PATH}")
    print(f"Router predictions: {PREDICTIONS_PATH}")

    from core.engine import AgenticEmpathySystem

    system = AgenticEmpathySystem()
    try:
        require_memory_for_b3(system)
        clean_b3_users(system)
        cases_df = load_b3_cases()
        print(f"Loaded {len(cases_df)} Benchmark 3 cases.")

        predictions_df = run_router_predictions(system, cases_df)
        print(f"Saved {len(predictions_df)} router predictions.")

        finalize_b3_outputs()
        print("Benchmark 3 finalize step completed.")
    finally:
        clean_b3_users(system)
        if getattr(system, "memory", None):
            system.memory.close()


if __name__ == "__main__":
    main()
