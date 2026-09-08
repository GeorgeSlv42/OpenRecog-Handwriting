# Recognition — text

## What this is

Ordinary handwritten notes (prose) written with a stylus, as pen-stroke vector data → text.

## Where to start

- **Google's Digital Ink Recognition** (now under MediaPipe, was ML Kit) — built for exactly
  this input: a list of strokes, each a list of timed points. Runs on-device, free, many
  languages. Default starting point.
- Microsoft's Ink Recognizer (Azure) is the cloud alternative — better for mixed
  shapes+text content, but paid and online-only. Worth comparing against, not the default.

## What to measure

- Recognition accuracy (character/word error rate) against real stylus samples.
- On-device model size/load time if using Google's kit (models download per-language, similar
  idea to other local models in this org's stack — don't bundle them, fetch on first use).

## Don't confuse this with the OCR spike already in the app

SFTS already has a measured, working pipeline for **image-based** OCR of scanned pages
(`ocr-htr-feasibility.md` in the SFTS codex). That's pixels in, this is pen strokes in. Different
input, different (easier) problem — no need to reconcile the two or reuse that pipeline.
