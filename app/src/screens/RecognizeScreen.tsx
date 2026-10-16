import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  buildDocument,
  linesInReadingOrder,
  recognizeDocument,
  serializeDocument,
  type NoteDocument,
  type RawStroke,
  type InputDevice,
} from '@openrecog-handwriting/ink'
import { InkCanvas } from '../components/InkCanvas'
import type { InkCanvasSnapshot } from '../components/inkCanvasTypes'
import { DEFAULTS } from '../config'
import { shareDocument } from '../export/shareDocument'
import { createRecognizer } from '../recognizer/createRecognizer'

type ModelState = 'checking' | 'ready' | 'missing' | 'busy' | 'error' | 'none'

const MODEL_LABEL: Record<ModelState, string> = {
  checking: 'checking…',
  ready: 'ready',
  missing: 'not downloaded',
  busy: 'working…',
  error: 'error',
  none: 'no recognizer',
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function RecognizeScreen() {
  const setup = useMemo(createRecognizer, [])
  const { recognizer } = setup

  const [language, setLanguage] = useState(DEFAULTS.language)
  const [strokes, setStrokes] = useState<RawStroke[]>([])
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })
  const [sessionId, setSessionId] = useState(0)
  const canvasVersion = useRef({ sessionId: 0, revision: 0 })
  const [inputDevice, setInputDevice] = useState<InputDevice>('unknown')
  const [isDrawing, setIsDrawing] = useState(false)
  const [missingInk, setMissingInk] = useState(0)
  const [doc, setDoc] = useState<NoteDocument | null>(null)
  const [model, setModel] = useState<ModelState>(recognizer ? 'checking' : 'none')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(recognizer ? null : setup.unavailableReason)
  const [openLine, setOpenLine] = useState<string | null>(null)

  const refreshModel = useCallback(async () => {
    if (!recognizer) return
    try {
      setModel((await recognizer.isModelDownloaded(language)) ? 'ready' : 'missing')
    } catch (err) {
      setModel('error')
      setMessage(errorText(err))
    }
  }, [recognizer, language])

  useEffect(() => {
    refreshModel()
  }, [refreshModel])

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (err) {
      setMessage(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const build = () =>
    buildDocument({
      ids: DEFAULTS.ids,
      language,
      source: { ...setup.source, inputDevice },
      canvas,
      strokes,
    })

  const onRecognize = () =>
    run(async () => {
      const version = canvasVersion.current
      if (!recognizer) {
        setDoc(build())
        return setup.unavailableReason
      }
      const result = await recognizeDocument(build(), recognizer, { gestureModelId: setup.gestureModelId })
      if (version !== canvasVersion.current) return 'The drawing changed. Tap Recognize again.'
      setDoc(result)
      refreshModel()
      return result.recognition.status === 'failed' ? `Recognition failed: ${result.recognition.error}` : null
    })

  const onModelAction = (action: 'download' | 'delete') =>
    run(async () => {
      if (!recognizer) return null
      setModel('busy')
      try {
        if (action === 'download') await recognizer.downloadModel(language)
        else await recognizer.deleteModel(language)
        return action === 'download' ? `Model ${language} downloaded` : `Model ${language} deleted`
      } finally {
        await refreshModel()
      }
    })

  const onExport = () =>
    run(async () => {
      const exported = doc ?? build()
      return shareDocument(serializeDocument(exported), `${exported.metadata.pageId}-${Date.now()}.v1.json`)
    })

  const onClear = () => {
    const nextSession = canvasVersion.current.sessionId + 1
    canvasVersion.current = { sessionId: nextSession, revision: 0 }
    setSessionId(nextSession)
    setStrokes([])
    setIsDrawing(false)
    setMissingInk(0)
    setInputDevice('unknown')
    setDoc(null)
    setOpenLine(null)
    setMessage(null)
  }

  const onCanvasChange = (snapshot: InkCanvasSnapshot) => {
    const current = canvasVersion.current
    if (snapshot.sessionId !== current.sessionId || snapshot.revision <= current.revision) return
    canvasVersion.current = { sessionId: snapshot.sessionId, revision: snapshot.revision }
    setStrokes(snapshot.strokes)
    setCanvas({ width: snapshot.width, height: snapshot.height })
    setInputDevice(snapshot.inputDevice)
    setIsDrawing(snapshot.isDrawing)
    setMissingInk(snapshot.missing)
    setDoc(null)
  }

  const results = new Map(doc?.recognition.results.map((r) => [r.recognitionId, r]) ?? [])
  const lines = doc ? linesInReadingOrder(doc.structure) : []

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Text style={styles.label}>Language</Text>
        <TextInput
          style={styles.input}
          value={language}
          onChangeText={setLanguage}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
        <Text style={styles.label}>
          {recognizer?.engineName ?? 'capture only'} · model {MODEL_LABEL[model]}
        </Text>
        {setup.canManageModels && recognizer ? (
          <>
            <Button title="Download model" onPress={() => onModelAction('download')} disabled={busy} />
            <Button title="Delete model" onPress={() => onModelAction('delete')} disabled={busy} />
          </>
        ) : null}
      </View>

      <InkCanvas sessionId={sessionId} disabled={busy} onChange={onCanvasChange} />

      <View style={styles.toolbar}>
        <Button title={busy ? 'Working…' : 'Recognize'} onPress={onRecognize} disabled={busy || isDrawing || missingInk > 0 || strokes.length === 0} primary />
        <Button title="Export JSON" onPress={onExport} disabled={busy || isDrawing || missingInk > 0 || strokes.length === 0} />
        <Button title="Clear" onPress={onClear} disabled={busy || isDrawing} />
        <Text style={styles.label}>{strokes.length} strokes</Text>
      </View>

      {missingInk > 0 ? <Text style={styles.message}>Some ink was imported, resized, rotated, or interrupted. Undo that change or redraw it before recognizing. Use Excalidraw’s undo and eraser controls.</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <ScrollView style={styles.results}>
        {lines.map((line) => {
          const result = line.recognitionId ? results.get(line.recognitionId) : undefined
          const open = openLine === line.lineId
          return (
            <Pressable key={line.lineId} onPress={() => setOpenLine(open ? null : line.lineId)} style={styles.line}>
              <Text style={styles.lineText}>
                <Text style={styles.lineId}>{line.lineId} </Text>
                {result?.best ?? '—'}
              </Text>
              {open && result
                ? result.candidates.map((c) => (
                    <Text key={c.rank} style={styles.candidate}>
                      {c.rank}. {c.text} {c.score === null ? '' : `(score ${c.score})`}
                    </Text>
                  ))
                : null}
            </Pressable>
          )
        })}
        {doc?.gestures.map((g) => (
          <Text key={g.gestureId} style={styles.candidate}>
            gesture {g.type} → {g.effect} ({g.targetStrokeIds.length} strokes)
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}

function Button({ title, onPress, disabled, primary }: { title: string; onPress(): void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary && styles.primary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 12, gap: 8, backgroundColor: '#f5f7fb' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  label: { color: '#445', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#c5cdd8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
    backgroundColor: '#fff',
  },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#e3e8f0' },
  primary: { backgroundColor: '#2f5bea' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#223', fontWeight: '600' },
  primaryText: { color: '#fff' },
  message: { color: '#8a3b00', backgroundColor: '#fff4e5', padding: 8, borderRadius: 6 },
  results: { maxHeight: 180 },
  line: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccd' },
  lineText: { fontSize: 16, color: '#111' },
  lineId: { color: '#889', fontSize: 12 },
  candidate: { color: '#556', fontSize: 13, paddingLeft: 12 },
})
