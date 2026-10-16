'use dom'

import { useCallback, useEffect, useRef } from 'react'
import { Excalidraw, MainMenu, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { DOMProps } from 'expo/dom'
import { TimedInkCapture } from '../../../harness/src/capture/TimedInkCapture.ts'
import type { InkCanvasSnapshot } from './inkCanvasTypes'
import '@excalidraw/excalidraw/index.css'
import './excalidrawCanvas.css'

interface Props {
  sessionId: number
  disabled: boolean
  onSnapshot(snapshot: InkCanvasSnapshot): Promise<void>
  dom?: DOMProps
}

export default function ExcalidrawCanvas({ sessionId, disabled, onSnapshot }: Props) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const capture = useRef<TimedInkCapture | null>(null)
  capture.current ??= new TimedInkCapture(() => api.current?.getAppState() ?? null, viewportCoordsToSceneCoords)
  const latestCallback = useRef(onSnapshot)
  latestCallback.current = onSnapshot
  const pendingFrame = useRef<number | null>(null)
  const revision = useRef(0)
  const previous = useRef('')
  const delivery = useRef(Promise.resolve())
  const captureSession = useRef(sessionId)

  // Batch scene changes; only completed strokes cross the native bridge, not every pen sample.
  const publish = useCallback(() => {
    if (pendingFrame.current !== null) return
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null
      if (!api.current || !root.current) return
      const elements = api.current.getSceneElements()
      capture.current!.sync(elements)
      const snapshot = {
        sessionId: captureSession.current,
        ...capture.current!.strokes(elements),
        isDrawing: capture.current!.isDrawing(),
        width: root.current.clientWidth,
        height: root.current.clientHeight,
      }
      const serialized = JSON.stringify(snapshot)
      if (serialized === previous.current) return
      previous.current = serialized
      const next = { ...snapshot, revision: ++revision.current }
      delivery.current = delivery.current.then(() => {
        if (next.sessionId === captureSession.current) return latestCallback.current(next)
      }).catch((error) => {
        console.error('Could not send Excalidraw ink to the app', error)
      })
    })
  }, [])

  // Keep the WebView alive: pending Expo DOM replies must still have a native view to target.
  // A new session resets the editor and timed ink together, without reloading its document.
  const resetSession = useCallback(() => {
    if (!api.current || captureSession.current === sessionId) return
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current)
    pendingFrame.current = null
    captureSession.current = sessionId
    revision.current = 0
    previous.current = ''
    capture.current!.reset()
    api.current.resetScene()
    api.current.setActiveTool({ type: 'freedraw', locked: true })
    publish()
  }, [sessionId, publish])

  useEffect(resetSession, [resetSession])

  useEffect(() => {
    const element = root.current!
    const detach = capture.current!.attach(element)
    const resize = new ResizeObserver(publish)
    resize.observe(element)
    element.addEventListener('pointerdown', publish, true)
    window.addEventListener('pointerup', publish, true)
    window.addEventListener('pointercancel', publish, true)
    return () => {
      detach()
      resize.disconnect()
      element.removeEventListener('pointerdown', publish, true)
      window.removeEventListener('pointerup', publish, true)
      window.removeEventListener('pointercancel', publish, true)
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current)
      pendingFrame.current = null
    }
  }, [publish])

  return (
    <div ref={root} className="ink-excalidraw" style={{ pointerEvents: disabled ? 'none' : 'auto' }}>
      <Excalidraw
        excalidrawAPI={(instance) => { api.current = instance; resetSession(); publish() }}
        onChange={(elements) => { capture.current!.sync(elements); publish() }}
        initialData={{ appState: { activeTool: { type: 'freedraw', locked: true, lastActiveTool: null, customType: null }, currentItemStrokeColor: '#111111' } }}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false }, tools: { image: false } }}
        validateEmbeddable={false}
      >
        <MainMenu><MainMenu.DefaultItems.ClearCanvas /></MainMenu>
      </Excalidraw>
    </div>
  )
}
