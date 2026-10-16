import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AppState } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { TimedInkCapture } from './TimedInkCapture.ts'
import { buildDocument, validateDocument } from '../../../ink/index.ts'

class Canvas extends EventTarget {}
const fakeWindow = new EventTarget()
const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const savedCanvas = Object.getOwnPropertyDescriptor(globalThis, 'HTMLCanvasElement')
before(() => {
  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true })
  Object.defineProperty(globalThis, 'HTMLCanvasElement', { value: Canvas, configurable: true })
})
after(() => {
  for (const [key, saved] of [['window', savedWindow], ['HTMLCanvasElement', savedCanvas]] as const) {
    if (saved) Object.defineProperty(globalThis, key, saved)
    else Reflect.deleteProperty(globalThis, key)
  }
})

function pointer(type: string, x: number, y: number, t: number, pointerType = 'pen'): PointerEvent {
  const event = new Event(type)
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, pointerType, pressure: 0.6 })
  Object.defineProperty(event, 'timeStamp', { value: t })
  return event as PointerEvent
}

function scene(overrides = {}): OrderedExcalidrawElement {
  return {
    id: 'ink-1', type: 'freedraw', x: 10, y: 20, width: 10, height: 10,
    points: [[0, 0], [10, 10]], angle: 0, isDeleted: false, strokeWidth: 2, strokeColor: '#111111',
    ...overrides,
  } as OrderedExcalidrawElement
}

function setup() {
  const canvas = new Canvas()
  const state = { activeTool: { type: 'freedraw' } } as AppState
  // Simulate a canvas at zoom 2, with a viewport offset/pan applied by Excalidraw.
  const capture = new TimedInkCapture(() => state, (e) => ({ x: e.clientX / 2 - 5, y: e.clientY / 2 - 10 }))
  const detach = capture.attach(canvas as unknown as HTMLElement)
  return { canvas, capture, detach }
}

function draw(canvas: Canvas, capture: TimedInkCapture, device = 'pen') {
  canvas.dispatchEvent(pointer('pointerdown', 30, 60, 100, device))
  capture.sync([scene()])
  const move = pointer('pointermove', 50, 80, 120, device)
  move.getCoalescedEvents = () => [pointer('pointermove', 40, 70, 110, device), move]
  fakeWindow.dispatchEvent(move)
  fakeWindow.dispatchEvent(pointer('pointerup', 50, 80, 125, device))
  capture.sync([scene()])
}

test('Excalidraw capture preserves coalesced samples, scene coordinates, time, and pen pressure', () => {
  const { canvas, capture, detach } = setup()
  try {
    draw(canvas, capture)
    const output = capture.strokes([scene()])
    assert.equal(output.inputDevice, 'pen')
    assert.equal(output.missing, 0)
    assert.deepEqual(output.strokes[0].points.map(({ x, y, t, p }) => [x, y, t, p]), [
      [10, 20, 100, 0.6], [15, 25, 110, 0.6], [20, 30, 120, 0.6], [20, 30, 125, 0.6],
    ])
    const document = buildDocument({
      ids: { courseId: 'c', lectureId: 'l', noteId: 'n', pageId: 'p' }, language: 'en-US',
      source: { app: 'openrecog-mobile', platform: 'android', inputDevice: output.inputDevice },
      canvas: { width: 200, height: 100 }, strokes: output.strokes,
    })
    assert.equal(validateDocument(document).valid, true)
    assert.deepEqual(document.strokes[0].points.map((p) => p.t), [0, 10, 20, 25])
  } finally { detach() }
})

test('scene deletion/undo and redo control which timed ink is recognized', () => {
  const { canvas, capture, detach } = setup()
  try {
    draw(canvas, capture, 'touch')
    assert.equal(capture.strokes([scene({ isDeleted: true })]).strokes.length, 0)
    assert.equal(capture.strokes([]).strokes.length, 0)
    const restored = capture.strokes([scene()])
    assert.equal(restored.strokes.length, 1)
    assert.equal(restored.inputDevice, 'touch')
    assert.ok(restored.strokes[0].points.every((p) => p.p === undefined))
    assert.equal(capture.strokes([scene({ x: 50, y: 60 })]).strokes[0].points[0].x, 50)
  } finally { detach() }
})

test('active, canceled, imported and transformed ink cannot become stale recognition input', () => {
  const { canvas, capture, detach } = setup()
  try {
    canvas.dispatchEvent(pointer('pointerdown', 30, 60, 100))
    capture.sync([scene()])
    assert.equal(capture.isDrawing(), true)
    assert.equal(capture.strokes([scene()]).strokes.length, 0)
    fakeWindow.dispatchEvent(pointer('pointercancel', 40, 70, 110))
    assert.equal(capture.isDrawing(), false)
    assert.equal(capture.strokes([scene()]).missing, 1)
    draw(canvas, capture)
    assert.equal(capture.strokes([scene({ id: 'imported' })]).missing, 1)
    for (const change of [{ width: 20 }, { angle: 1 }, { points: [[0, 0], [-10, 10]] }]) {
      assert.equal(capture.strokes([scene(change)]).missing, 1)
    }
    assert.equal(capture.strokes([scene()]).missing, 0)
    capture.reset()
    assert.equal(capture.strokes([scene()]).missing, 1)
  } finally { detach() }
})
