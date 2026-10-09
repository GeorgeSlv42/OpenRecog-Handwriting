# OpenRecog-Handwriting

## What this is

Recognize handwriting from **pen strokes** (vector points: x, y, time, pressure) — the ink from
a stylus on a note canvas or a PDF annotation. **Not** image/photo OCR — that's a
different, already-solved problem. This is about the raw pen trajectory, which
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

## Getting real ink data

[`harness/`](harness/) is a small standalone app (Excalidraw) for drawing with a stylus and
exporting real stroke data — see its README. Use it to generate test data for
`recognition_text/` and `recognition_math/` rather than guessing at the input shape.

## Ink JSON for the tutor

[`ink/`](ink/) is the shared TypeScript core (strokes → layout → recognition → versioned JSON),
used by the harness and the mobile app. The format is documented in
[`docs/ink-schema.md`](docs/ink-schema.md), with samples in [`docs/samples/`](docs/samples/).

## Windows desktop recognition

[`desktop/`](desktop/) provides a runnable Windows Ink MVP: open a v1 JSON export,
select an installed handwriting recognizer, recognize its lines, and copy the text.
It uses Windows PowerShell 5.1 and Node.js 24+; no .NET SDK is required.
See [`desktop/README.md`](desktop/README.md) for the launch command and limitations.

## Where to start (Phase 1 team)

Each folder below has a `TODO.md` with the tasks and a "done when".

| Who | Start here |
|---|---|
| Lead | [`mobile/modules/mlkit-ink/README.md`](mobile/modules/mlkit-ink/README.md) — sign off the native API contract first |
| Dev A — Android + app | [`mobile/README.md`](mobile/README.md), then `mobile/modules/mlkit-ink/android/`, `mobile/modules/mlkit-ink/src/`, `mobile/app/` |
| Dev B — iOS + capture | `mobile/modules/mlkit-ink/ios/`, `mobile/components/` (needs a Mac) |
| Dev C — math + evaluation | [`recognition_math/TODO.md`](recognition_math/TODO.md), `recognition_text/dataset/`, `recognition_text/evaluation/` |

## Heads up

The actual recognition SDKs worth evaluating (Google's Digital Ink Recognition, Microsoft's Ink
Recognizer, MyScript for math) ship as JS/Android/iOS, not Python. Python is for prototyping,
data handling, and evaluating accuracy — the app integration (see [`mobile/`](mobile/)) is
TypeScript plus native glue.
