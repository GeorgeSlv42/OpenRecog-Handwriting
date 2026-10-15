import { useRef, useState } from 'react'
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import type { Point, RawStroke } from '@openrecog-handwriting/ink'

interface Props {
  strokes: RawStroke[]
  onStrokesChange(strokes: RawStroke[]): void
  onSizeChange(size: { width: number; height: number }): void
}

function pointOf(e: GestureResponderEvent): Point {
  const { locationX, locationY, timestamp } = e.nativeEvent
  return { x: locationX, y: locationY, t: timestamp > 0 ? timestamp : Date.now() }
}

function toPolyline(points: readonly Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * Raw stroke capture: every touch/pen/mouse sample becomes a point, no smoothing or dropping.
 * Pressure and input type aren't captured yet (see app/README.md, "Platform work").
 */
export function InkCanvas({ strokes, onStrokesChange, onSizeChange }: Props) {
  const [active, setActive] = useState<Point[] | null>(null)
  const activeRef = useRef<Point[] | null>(null)
  const latest = useRef({ strokes, onStrokesChange })
  latest.current = { strokes, onStrokesChange }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        activeRef.current = [pointOf(e)]
        setActive(activeRef.current)
      },
      onPanResponderMove: (e) => {
        if (!activeRef.current) return
        activeRef.current = [...activeRef.current, pointOf(e)]
        setActive(activeRef.current)
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    }),
  ).current

  function finish() {
    const points = activeRef.current
    activeRef.current = null
    setActive(null)
    if (points?.length) latest.current.onStrokesChange([...latest.current.strokes, { points }])
  }

  const drawn = active ? [...strokes.map((s) => s.points), active] : strokes.map((s) => s.points)

  return (
    <View
      style={styles.canvas}
      onLayout={(e) => onSizeChange({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      {...responder.panHandlers}
    >
      {/* Not a touch target: touch locations must stay relative to the canvas, not to a stroke. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          {drawn.map((points, i) => (
            <Polyline
              key={i}
              points={toPolyline(points)}
              fill="none"
              stroke="#111"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d7e2',
    borderRadius: 8,
    overflow: 'hidden',
    userSelect: 'none',
  },
})
