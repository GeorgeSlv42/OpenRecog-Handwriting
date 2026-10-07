# Generation — stretch idea, not expected to finish

## What this is

The reverse direction: given text (or math), generate pen strokes that look like natural
handwriting — e.g. mimicking a specific professor's handwriting style on a whiteboard.

**This is explicitly a "chew on it" idea, not a real deliverable.** Nobody should feel behind
for not finishing this.

## Why it's not just a novelty

Real labeled handwriting data (stroke recordings) is scarce and expensive to collect. Synthetic
stroke generation is an established way to manufacture more of it — meaning if this goes
anywhere, it can produce training data for `recognition_text/` and `recognition_math/`, not just
a party trick. That's the realistic near-term win, not "convincingly forge one person's
handwriting."

## Where to start, if anyone picks this up

- The foundational approach: Alex Graves' 2013 handwriting-synthesis RNN ("Generating Sequences
  With Recurrent Neural Networks") — generates realistic cursive as stroke sequences (x, y,
  pen-up/down), conditioned on text. Same representation as the recognition side, just the
  reverse direction. Style mimicry = conditioning generation on a handful of real stroke
  samples from one person.
- **IAM-OnDB** is the standard dataset for this (stroke sequences, not images) — start there
  rather than trying to collect real pen data first.

## If it ever became a real feature

Generated strokes could drive a canvas animation that draws explanations stroke by stroke. Not
relevant now — just the natural place it would plug in if it ever got that far.
