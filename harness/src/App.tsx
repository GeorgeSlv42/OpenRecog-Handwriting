import { useState, useRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './App.css'

/**
 * Ink-capture harness. Draw with a stylus/mouse, label what you wrote, export
 * the raw stroke data as JSON. That JSON is what recognition_text/recognition_math
 * prototyping code should consume — this page produces no recognition itself.
 */
function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('')

  const exportStrokes = () => {
    const api = apiRef.current
    if (!api) return

    const elements = api.getSceneElements()
    const strokes = elements
      .filter((el) => el.type === 'freedraw')
      .map((el) => ({
        // el.points are relative to (el.x, el.y); absolute coords are more useful
        // for recognition, so bake the offset in here.
        points: el.points.map(([x, y]) => [x + el.x, y + el.y]),
        pressures: el.pressures,
        strokeWidth: el.strokeWidth,
      }))

    if (strokes.length === 0) {
      setStatus('Nothing drawn yet.')
      return
    }

    const payload = {
      label: label || null,
      capturedAt: new Date().toISOString(),
      strokes,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stroke-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Exported ${strokes.length} stroke(s).`)
  }

  const clearCanvas = () => {
    apiRef.current?.resetScene()
    setStatus('')
  }

  return (
    <div className="harness">
      <div className="toolbar">
        <input
          type="text"
          placeholder="What did you write? (ground truth, optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button onClick={exportStrokes}>Export strokes (JSON)</button>
        <button onClick={clearCanvas}>Clear</button>
        {status && <span className="status">{status}</span>}
      </div>
      <div className="canvas-wrap">
        <Excalidraw
          excalidrawAPI={(api) => (apiRef.current = api)}
          initialData={{
            appState: {
              activeTool: {
                type: 'freedraw',
                locked: true,
                customType: null,
                lastActiveTool: null,
              },
            },
          }}
        />
      </div>
    </div>
  )
}

export default App
