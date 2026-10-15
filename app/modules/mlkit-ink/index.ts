import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'
import { NativeInkRecognizer, type NativeRecognizer } from '@openrecog-handwriting/ink'

/** Set to the ML Kit dependency version each platform's native code ships with. */
const MLKIT_VERSION = Platform.select<string | null>({ android: null, ios: null, default: null })

/** Null when the native module isn't linked (Expo Go, web, or a build made before the module existed). */
export function createMlKitRecognizer(): NativeInkRecognizer | null {
  const native = requireOptionalNativeModule<NativeRecognizer>('MlkitInk')
  if (!native) return null
  return new NativeInkRecognizer(native, {
    engineName: 'mlkit-digital-ink',
    engineVersion: MLKIT_VERSION,
    wifiOnly: false,
  })
}
