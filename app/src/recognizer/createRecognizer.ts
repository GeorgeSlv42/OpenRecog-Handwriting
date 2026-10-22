import { Platform } from 'react-native'
import { createMlKitRecognizer } from '../../modules/mlkit-ink'
import type { RecognizerSetup } from './types'

/** Android and iOS: ML Kit through the local mlkit-ink module. Web/desktop: createRecognizer.web.ts. */
export function createRecognizer(): RecognizerSetup {
  return {
    recognizer: createMlKitRecognizer(),
    source: { app: 'openrecog-mobile', platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    // ML Kit gesture classifier for the default language (en-US). See
    // https://developers.google.com/ml-kit/vision/digital-ink-recognition/base-models
    gestureModelId: 'en-US-x-gesture',
    canManageModels: true,
    unavailableReason:
      'The mlkit-ink native module is not in this build. Use a development build (npm run android / npm run ios), not Expo Go.',
  }
}
