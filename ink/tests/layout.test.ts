import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDocument, type RawStroke } from '../export/document.ts'
import { linesInReadingOrder } from '../structure/layout.ts'
import { IDS, Pen, SOURCE } from './fixtures/synthetic.ts'

function layout(strokes: RawStroke[]) {
  const doc = buildDocument({ ids: IDS, language: 'en', source: SOURCE, canvas: { width: 1000, height: 1000 }, strokes })
  return doc.structure
}

test('two words on one row form one line', () => {
  const pen = new Pen()
  const s = layout([...pen.word(10, 10, 3), ...pen.word(80, 12, 4)])
  assert.equal(s.blocks.length, 1)
  assert.equal(s.blocks[0].lines.length, 1)
  assert.equal(s.blocks[0].lines[0].strokeIds.length, 7)
})

test('stacked rows are separate lines in one block, top to bottom', () => {
  const pen = new Pen()
  const s = layout([...pen.word(10, 50, 2), ...pen.word(10, 10, 3)])
  assert.equal(s.blocks.length, 1)
  const lines = linesInReadingOrder(s)
  assert.equal(lines.length, 2)
  assert.ok(lines[0].bbox.y < lines[1].bbox.y)
  assert.deepEqual(lines.map((l) => l.lineId), ['l_001', 'l_002'])
})

test('a large vertical gap starts a new block', () => {
  const pen = new Pen()
  const s = layout([...pen.word(10, 10, 3), ...pen.word(10, 200, 3)])
  assert.equal(s.blocks.length, 2)
})

test('side-by-side columns are separate blocks', () => {
  const pen = new Pen()
  const s = layout([
    ...pen.word(10, 10, 3), ...pen.word(10, 40, 3),
    ...pen.word(600, 10, 3), ...pen.word(600, 40, 3),
  ])
  assert.equal(s.blocks.length, 2)
  assert.ok(s.blocks.every((b) => b.lines.length === 2))
})

test('an i-dot above the line joins that line', () => {
  const pen = new Pen()
  const s = layout([...pen.word(10, 10, 3), pen.stroke([[20, 2], [21, 3]])])
  assert.equal(linesInReadingOrder(s).length, 1)
})

test('a tall shape becomes a drawing block', () => {
  const pen = new Pen()
  const s = layout([
    ...pen.word(10, 10, 3),
    pen.stroke([[10, 100], [200, 100], [200, 300], [10, 300], [10, 100]]),
  ])
  assert.deepEqual(s.blocks.map((b) => b.type), ['text', 'drawing'])
})

test('line bbox is the union of its strokes', () => {
  const pen = new Pen()
  const s = layout(pen.word(10, 10, 3))
  assert.deepEqual(s.blocks[0].lines[0].bbox, { x: 10, y: 10, w: 44, h: 20 })
})
