import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

/** Android/iOS: write to the cache dir, then open the system share sheet. Returns a status line. */
export async function shareDocument(json: string, fileName: string): Promise<string> {
  const file = new File(Paths.cache, fileName)
  file.write(json)
  if (!(await Sharing.isAvailableAsync())) return `Saved to ${file.uri}`
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export ink JSON' })
  return `Exported ${fileName}`
}
