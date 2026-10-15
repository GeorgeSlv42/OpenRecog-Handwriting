import { invoke } from '@tauri-apps/api/core'
import { NativeInkRecognizer, type NativeCandidate, type NativeRecognizer } from '@openrecog-handwriting/ink'

/** Tauri commands in desktop/src-tauri/src/windows_ink.rs. Tauri maps camelCase keys to snake_case. */
const tauriBridge: NativeRecognizer = {
  isModelDownloaded: (modelId) => invoke<boolean>('is_model_downloaded', { modelId }),
  downloadModel: (modelId, wifiOnly) => invoke<void>('download_model', { modelId, wifiOnly }),
  deleteModel: (modelId) => invoke<void>('delete_model', { modelId }),
  recognize: (modelId, strokes, preContext, writingArea) =>
    invoke<NativeCandidate[]>('recognize', { modelId, strokes, preContext, writingArea }),
}

export function createWindowsInkRecognizer(): NativeInkRecognizer {
  return new NativeInkRecognizer(tauriBridge, { engineName: 'windows-ink', engineVersion: null })
}
