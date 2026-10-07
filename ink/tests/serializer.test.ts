import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDocument } from '../export/document.ts'
import { parseDocument, serializeDocument, InvalidDocumentError } from '../export/serialize.ts'
import { validateDocument } from '../export/validate.ts'
import { IDS, Pen, SOURCE } from './fixtures/synthetic.ts'

function sampleDoc() {
  const pen = new Pen(5000)
  return buildDocument({
    ids: IDS,
    language: 'en-US',
    source: SOURCE,
    canvas: { width: 800, height: 600 },
    strokes: [...pen.word(10, 10, 3), pen.stroke([[10, 60], [40, 61]], 0.42)],
    label: 'abc',
    createdAt: '2026-10-07T10:00:00.000Z',
    updatedAt: '2026-10-07T10:00:00.000Z',
    exportedAt: '2026-10-07T10:05:00.000Z',
  })
}

test('builds a valid v1 document with rebased time and ordered ids', () => {
  const doc = sampleDoc()
  assert.deepEqual(validateDocument(doc), { valid: true, errors: [] })
  assert.equal(doc.schemaVersion, '1.0.0')
  assert.deepEqual(doc.strokes.map((s) => s.strokeId), ['s_0001', 's_0002', 's_0003', 's_0004'])
  assert.equal(doc.strokes[0].points[0].t, 0)
  assert.ok(doc.strokes[3].points[0].t > doc.strokes[2].points[0].t)
  assert.equal(doc.recognition.status, 'notRecognized')
  assert.equal(doc.groundTruth.label, 'abc')
})

test('pressure is kept only when captured, and clamped to 0..1', () => {
  const doc = sampleDoc()
  assert.equal('p' in doc.strokes[0].points[0], false)
  assert.equal(doc.strokes[3].points[0].p, 0.42)

  const clamped = buildDocument({
    ids: IDS, language: 'en', source: SOURCE, canvas: { width: 1, height: 1 },
    strokes: [{ points: [{ x: 0, y: 0, t: 0, p: 1.7 }] }],
  })
  assert.equal(clamped.strokes[0].points[0].p, 1)
})

test('strokes are ordered by start time even if given out of order', () => {
  const doc = buildDocument({
    ids: IDS, language: 'en', source: SOURCE, canvas: { width: 1, height: 1 },
    strokes: [
      { points: [{ x: 50, y: 0, t: 900 }] },
      { points: [{ x: 0, y: 0, t: 100 }] },
    ],
  })
  assert.deepEqual(doc.strokes.map((s) => s.points[0].x), [0, 50])
})

test('serialize -> parse round-trips', () => {
  const doc = sampleDoc()
  const parsed = parseDocument(serializeDocument(doc))
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(doc)))
})

test('serialize rounds floats to 3 decimals', () => {
  const doc = sampleDoc()
  doc.strokes[0].points[0].x = 1 / 3
  assert.match(serializeDocument(doc, { pretty: false }), /"x":0\.333,/)
})

test('validator rejects schema violations', () => {
  const cases: [string, (d: any) => void, RegExp][] = [
    ['wrong version', (d) => { d.schemaVersion = '2.0.0' }, /schemaVersion/],
    ['missing metadata id', (d) => { delete d.metadata.courseId }, /missing courseId/],
    ['unexpected field', (d) => { d.extra = 1 }, /unexpected extra/],
    ['bad language', (d) => { d.metadata.language = 'english!' }, /language/],
    ['empty stroke', (d) => { d.strokes[0].points = [] }, /fewer than 1/],
    ['pressure out of range', (d) => { d.strokes[0].points[0].p = 2 }, /> 1/],
    ['bad candidate rank', (d) => {
      d.recognition.results.push({ recognitionId: 'r', target: { lineId: 'l_001' }, best: 'x', candidates: [{ rank: 0.5, text: 'x', score: null }] })
    }, /rank/],
  ]
  for (const [name, mutate, expected] of cases) {
    const doc: any = structuredClone(sampleDoc())
    mutate(doc)
    const { valid, errors } = validateDocument(doc)
    assert.equal(valid, false, name)
    assert.match(errors.join('\n'), expected, name)
  }
})

test('validator rejects dangling references', () => {
  const doc: any = structuredClone(sampleDoc())
  doc.structure.blocks[0].lines[0].strokeIds.push('s_9999')
  doc.gestures.push({
    gestureId: 'g_01', type: 'strike', strokeIds: ['s_0001'], score: null,
    targetStrokeIds: [], effect: 'delete', targetRecognitionId: 'r_missing',
  })
  const { errors } = validateDocument(doc)
  assert.match(errors.join('\n'), /unknown strokeId s_9999/)
  assert.match(errors.join('\n'), /unknown recognitionId r_missing/)
})

test('serialize throws on invalid documents', () => {
  const doc: any = sampleDoc()
  doc.metadata.pageId = ''
  assert.throws(() => serializeDocument(doc), InvalidDocumentError)
})
