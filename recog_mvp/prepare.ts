import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseDocument } from '../ink/export/serialize.ts'

/** The desktop bridge consumes validated ink, never ground-truth labels or old text. */
export function prepareDocument(json: string) {
  const doc = parseDocument(json)
  const excluded = new Set(doc.gestures.flatMap(g => [
    ...g.strokeIds, ...(g.effect === 'delete' ? g.targetStrokeIds : []),
  ]))
  const strokes = new Map(doc.strokes.map(s => [s.strokeId, s]))
  return {
    language: doc.metadata.language,
    lines: doc.structure.blocks.flatMap(block => block.lines.map(line => ({
      lineId: line.lineId,
      blockType: block.type,
      strokes: block.type === 'drawing' ? [] : line.strokeIds
        .filter(id => !excluded.has(id))
        .map(id => strokes.get(id)!)
        .sort((a, b) => a.points[0].t - b.points[0].t)
        .map(s => ({ strokeId: s.strokeId, points: s.points })),
    }))),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Provide a schema v1 ink JSON file.')
    process.stdout.write(JSON.stringify(prepareDocument(readFileSync(process.argv[2], 'utf8'))))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
