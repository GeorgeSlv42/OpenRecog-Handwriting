import type { InkRecognizer, Metadata } from '@openrecog-handwriting/ink'

/** What the screen needs to know about the platform it runs on. Built once per app start. */
export interface RecognizerSetup {
  /** Null when this platform has no recognizer; the app still captures and exports. */
  recognizer: InkRecognizer | null
  source: Omit<Metadata['source'], 'inputDevice'>
  /** Null skips gesture detection (always null until the gesture model id is confirmed). */
  gestureModelId: string | null
  /** False when models come from the OS (Windows) and can't be downloaded by the app. */
  canManageModels: boolean
  /** Shown when `recognizer` is null. */
  unavailableReason: string
}
