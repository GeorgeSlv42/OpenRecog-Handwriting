# ios/ — Swift ML Kit implementation

**Owner:** Dev B. **Requires a Mac with Xcode.**

Implements the contract in [`docs/recognizer-contract.md`](../../../../docs/recognizer-contract.md) — same names, shapes and error codes as
Android. When in doubt, match what Dev A's Android module does and raise the mismatch with the lead.

## Before you start

- Blocked on: lead sign-off of the contract, lead approval of the CocoaPod, and the Expo scaffold
  ([`mobile/README.md`](../../../README.md))
- Needs a Mac with Xcode + CocoaPods, and an Apple ID in Xcode for on-device builds — see
  Prerequisites in [`mobile/README.md`](../../../README.md)
- First milestone: one hard-coded stroke list recognized end to end (JS → Swift → ML Kit → JS)
  before building the full contract

## Setup

- [ ] **Ask the lead** before adding the `GoogleMLKit/DigitalInkRecognition` CocoaPod to this
      module's podspec
- [ ] Builds with `npx expo run:ios` on a simulator, then on a real device with Apple Pencil

## Work — verify every class/method name against the iOS guide before using it

- [ ] Model identifier from a language tag; unknown tag → `INVALID_MODEL_ID`
- [ ] Model download / check / delete via the model manager, with download conditions
      (cellular allowed only when not `wifiOnly`). iOS reports download completion via
      notifications — resolve the JS promise from those, and handle failure
- [ ] Build the `Ink` object: strokes of points with x, y, t
- [ ] Recognizer from options; pass pre-context and writing area when given
- [ ] Return candidates in engine order with `text` and `score` (nil → null)
- [ ] Keep one recognizer per model id; run off the main thread

## Done when

- [ ] Same replayed sample as Android gives the same output shape (texts may differ slightly)
- [ ] Gesture model classifies a strike-through as a strike
- [ ] All four error codes reachable
- [ ] Works offline after download
