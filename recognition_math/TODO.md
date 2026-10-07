# Math track — work plan

**Owner:** Dev C. Read [`README.md`](README.md) first (why math ≠ text).

ML Kit does not handle math notation, so this track is **evaluate first, integrate later**. Nothing
here blocks the text pipeline (`mobile/`), and nothing in `mobile/` should wait on this.

```
dataset/      labeled handwritten math samples (from the harness)
evaluation/   scoring scripts: how good is engine X on our data
myscript/     MyScript evaluation notes + results
schema/       proposal: how math lands in the ink JSON (v1.1)
```

## Order

1. [ ] `dataset/` — collect ~50 real equations first; everything else is measured against them
2. [ ] `evaluation/` — scoring script (shared idea with `recognition_text/evaluation/`)
3. [ ] `myscript/` — license check, then run the dataset through it
4. [ ] `schema/` — proposal for the lead, based on what MyScript actually returns
5. [ ] Recommendation write-up: engine choice, accuracy, cost, platform support → lead decides
       whether math becomes Phase 2

## Decisions this track must bring to the lead

- [ ] Engine (MyScript vs. alternatives vs. building a layout parser) with numbers
- [ ] License cost for our usage
- [ ] How math regions are identified: student-toggled "math mode" (simple) vs. auto-detect (hard)
- [ ] Interface: a separate `MathRecognizer` in `ink/recognition/` (proposed — output is LaTeX/MathML,
      not ranked strings, so `InkRecognizer` doesn't fit)
