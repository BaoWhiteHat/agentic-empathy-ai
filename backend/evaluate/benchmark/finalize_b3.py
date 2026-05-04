from dotenv import load_dotenv

from b3_utils import (
    CLASSIFICATION_PATH,
    CONFUSION_PATH,
    ERROR_ANALYSIS_PATH,
    OUTPUT_DIR,
    PREDICTIONS_PATH,
    SUMMARY_PATH,
    finalize_b3_outputs,
    setup_paths,
)


def main():
    setup_paths()
    load_dotenv(override=True)

    print("=" * 72)
    print("Benchmark 3: finalize existing predictions")
    print("=" * 72)
    print(f"Output directory: {OUTPUT_DIR}")

    finalize_b3_outputs()

    print(f"Router predictions: {PREDICTIONS_PATH}")
    print(f"Summary results: {SUMMARY_PATH}")
    print(f"Confusion matrix: {CONFUSION_PATH}")
    print(f"Classification report: {CLASSIFICATION_PATH}")
    print(f"Error analysis: {ERROR_ANALYSIS_PATH}")


if __name__ == "__main__":
    main()
