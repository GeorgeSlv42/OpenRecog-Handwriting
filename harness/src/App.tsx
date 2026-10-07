import { useEffect, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import './App.css'
import { buildDocument, serializeDocument, SCHEMA_VERSION } from '../../ink/index.ts'
import { TimedInkCapture } from './capture/TimedInkCapture.ts'

type ExportFormat = 'v1' | 'legacy'

const DEFAULT_IDS = {
  courseId: 'harness-course',
  lectureId: 'harness-lecture',
  noteId: 'harness-note',
  pageId: 'page-1',
}

function download(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Ink-capture harness. Draw with a stylus/mouse, label what you wrote, export
 * the raw stroke data as JSON. That JSON is what recognition_text/recognition_math
 * prototyping code should consume — this page produces no recognition itself
 * (ML Kit runs on-device in the mobile app; v1 exports here have recognition
 * status "notRecognized").
 */
function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const captureRef = useRef<TimedInkCapture | null>(null)
  captureRef.current ??= new TimedInkCapture(() => apiRef.current?.getAppState() ?? null)
  const createdAtRef = useRef(new Date().toISOString())

  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('')
  const [format, setFormat] = useState<ExportFormat>('v1')
  const [ids, setIds] = useState(DEFAULT_IDS)
  const [language, setLanguage] = useState('en-US')

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    return captureRef.current!.attach(wrap)
  }, [])

  const exportLegacy = (api: ExcalidrawImperativeAPI) => {
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
    download(JSON.stringify(payload, null, 2), `stroke-${Date.now()}.json`)
    setStatus(`Exported ${strokes.length} stroke(s).`)
  }

  const exportV1 = (api: ExcalidrawImperativeAPI) => {
    const { strokes, inputDevice, missing } = captureRef.current!.strokes(api.getSceneElements())
    if (strokes.length === 0) {
      setStatus(missing ? `No timed strokes (${missing} without timing data).` : 'Nothing drawn yet.')
      return
    }
    const wrap = wrapRef.current
    try {
      const doc = buildDocument({
        ids,
        language,
        source: { app: 'harness', platform: 'web', inputDevice },
        canvas: { width: wrap?.clientWidth ?? 0, height: wrap?.clientHeight ?? 0 },
        strokes,
        label,
        createdAt: createdAtRef.current,
      })
      download(serializeDocument(doc), `ink-${ids.noteId}-${ids.pageId}-${Date.now()}.json`)
      const lines = doc.structure.blocks.reduce((n, b) => n + b.lines.length, 0)
      setStatus(
        `Exported ${doc.strokes.length} stroke(s), ${lines} line(s), ${doc.structure.blocks.length} block(s)` +
          (missing ? `; skipped ${missing} without timing data.` : '.'),
      )
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const exportStrokes = () => {
    const api = apiRef.current
    if (!api) return
    if (format === 'legacy') exportLegacy(api)
    else exportV1(api)
  }

  const clearCanvas = () => {
    apiRef.current?.resetScene()
    captureRef.current?.reset()
    createdAtRef.current = new Date().toISOString()
    setStatus('')
  }

  const idField = (key: keyof typeof DEFAULT_IDS) => (
    <label className="field">
      {key}
      <input value={ids[key]} onChange={(e) => setIds({ ...ids, [key]: e.target.value })} />
    </label>
  )

  return (
    <div className="harness">
      <div className="toolbar">
        <input
          type="text"
          placeholder="What did you write? (ground truth, optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <option value="v1">Schema v{SCHEMA_VERSION}</option>
          <option value="legacy">Legacy (strokes only)</option>
        </select>
        <button onClick={exportStrokes}>Export strokes (JSON)</button>
        <button onClick={clearCanvas}>Clear</button>
        {status && <span className="status">{status}</span>}
      </div>
      {format === 'v1' && (
        <div className="toolbar meta">
          {idField('courseId')}
          {idField('lectureId')}
          {idField('noteId')}
          {idField('pageId')}
          <label className="field">
            language
            <input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </label>
        </div>
      )}
      <div className="canvas-wrap" ref={wrapRef}>
        <Excalidraw
          excalidrawAPI={(api) => (apiRef.current = api)}
          onChange={(elements) => captureRef.current?.sync(elements)}
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
