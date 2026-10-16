import { StyleSheet, View } from 'react-native'
import ExcalidrawCanvas from './ExcalidrawCanvas'
import type { InkCanvasSnapshot } from './inkCanvasTypes'

interface Props {
  sessionId: number
  disabled: boolean
  onChange(snapshot: InkCanvasSnapshot): void
}

/** Expo embeds the DOM canvas locally on Android; ML Kit stays in the native host. */
export function InkCanvas({ sessionId, disabled, onChange }: Props) {
  return (
    <View style={styles.canvas} pointerEvents={disabled ? 'none' : 'auto'}>
      <ExcalidrawCanvas
        sessionId={sessionId}
        disabled={disabled}
        onSnapshot={async (snapshot) => onChange(snapshot)}
        dom={{ style: { flex: 1 }, scrollEnabled: false }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: { flex: 1, minHeight: 240, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden' },
})
