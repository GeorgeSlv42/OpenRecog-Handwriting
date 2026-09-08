# Recognition — math

## What this is

Handwritten equations, as pen-stroke vector data → structured notation (LaTeX or MathML) an AI
can actually reason about.

## Why this is a different problem than `recognition_text/`

Prose is **linear** — one symbol after another, left to right. Math is **2D** — a fraction bar,
an exponent, a square root, a matrix are spatial layouts, not a sequence. Recognizing individual
symbols is the easy part; figuring out how they relate spatially (this is a superscript of that,
this is over that fraction bar) is the actual problem. Don't stretch a text-ink recognizer to
cover this — it isn't built for it.

## Where to start

- **MyScript** — the company that specializes in exactly this (handwritten math → LaTeX). Their
  Interactive Ink SDK handles the 2D layout parsing. Evaluate this before considering building
  a layout parser from scratch.
- The rough shape a from-scratch pipeline would need, if MyScript doesn't fit: symbol
  segmentation (what shape is this stroke/group) → layout parsing (how are these arranged
  spatially) → structured output (LaTeX). Three separate stages, don't merge them.

## Context matters here — more than for text

The same stroke can mean different things depending on surrounding structure (a horizontal line
could be a fraction bar or a minus sign). Don't expect a symbol-by-symbol classifier alone to get
this right — the structural/layout stage is where that ambiguity actually gets resolved.

## Expectation

This is the harder half of recognition. Don't be surprised if this takes meaningfully longer
than `recognition_text/` to get anywhere usable.
