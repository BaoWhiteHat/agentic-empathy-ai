import asyncio
import os
import sys

from dotenv import load_dotenv

from b1_500_utils import (
    DEFAULT_BENCHMARK_MODE,
    GENERATED_PATH,
    OUTPUT_DIR,
    clean_benchmark_users,
    generate_responses,
    get_b1_sample_size,
    get_b1_seekers_path,
    load_or_create_seeker_set,
    normalize_benchmark_mode,
    setup_paths,
    finalize_outputs,
)


async def main():
    setup_paths()
    load_dotenv(override=True)
    benchmark_mode = normalize_benchmark_mode(
        os.getenv("B1_BENCHMARK_MODE") or (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BENCHMARK_MODE)
    )

    print("=" * 72)
    print("Benchmark 1: generation")
    print("=" * 72)
    seekers_path = get_b1_seekers_path()
    sample_size = get_b1_sample_size()
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Benchmark mode: {benchmark_mode}")
    print(f"Seekers file: {seekers_path}")
    print(f"Requested sample size: {sample_size}")
    print(f"Generated responses: {GENERATED_PATH}")

    from core.engine import AgenticEmpathySystem

    system = AgenticEmpathySystem()
    try:
        cleanup_prefixes = [f"bench_b1_{benchmark_mode}_"]
        if benchmark_mode == "overload":
            cleanup_prefixes.append("bench_b1_rag")
        clean_benchmark_users(system, prefixes=cleanup_prefixes)
        seekers_df = load_or_create_seeker_set(sample_size=sample_size, seekers_path=seekers_path)
        print(f"Loaded benchmark seeker set with {len(seekers_df)} unique posts.")

        generated_df = await generate_responses(system, seekers_df, benchmark_mode=benchmark_mode)
        print(f"Saved {len(generated_df)} generated rows.")

        finalize_outputs(benchmark_mode=benchmark_mode)
        print("Benchmark 1 finalize step completed.")
    finally:
        system.close()


if __name__ == "__main__":
    asyncio.run(main())
