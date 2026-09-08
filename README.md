# tutorlm-handwriting

## What this is

Recognize handwriting from **pen strokes** (vector points: x, y, time, pressure) — the ink from
a stylus in the Canvas note type or a PDF annotation. **Not** image/photo OCR — that's a
different, already-solved problem elsewhere. This is about the raw pen trajectory, which
actually carries more signal than a flat image (you know the order and direction strokes were
drawn in).

Two genuinely different sub-problems — see each folder's README:

1. **[`recognition_text/`](recognition_text/)** — ordinary handwritten prose. Linear, left to
   right. The tractable one — start here.
2. **[`recognition_math/`](recognition_math/)** — handwritten equations. **2D layout, not a
   line of symbols** (fractions, exponents, roots). A structurally different, harder problem.
   Don't treat it as "text recognition but for math symbols."
3. **[`generation_stretch/`](generation_stretch/)** — stretch idea, not expected to be finished.
   The reverse direction: generate ink that looks handwritten.

## Setup

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/).
2. `uv sync`
3. `uv run main.py`

## Heads up

The actual recognition SDKs worth evaluating (Google's Digital Ink Recognition, Microsoft's Ink
Recognizer, MyScript for math) ship as JS/Android/iOS, not Python. Python is for prototyping,
data handling, and evaluating accuracy — the final wiring into Next.js/Tauri/Expo will need
JS/native glue later, same as the other two projects.
