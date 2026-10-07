# dataset/ — labeled handwritten prose

**Owner:** Dev C

Real handwriting is personal data, so everything in this folder except this file is
**git-ignored**. Share the dataset privately (team drive), with each writer's consent.

Capture with the harness (`cd harness && npm run dev`), schema v1 export, exact text typed into
"What did you write?" → `groundTruth.label`.

- [ ] File naming: `<category>-<nnn>.v1.json` (e.g. `line-001`, `paragraph-001`, `strike-001`)
- [ ] Categories: single lines, multi-line paragraphs, two-column notes, strike-through / scribble
      corrections (label = the *kept* text; note the deleted words in the label after `|deleted:`)
- [ ] Several writers; stylus and finger
- [ ] Every file passes `validateDocument()` from `ink/`
