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
- On-device model size/load time if using Google's kit (models download per-language — don't
  bundle them, fetch on first use).

## Don't confuse this with image OCR

**Image-based** OCR of scanned pages is pixels in; this is pen strokes in. Different input,
different (easier) problem — don't try to reuse an image OCR pipeline here.
