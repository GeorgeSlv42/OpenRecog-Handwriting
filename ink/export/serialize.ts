import type { NoteDocument } from '../model/types.ts'
import { validateDocument } from './validate.ts'

const DECIMALS = 1000

function roundNumbers(_key: string, value: unknown): unknown {
  return typeof value === 'number' && !Number.isInteger(value)
    ? Math.round(value * DECIMALS) / DECIMALS
    : value
}

export class InvalidDocumentError extends Error {
  readonly errors: string[]
  constructor(errors: string[]) {
    super(`Invalid ink document:\n  ${errors.slice(0, 20).join('\n  ')}`)
    this.errors = errors
  }
}

/** Validates, then serializes with numbers rounded to 3 decimals. Throws on invalid docs. */
export function serializeDocument(doc: NoteDocument, { pretty = true } = {}): string {
  const { valid, errors } = validateDocument(doc)
  if (!valid) throw new InvalidDocumentError(errors)
  return JSON.stringify(doc, roundNumbers, pretty ? 2 : undefined)
}

export function parseDocument(json: string): NoteDocument {
  const doc: unknown = JSON.parse(json)
  const { valid, errors } = validateDocument(doc)
  if (!valid) throw new InvalidDocumentError(errors)
  return doc as NoteDocument
}
