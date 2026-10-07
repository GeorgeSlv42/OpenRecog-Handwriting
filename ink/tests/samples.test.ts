import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { validateDocument } from '../export/validate.ts'

const dir = new URL('../../docs/samples/', import.meta.url)

for (const name of readdirSync(dir).filter((f) => f.endsWith('.v1.json'))) {
  test(`docs/samples/${name} is a valid v1 document`, () => {
    const doc = JSON.parse(readFileSync(new URL(name, dir), 'utf8'))
    assert.deepEqual(validateDocument(doc).errors, [])
  })
}
