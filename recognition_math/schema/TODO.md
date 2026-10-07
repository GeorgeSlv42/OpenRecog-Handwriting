# schema/ — math in the ink JSON (proposal for v1.1)

**Owner:** Dev C writes the proposal; **lead** approves and owns the change to `ink/`.

Current format: [`docs/ink-schema.md`](../../docs/ink-schema.md). v1 already keeps raw strokes for
everything, so math ink is never lost — this is about adding the *recognized* math.

## Proposal should answer

- [ ] How a math region is represented: a block with `type: "math"`? who sets it (math-mode toggle
      vs. detector)?
- [ ] Result shape: `latex`, `mathml`, alternatives, per-symbol bounding boxes / stroke ids
      (so the tutor can point at "this term")?
- [ ] How it coexists with text: a line mixing words and an inline equation
- [ ] `MathRecognizer` interface signature for `ink/recognition/`
- [ ] Versioning: additive only → v1.1 (`schema.v1.1.json`), v1 readers keep working

## Deliverable

- [ ] `proposal.md` here with an example JSON fragment built from a real `../dataset/` file
