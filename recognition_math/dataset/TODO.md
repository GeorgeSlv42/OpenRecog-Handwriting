# dataset/ — labeled handwritten math

**Owner:** Dev C

Real handwriting is personal data, so everything in this folder except this file is
**git-ignored**. Share the dataset privately (team drive), with each writer's consent.

Capture with the harness (`cd harness && npm run dev`), schema v1 export. Put the LaTeX ground
truth in the harness's "What did you write?" box → it lands in `groundTruth.label`.

## Work

- [ ] Agree a label convention with the lead (plain LaTeX, e.g. `\frac{a}{b}`, no `$`), write it here
- [ ] File naming: `<category>-<nnn>.v1.json`, one equation per file
- [ ] Cover the 2D structures from the README, ~10 each to start:
  - [ ] fractions (incl. nested)
  - [ ] superscripts / subscripts
  - [ ] square roots
  - [ ] sums / integrals with limits
  - [ ] matrices
  - [ ] ambiguous strokes: minus vs. fraction bar, `x` vs. `×`, `1` vs. `l`
- [ ] At least 2–3 different writers, stylus where possible
- [ ] Every file must pass `validateDocument()` from `ink/` (add a check script or reuse
      `ink/tests/samples.test.ts` pattern)

## Not here

- Public datasets (e.g. CROHME) can supplement but go in the git-ignored top-level `datasets/`
  folder — check their licenses first.
