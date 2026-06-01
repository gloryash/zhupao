export interface VoiceCueSource {
  textContent: string | null
  getAttribute(name: string): string | null
}

function cleanLabel(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function getSpokenLabel(source: VoiceCueSource | null | undefined): string {
  if (!source) return ''
  return cleanLabel(
    source.getAttribute('aria-label') ||
      source.getAttribute('title') ||
      source.textContent
  )
}

export function speakVoiceCue(label: string): void {
  const text = cleanLabel(label)
  if (!text || typeof window === 'undefined') return
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  utterance.pitch = 1

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
