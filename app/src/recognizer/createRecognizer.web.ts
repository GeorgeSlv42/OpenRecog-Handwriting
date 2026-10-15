import { isTauri } from '@tauri-apps/api/core'
import type { RecognizerSetup } from './types'
import { createWindowsInkRecognizer } from './windowsInk'

/** Inside the Tauri desktop shell: Windows Ink. In a plain browser: capture and export only. */
export function createRecognizer(): RecognizerSetup {
  const desktop = isTauri()
  return {
    recognizer: desktop ? createWindowsInkRecognizer() : null,
    source: { app: desktop ? 'openrecog-desktop' : 'openrecog-web', platform: 'web' },
    gestureModelId: null,
    canManageModels: false,
    unavailableReason: 'No recognizer in a plain browser. Run the desktop app (npm run desktop) to use Windows Ink.',
  }
}
