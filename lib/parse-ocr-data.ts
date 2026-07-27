export function parseOcrData(payload: any): any {
  const normalize = (value: any): any => {
    if (!value) return undefined
    if (typeof value === "string") {
      try {
        return normalize(JSON.parse(value))
      } catch {
        return undefined
      }
    }
    if (Array.isArray(value)) return fromArray(value)
    if (typeof value === "object") {
      const keys = Object.keys(value).length
      return keys > 0 ? value : undefined
    }
    return undefined
  }

  const fromArray = (value: any): any => {
    if (!Array.isArray(value) || value.length === 0) return undefined
    const first = value[0]
    if (!first) return undefined

    const extracted =
      first?.extractedData ||
      first?.data ||
      first?.json ||
      first?.output?.[0]?.content?.[0]?.text ||
      first?.output?.[0]?.json ||
      first

    return normalize(extracted)
  }

  const candidates = [
    normalize(payload?.extractedData),
    normalize(payload?.data),
    normalize(payload?.output?.[0]?.content?.[0]?.text),
    normalize(payload?.output?.[0]?.json),
    fromArray(payload),
    payload && typeof payload === "object" && !Array.isArray(payload) ? normalize(payload) : undefined,
  ]

  return candidates.find(v => v && Object.keys(v).length > 0) || {}
}
