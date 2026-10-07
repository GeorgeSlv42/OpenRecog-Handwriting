import schema from './schema.v1.json' with { type: 'json' }

/**
 * Validates against schema.v1.json using the small JSON Schema subset that file uses
 * ($ref, type, const, enum, required, properties, additionalProperties:false, items,
 * minItems, minLength, minimum, maximum, pattern), then checks cross-references the
 * schema can't express (unique ids, line/gesture/result ids that must resolve).
 */

type JsonSchema = {
  $ref?: string
  type?: string | string[]
  const?: unknown
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, JsonSchema>
  additionalProperties?: boolean
  items?: JsonSchema
  minItems?: number
  minLength?: number
  minimum?: number
  maximum?: number
  pattern?: string
  $defs?: Record<string, JsonSchema>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const root = schema as JsonSchema

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function matchesType(value: unknown, type: string): boolean {
  const actual = typeOf(value)
  return actual === type || (type === 'number' && actual === 'integer')
}

function resolveRef(ref: string): JsonSchema {
  const name = ref.replace('#/$defs/', '')
  const def = root.$defs?.[name]
  if (!def) throw new Error(`Unknown $ref ${ref}`)
  return def
}

function check(value: unknown, s: JsonSchema, path: string, errors: string[]): void {
  if (s.$ref) return check(value, resolveRef(s.$ref), path, errors)

  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type]
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${typeOf(value)}`)
      return
    }
  }
  if ('const' in s && value !== s.const) {
    errors.push(`${path}: expected ${JSON.stringify(s.const)}`)
  }
  if (s.enum && !s.enum.includes(value)) {
    errors.push(`${path}: expected one of ${s.enum.join(', ')}`)
  }

  if (typeof value === 'string') {
    if (s.minLength !== undefined && value.length < s.minLength) {
      errors.push(`${path}: shorter than ${s.minLength}`)
    }
    if (s.pattern && !new RegExp(s.pattern).test(value)) {
      errors.push(`${path}: does not match ${s.pattern}`)
    }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path}: not finite`)
    if (s.minimum !== undefined && value < s.minimum) errors.push(`${path}: < ${s.minimum}`)
    if (s.maximum !== undefined && value > s.maximum) errors.push(`${path}: > ${s.maximum}`)
  }

  if (Array.isArray(value)) {
    if (s.minItems !== undefined && value.length < s.minItems) {
      errors.push(`${path}: fewer than ${s.minItems} items`)
    }
    if (s.items) value.forEach((item, i) => check(item, s.items!, `${path}[${i}]`, errors))
  }

  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of s.required ?? []) {
      if (!(key in obj)) errors.push(`${path}: missing ${key}`)
    }
    for (const [key, child] of Object.entries(obj)) {
      const childSchema = s.properties?.[key]
      if (childSchema) check(child, childSchema, `${path}.${key}`, errors)
      else if (s.additionalProperties === false) errors.push(`${path}: unexpected ${key}`)
    }
  }
}

function checkReferences(doc: Record<string, any>, errors: string[]): void {
  const strokeIds = new Set<string>()
  for (const s of doc.strokes ?? []) {
    if (strokeIds.has(s.strokeId)) errors.push(`duplicate strokeId ${s.strokeId}`)
    strokeIds.add(s.strokeId)
  }

  const resultIds = new Set<string>()
  for (const r of doc.recognition?.results ?? []) {
    if (resultIds.has(r.recognitionId)) errors.push(`duplicate recognitionId ${r.recognitionId}`)
    resultIds.add(r.recognitionId)
  }

  const lineIds = new Set<string>()
  const blockIds = new Set<string>()
  for (const b of doc.structure?.blocks ?? []) {
    if (blockIds.has(b.blockId)) errors.push(`duplicate blockId ${b.blockId}`)
    blockIds.add(b.blockId)
    for (const l of b.lines ?? []) {
      if (lineIds.has(l.lineId)) errors.push(`duplicate lineId ${l.lineId}`)
      lineIds.add(l.lineId)
      for (const id of l.strokeIds ?? []) {
        if (!strokeIds.has(id)) errors.push(`line ${l.lineId}: unknown strokeId ${id}`)
      }
      if (l.recognitionId && !resultIds.has(l.recognitionId)) {
        errors.push(`line ${l.lineId}: unknown recognitionId ${l.recognitionId}`)
      }
    }
  }

  const gestureIds = new Set<string>()
  for (const g of doc.gestures ?? []) {
    if (gestureIds.has(g.gestureId)) errors.push(`duplicate gestureId ${g.gestureId}`)
    gestureIds.add(g.gestureId)
    for (const id of [...(g.strokeIds ?? []), ...(g.targetStrokeIds ?? [])]) {
      if (!strokeIds.has(id)) errors.push(`gesture ${g.gestureId}: unknown strokeId ${id}`)
    }
    if (g.targetRecognitionId && !resultIds.has(g.targetRecognitionId)) {
      errors.push(`gesture ${g.gestureId}: unknown recognitionId ${g.targetRecognitionId}`)
    }
  }

  for (const r of doc.recognition?.results ?? []) {
    const { lineId, gestureId } = r.target ?? {}
    if ((lineId === undefined) === (gestureId === undefined)) {
      errors.push(`result ${r.recognitionId}: target needs exactly one of lineId, gestureId`)
    }
    if (lineId !== undefined && !lineIds.has(lineId)) {
      errors.push(`result ${r.recognitionId}: unknown lineId ${lineId}`)
    }
    if (gestureId !== undefined && !gestureIds.has(gestureId)) {
      errors.push(`result ${r.recognitionId}: unknown gestureId ${gestureId}`)
    }
  }
}

export function validateDocument(doc: unknown): ValidationResult {
  const errors: string[] = []
  check(doc, root, '$', errors)
  if (errors.length === 0) checkReferences(doc as Record<string, any>, errors)
  return { valid: errors.length === 0, errors }
}

export { schema }
