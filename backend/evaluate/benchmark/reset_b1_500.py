import os

from dotenv import load_dotenv

from b1_500_utils import B1_USER_PREFIXES, get_b1_output_paths, clean_benchmark_users, setup_paths


def _delete_output_files() -> list[str]:
    deleted = []
    for path in get_b1_output_paths():
        if os.path.exists(path):
            os.remove(path)
            deleted.append(path)
    return deleted


def main():
    setup_paths()
    load_dotenv(override=True)

    print("=" * 72)
    print("Benchmark 1: reset outputs and benchmark state")
    print("=" * 72)

    deleted_files = _delete_output_files()

    from core.engine import AgenticEmpathySystem

    system = AgenticEmpathySystem()
    try:
        neo4j_summary = clean_benchmark_users(system, prefixes=B1_USER_PREFIXES)
    finally:
        system.close()

    print(f"Deleted output files: {len(deleted_files)}")
    for path in deleted_files:
        print(f"  - {path}")

    print("Deleted Neo4j benchmark users summary:")
    print(f"  - prefixes: {', '.join(neo4j_summary['prefixes'])}")
    print(f"  - users_deleted: {neo4j_summary['users_deleted']}")
    print(f"  - nodes_deleted: {neo4j_summary['nodes_deleted']}")


if __name__ == "__main__":
    main()
