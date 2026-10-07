# evaluation/ — measuring text recognition accuracy

**Owner:** Dev C. Python (repo root `pyproject.toml`, run with `uv run`).

Gives Dev A/B an objective answer to "does ML Kit work on our students' handwriting", and is how
pipeline settings (`lineWritingArea`, pre-context length, layout thresholds) get tuned.

## Dataset

- [ ] Capture prose samples with the harness (schema v1), ground truth in `groundTruth.label`
- [ ] Store under `recognition_text/dataset/` (git-ignored; see its TODO) — single lines,
      multi-line paragraphs, strike-throughs
- [ ] Committed results must contain only aggregate numbers, not writers' text or strokes
- [ ] Several writers; stylus and finger

## Script

- [ ] Input: device exports (`recognition.status: "recognized"`) whose strokes came from the dataset
- [ ] Join each line's `best` in `structure` order; exclude text deleted by gestures
- [ ] Metrics: character error rate (CER), word error rate (WER), top-N hit rate from `candidates`
- [ ] Gesture check: did strike-throughs get detected, and was the right text marked deleted?
- [ ] Report table per engine/config under `evaluation/results/`

## Rules

- Ask the lead before adding Python dependencies.

## Done when

- [ ] Baseline CER/WER for ML Kit `en-US` on our dataset, committed
