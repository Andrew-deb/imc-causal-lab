import logging
import sys

# Configure a mock root logger to simulate backend console
logging.basicConfig(level=logging.WARNING)

from app.utils.progress import PipelineTracker

def test_run():
    tracker = PipelineTracker(name="MOCK PIPELINE RUN", total_steps=3)
    with tracker as t:
        with t.step(1, "Loading raw metrics") as s:
            s.detail("Loaded 1,500 rows")
        
        pbar = t.model_loop(total=5)
        for i in range(5):
            pbar.set_postfix_str(f"fitting model_{i}")
            pbar.update(1)
        pbar.close()
        
        with t.step(2, "Generating outcome estimates") as s:
            s.detail("Complete")
            
        t.complete("Causal models fit successfully")

if __name__ == "__main__":
    test_run()
