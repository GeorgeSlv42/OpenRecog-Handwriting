# Math track — work plan

**Owner:** Dev C. Read [`README.md`](README.md) first (why math ≠ text).

ML Kit and Windows Ink do not handle math notation, so this track is **evaluate first, integrate
later**. Nothing here blocks the text pipeline (`mobile/`, `desktop/`), and nothing there should wait
on this.

## Layout

```
dataset/      labeled handwritten math samples (from the harness), git-ignored
evaluation/   Python scoring scripts: how good is engine X on our data
  results/    committed per-engine result tables (aggregate numbers only)
myscript/     MyScript evaluation notes + results
schema/       proposal: how math lands in the ink JSON (v1.1)
```

Each folder has a `TODO.md` with the work and a "done when". Delete a `TODO.md` once it's done.

## Order of work

1. [ ] **Lead:** agree the LaTeX label convention ([`dataset/TODO.md`](dataset/TODO.md)) and answer the
       **ask** dependencies below that block steps 2–3
2. [ ] `dataset/` — collect ~50 real equations first; everything else is measured against them
3. [ ] `evaluation/` — scoring script. Share the loader and report format with
       [`recognition_text/evaluation/`](../recognition_text/evaluation/TODO.md); agree with the lead where
       shared Python code lives instead of writing it twice
4. [ ] `myscript/` — license check (report to lead before signing up for anything paid), then run the
       dataset through it
5. [ ] `schema/` — proposal for the lead, based on what MyScript actually returns
6. [ ] Recommendation write-up (`recommendation.md` here): engine choice, accuracy, cost, platform
       support → lead decides whether math becomes Phase 2

## Scaffolding (once)

- [ ] Python code goes in `evaluation/` as a package run from the repo root with `uv run`
      (e.g. `uv run python -m recognition_math.evaluation …` — pick the layout with the lead so
      `recognition_text/` uses the same one)
- [ ] Python version is pinned by the repo (`.python-version`, `pyproject.toml`); don't override it
- [ ] Dataset validation reuses `validateDocument()` from `ink/` (Node), not a Python re-implementation
      of the schema

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/), then `uv sync` at the repo root
- Node 24+ and `npm install` in `harness/` — to capture samples and to run `ink/` validation
- A stylus device for capture (pen tablet, Surface pen, iPad in the browser); mouse-drawn math is not
  representative
- MyScript developer account + evaluation certificate, **only after** lead approval. The certificate
  is a secret: `.gitignore` already excludes `**/MyCertificate.*`; never commit or paste it

## Dependencies that need lead approval before adding

- Any Python package (`pyproject.toml` has none today) — e.g. a LaTeX tokenizer for normalization,
  `pytest` for tests — **ask**
- MyScript SDK / cloud API and its license — **ask**, with the cost numbers from `myscript/`
- Public datasets (e.g. CROHME) — **ask**, after checking their license; stored in the git-ignored
  top-level `datasets/`, never committed

## Testing

- [ ] Unit tests for LaTeX normalization and the metrics (hand-written expected values for a few
      equations, including the ambiguous cases in `dataset/TODO.md`)
- [ ] Sanity run: score the ground truth against itself → 100% exact match in every category
- [ ] Every dataset file passes `validateDocument()` before it's used

## Decisions this track must bring to the lead

- [ ] Engine (MyScript vs. alternatives vs. building a layout parser) with numbers
- [ ] License cost for our usage
- [ ] Platforms: does the chosen engine run on Android, iOS **and Windows** (to match `mobile/` and
      `desktop/`), on-device or cloud only?
- [ ] How math regions are identified: student-toggled "math mode" (simple) vs. auto-detect (hard)
- [ ] Interface: a separate `MathRecognizer` in `ink/recognition/` (proposed — output is LaTeX/MathML,
      not ranked strings, so `InkRecognizer` doesn't fit)
- [ ] Where Phase 2 integration code would live per platform (e.g. a second native module next to
      `mlkit-ink`, a Tauri command in `desktop/`, or a cloud call) — just the proposal, no code

## Done when (Phase 1)

- [ ] ~50 labeled equations across all categories, from at least 2–3 writers, all valid schema v1
- [ ] One command produces a per-category accuracy table for an engine's results file
- [ ] MyScript (or the chosen alternative) scored on the dataset, results committed under
      `evaluation/results/` (aggregate numbers only — no writers' strokes or text)
- [ ] `schema/proposal.md` reviewed by the lead
- [ ] `recommendation.md` delivered and the lead has decided on Phase 2
