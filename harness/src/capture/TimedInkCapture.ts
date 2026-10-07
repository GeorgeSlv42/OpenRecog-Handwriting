import { viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState } from '@excalidraw/excalidraw/types'
import type { InputDevice, Point, RawStroke } from '../../../ink/index.ts'

/**
 * Excalidraw's freedraw elements keep geometry and pressure but no per-point time, which
 * recognizers want. This records the raw pointer stream (coalesced events, scene coords,
 * PointerEvent.timeStamp) alongside Excalidraw and links each recording to the freedraw
 * element it produced, so erase/undo/clear in Excalidraw still decide what gets exported.
 */
interface Recording {
  pointerType: string
  points: Point[]
}

type FreeDraw = Extract<OrderedExcalidrawElement, { type: 'freedraw' }>

/** Scene px; an element starts where its pointerdown landed. */
const LINK_TOLERANCE = 4

export class TimedInkCapture {
  private active = new Map<number, Recording>()
  private pending: Recording[] = []
  private byElement = new Map<string, Recording>()
  private getAppState: () => AppState | null

  constructor(getAppState: () => AppState | null) {
    this.getAppState = getAppState
  }

  attach(target: HTMLElement): () => void {
    const down = (e: PointerEvent) => this.onDown(e)
    const move = (e: PointerEvent) => this.onMove(e)
    const up = (e: PointerEvent) => this.onUp(e)
    // Capture phase so we see the event before Excalidraw creates the element.
    target.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    return () => {
      target.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
    }
  }

  private toPoint(e: PointerEvent, appState: AppState): Point {
    const { x, y } = viewportCoordsToSceneCoords(e, appState)
    const point: Point = { x, y, t: e.timeStamp }
    // Mice and most touchscreens report a constant placeholder, not real pressure.
    if (e.pointerType === 'pen') point.p = e.pressure
    return point
  }

  private onDown(e: PointerEvent): void {
    const appState = this.getAppState()
    if (!appState || !e.isPrimary || appState.activeTool.type !== 'freedraw') return
    if (!(e.target instanceof HTMLCanvasElement)) return
    const rec: Recording = { pointerType: e.pointerType, points: [this.toPoint(e, appState)] }
    this.active.set(e.pointerId, rec)
    this.pending.push(rec)
  }

  private onMove(e: PointerEvent): void {
    const rec = this.active.get(e.pointerId)
    const appState = this.getAppState()
    if (!rec || !appState) return
    const events = e.getCoalescedEvents?.() ?? []
    for (const ev of events.length ? events : [e]) rec.points.push(this.toPoint(ev, appState))
  }

  private onUp(e: PointerEvent): void {
    this.active.delete(e.pointerId)
  }

  /** Call from Excalidraw's onChange. Links new freedraw elements to their recordings. */
  sync(elements: readonly OrderedExcalidrawElement[]): void {
    for (const el of elements) {
      if (el.type !== 'freedraw' || el.isDeleted || this.byElement.has(el.id)) continue
      const [dx, dy] = el.points[0] ?? [0, 0]
      const idx = this.pending.findIndex((rec) => {
        const p = rec.points[0]
        return Math.hypot(p.x - (el.x + dx), p.y - (el.y + dy)) <= LINK_TOLERANCE
      })
      if (idx === -1) continue
      this.byElement.set(el.id, this.pending[idx])
      // Older finished recordings that never produced an element (e.g. a pan) are dead.
      this.pending = this.pending.slice(idx + 1)
    }
  }

  /** Live freedraw strokes with timing, plus how many had to be skipped for lack of timing. */
  strokes(elements: readonly OrderedExcalidrawElement[]): { strokes: RawStroke[]; inputDevice: InputDevice; missing: number } {
    const strokes: RawStroke[] = []
    const devices = new Map<string, number>()
    let missing = 0
    for (const el of elements) {
      if (el.type !== 'freedraw' || el.isDeleted) continue
      const rec = this.byElement.get(el.id)
      if (!rec || rec.points.length === 0) {
        missing++
        continue
      }
      strokes.push({
        points: offsetPoints(rec.points, el),
        style: { strokeWidth: el.strokeWidth, color: el.strokeColor },
      })
      devices.set(rec.pointerType, (devices.get(rec.pointerType) ?? 0) + 1)
    }
    const top = [...devices.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const inputDevice: InputDevice = top === 'pen' || top === 'touch' || top === 'mouse' ? top : 'unknown'
    return { strokes, inputDevice, missing }
  }

  reset(): void {
    this.active.clear()
    this.pending = []
    this.byElement.clear()
  }
}

/** If the user moved the element after drawing it, shift the recording with it. */
function offsetPoints(points: Point[], el: FreeDraw): Point[] {
  const [dx, dy] = el.points[0] ?? [0, 0]
  const shiftX = el.x + dx - points[0].x
  const shiftY = el.y + dy - points[0].y
  if (Math.abs(shiftX) <= LINK_TOLERANCE && Math.abs(shiftY) <= LINK_TOLERANCE) return points
  return points.map((p) => ({ ...p, x: p.x + shiftX, y: p.y + shiftY }))
}
