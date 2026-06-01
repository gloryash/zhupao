function clean(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function formatAddressOptionLabel(name: string, detail: string): string {
  const cleanName = clean(name)
  const cleanDetail = clean(detail)

  if (!cleanName) return cleanDetail
  if (!cleanDetail || cleanDetail === cleanName) return cleanName

  if (cleanDetail.startsWith(cleanName)) {
    const remainder = cleanDetail
      .slice(cleanName.length)
      .replace(/^[\s,，、·:：-]+/, '')
      .trim()
    return remainder ? `${cleanName}，${remainder}` : cleanName
  }

  return `${cleanName}，${cleanDetail}`
}
