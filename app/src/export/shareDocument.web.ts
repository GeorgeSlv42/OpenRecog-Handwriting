/** Browser and desktop: trigger a file download. Returns a status line. */
export async function shareDocument(json: string, fileName: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return `Downloaded ${fileName}`
}
