# evaluation/ — scoring math recognition

**Owner:** Dev C. Python (repo root `pyproject.toml`, run with `uv run`).

## Work

- [ ] Loader: read `dataset/*.v1.json` (schema v1, see `docs/ink-schema.md`)
- [ ] Engine adapter boundary: the script takes engine output (LaTeX per file) from a results file,
      so engines that only run on device/vendor tools can still be scored
- [ ] Metrics:
  - [ ] Exact match rate after LaTeX normalization (whitespace, `{}` around single tokens)
  - [ ] Edit distance on LaTeX tokens
  - [ ] Per-category breakdown (fractions, roots, …) — this is what shows *where* an engine fails
- [ ] Report: one markdown table per engine run, committed under `evaluation/results/`

## Rules

- Ask the lead before adding Python dependencies (`pyproject.toml` currently has none).

## Done when

- [ ] One command produces a per-category accuracy table for an engine's results file
