"""
Pipeline Progress Tracker
==========================

Reusable progress tracking for pipeline execution.
Provides clean, readable terminal output with step checkmarks
and a tqdm progress bar for long-running model loops.

Usage:
    with PipelineTracker("CAUSAL PIPELINE", total_steps=7) as tracker:
        with tracker.step(1, "Merging datasets") as s:
            result = merge_datasets(...)
            s.detail(f"{len(result):,} rows")

        pbar = tracker.model_loop(total=12)
        for model in models:
            pbar.set_postfix_str(f"fitting {model.name}")
            pbar.update(1)
        pbar.close()

        tracker.complete("3 channels analysed | Top: promotion")
"""
import warnings
from tqdm import tqdm


class StepContext:
    """Context manager for a single pipeline step. Prints ✅ on exit."""

    def __init__(self, step_num: int, total: int, description: str):
        self._detail_text = ""
        print(f"\n  Step {step_num}/{total}: {description}...", end="", flush=True)

    def detail(self, text: str):
        """Set detail text shown after the checkmark."""
        self._detail_text = text

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            suffix = f"  ({self._detail_text})" if self._detail_text else ""
            print(f"  ✅{suffix}")
        else:
            print(f"  ❌  ({exc_val})")
        # Don't suppress exceptions — let them propagate
        return False


class PipelineTracker:
    """
    Reusable progress tracker for pipeline execution.

    Provides:
      - Banner with pipeline name
      - Step-by-step logging with ✅/❌ checkmarks
      - Pre-configured tqdm bar for model loops
      - Completion summary banner
      - Automatic FutureWarning suppression
    """

    def __init__(self, name: str, total_steps: int):
        self.name = name
        self.total_steps = total_steps

    def __enter__(self):
        # Suppress sklearn FutureWarnings that garble terminal output
        warnings.filterwarnings("ignore", category=FutureWarning)

        print("\n" + "=" * 60)
        print(f"  {self.name}")
        print("=" * 60)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            print(f"\n  ❌ Pipeline failed: {exc_val}")
            print("=" * 60 + "\n")
        return False

    def step(self, step_num: int, description: str) -> StepContext:
        """
        Context manager for a single pipeline step.

        Usage:
            with tracker.step(1, "Merging datasets") as s:
                result = do_work()
                s.detail(f"{len(result)} rows")
        Prints: "  Step 1/7: Merging datasets...  ✅  (1,234 rows)"
        """
        return StepContext(step_num, self.total_steps, description)

    def model_loop(self, total: int, colour: str = "green") -> tqdm:
        """Create a pre-configured tqdm bar for the estimator/model loop."""
        return tqdm(
            total=total,
            desc="     Models",
            bar_format="     {l_bar}{bar:30}{r_bar}",
            colour=colour,
        )

    def complete(self, summary: str):
        """Print the completion banner."""
        print("\n" + "=" * 60)
        print(f"  ✅ {summary}")
        print("=" * 60 + "\n")
