import asyncio

from dotenv import load_dotenv

from b2_200_utils import (
    GENERATED_PATH,
    OUTPUT_DIR,
    TEST_CASES_PATH,
    clean_benchmark_users,
    finalize_outputs,
    generate_responses,
    load_or_create_case_set,
    require_memory_for_b2,
    setup_paths,
)


async def main():
    setup_paths()
    load_dotenv(override=True)

    print("=" * 72)
    print("Benchmark 2: LongMemEval generation (200 cases)")
    print("=" * 72)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Case file: {TEST_CASES_PATH}")
    print(f"Generated responses: {GENERATED_PATH}")

    from core.engine import AgenticEmpathySystem

    system = AgenticEmpathySystem()
    try:
        require_memory_for_b2(system)
        clean_benchmark_users(system)
        cases_df = load_or_create_case_set()
        print(f"Loaded benchmark case set with {len(cases_df)} sampled LongMemEval cases.")

        generated_df = await generate_responses(system, cases_df)
        print(f"Saved {len(generated_df)} generated rows.")

        finalize_outputs()
        print("Benchmark 2 finalize step completed.")
    finally:
        clean_benchmark_users(system)
        system.close()


if __name__ == "__main__":
    asyncio.run(main())
