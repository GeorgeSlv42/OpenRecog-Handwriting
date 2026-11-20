import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import type { NoteDocument, Stroke } from '@openrecog-handwriting/ink'

interface Word {
  id: string
  groupId: string
  text: string | null
  prev: string | null
  next: string | null
  regionId: string | null
  strokeIds: string[]
  sharedInk: boolean
  candidates: string[]
}

interface Structure {
  words: Word[]
  regions: { id: string; kind: string }[]
  connections: { from: string; to: string; strokeId: string }[]
  corrections: { strokeId: string; targetGroupIds: string[]; replacementGroupId: string | null }[]
  drawingStrokeIds: string[]
}

interface StructureModule {
  recognizeStructure?: (language: string, strokes: Stroke[]) => Promise<Structure>
}

/** Android owns this optional second pass; existing recognition and other platforms are unaffected. */
export function StructuredResults({ document }: { document: NoteDocument | null }) {
  const [result, setResult] = useState<{ document: NoteDocument; data?: Structure; error?: string } | null>(null)
  const [openWord, setOpenWord] = useState<string | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'android' || document?.recognition.status !== 'recognized') return
    let current = true
    setOpenWord(null)
    const analyze = async () => {
      try {
        const native = requireOptionalNativeModule<StructureModule>('MlkitInk')
        if (!native?.recognizeStructure) throw new Error('Rebuild the Android app to enable word links.')
        const data = await native.recognizeStructure(document.metadata.language, document.strokes)
        if (current) setResult({ document, data })
      } catch (error) {
        if (current) setResult({ document, error: error instanceof Error ? error.message : String(error) })
      }
    }
    void analyze()
    return () => { current = false }
  }, [document])

  if (Platform.OS !== 'android' || document?.recognition.status !== 'recognized') return null
  const active = result?.document === document ? result : null
  const data = active?.data
  const words = new Map(data?.words.map((word) => [word.id, word]) ?? [])
  const numbers = new Map(data?.words.map((word, index) => [word.id, index + 1]) ?? [])
  const regions = new Map(data?.regions.map((region, index) => [region.id, `${region.kind === 'cell' ? 'Cell' : 'Shape'} ${index + 1}`]) ?? [])
  const label = (id: string | null): string => id ? `#${numbers.get(id)} ${words.get(id)?.text ?? '(unread)'}` : 'null'
  const chains: Word[][] = []
  const seen = new Set<string>()
  for (const start of data?.words.filter((word) => word.prev === null) ?? []) {
    const chain: Word[] = []
    let word: Word | undefined = start
    while (word && !seen.has(word.id)) {
      seen.add(word.id)
      chain.push(word)
      word = word.next ? words.get(word.next) : undefined
    }
    chains.push(chain)
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Word links & diagrams · preview</Text>
      <Text style={styles.hint}>Links follow nearby words and continue onto aligned rows. Uncertain gaps and separate diagram labels stay unlinked. Tap a word for its metadata.</Text>
      {!active ? <Text style={styles.hint}>Recognizing text runs…</Text> : null}
      {active?.error ? <Text style={styles.warning}>{active.error}</Text> : null}
      {chains.map((chain, index) => (
        <View key={chain[0].id} style={styles.chain}>
          <Text style={styles.caption}>Chain {index + 1} · {regions.get(chain[0].regionId ?? '') ?? 'Page text'}</Text>
          <Text selectable style={styles.sequence}>null ↔ {chain.map((word) => label(word.id)).join(' ↔ ')} ↔ null</Text>
          {chain.map((word) => (
            <Pressable key={word.id} accessibilityRole="button" accessibilityLabel={`Details for ${label(word.id)}`}
              onPress={() => setOpenWord(openWord === word.id ? null : word.id)} style={styles.word}>
              <Text style={styles.wordText}>{label(word.id)}{word.sharedInk ? ' · shared ink boundary' : ''}</Text>
              <Text style={styles.hint}>prev: {label(word.prev)}   |   next: {label(word.next)}</Text>
              {openWord === word.id ? (
                <Text selectable style={styles.hint}>
                  ID: {word.id}{'\n'}Strokes: {word.strokeIds.join(', ')}{'\n'}
                  Group alternatives: {word.candidates.join(' / ') || 'No recognition'}
                  {word.sharedInk ? '\nML Kit returned several words for this group; their individual ink boundaries are unresolved.' : ''}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ))}
      {data?.words.length === 0 ? <Text style={styles.hint}>No text groups found.</Text> : null}
      {data && (data.regions.length > 0 || data.drawingStrokeIds.length > 0) ? (
        <View style={styles.chain}>
          <Text style={styles.caption}>Diagram structure · geometric estimates</Text>
          {data.regions.map((region) => (
            <Text key={region.id} style={styles.wordText}>
              {regions.get(region.id)} ({region.kind}): {data.words.filter((word) => word.regionId === region.id).map((word) => word.text ?? '?').join(' ') || '(no label)'}
            </Text>
          ))}
          {data.connections.map((connection) => (
            <Text key={connection.strokeId} style={styles.sequence}>{regions.get(connection.from)} — {regions.get(connection.to)}</Text>
          ))}
          <Text style={styles.hint}>Detected {data.drawingStrokeIds.length} shape/line strokes. Connections are undirected; arrow direction is not inferred.</Text>
        </View>
      ) : null}
      {data?.corrections.map((correction) => {
        const targets = data.words.filter((word) => correction.targetGroupIds.includes(word.groupId))
        const replacement = data.words.filter((word) => word.groupId === correction.replacementGroupId)
        return (
          <Text key={correction.strokeId} style={styles.warning}>
            Possible cross-out: {targets.map((word) => label(word.id)).join(', ') || 'unassigned'}.
            {replacement.length ? ` Possible replacement: ${replacement.map((word) => label(word.id)).join(', ')}.` : ''}
            {' '}Suggestion only; text and links were preserved.
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#bbc8db', gap: 8 },
  heading: { fontSize: 17, fontWeight: '700', color: '#183b70' },
  hint: { fontSize: 12, color: '#526077', lineHeight: 18 },
  caption: { fontSize: 13, fontWeight: '600', color: '#3b5274' },
  chain: { padding: 10, gap: 6, borderRadius: 8, backgroundColor: '#eaf0fa' },
  sequence: { fontSize: 15, color: '#173b75', lineHeight: 23 },
  word: { paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#c6d2e5' },
  wordText: { fontSize: 14, color: '#17263d' },
  warning: { fontSize: 13, color: '#824d0a', backgroundColor: '#fff2df', padding: 8, borderRadius: 6 },
})
