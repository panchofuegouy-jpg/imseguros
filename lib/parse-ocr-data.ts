export function parseOcrData(payload: any): any {
  const normalize = (value: any, depth = 0): any => {
    // Prevent infinite recursion
    if (depth > 5) return undefined

    if (!value) return undefined

    if (typeof value === "string") {
      let trimmed = value.trim()

      // Handle markdown code blocks (```json ... ```)
      if (trimmed.startsWith('```')) {
        const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
        if (match) {
          trimmed = match[1].trim()
        }
      }

      // Only try to parse if it looks like JSON
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed)
          return normalize(parsed, depth + 1)
        } catch (e) {
          console.warn('Failed to parse JSON string:', e, { input: trimmed.substring(0, 100) })
          return undefined
        }
      }
      return undefined
    }

    if (Array.isArray(value)) return fromArray(value, depth)

    if (typeof value === "object") {
      const keys = Object.keys(value).length
      // Return object only if it has keys and contains some expected field
      if (keys > 0) {
        return value
      }
      return undefined
    }

    return undefined
  }

  const fromArray = (value: any, depth = 0): any => {
    if (!Array.isArray(value) || value.length === 0) return undefined
    const first = value[0]
    if (!first) return undefined

    // Try to extract data from first array element
    const extracted =
      first?.extractedData ||
      first?.data ||
      first?.json ||
      first?.output?.[0]?.content?.[0]?.text ||
      first?.output?.[0]?.json ||
      first

    return normalize(extracted, depth + 1)
  }

  // List of paths to try in order
  const candidates = [
    // Direct extractedData field
    normalize(payload?.extractedData),
    // Direct data field
    normalize(payload?.data),
    // Claude API format: output[0].content[0].text
    normalize(payload?.output?.[0]?.content?.[0]?.text),
    // Claude API format: output[0].json
    normalize(payload?.output?.[0]?.json),
    // If payload is an array, try to extract from first element
    fromArray(payload),
    // If nothing worked, try the payload itself if it's an object
    payload && typeof payload === "object" && !Array.isArray(payload) ? normalize(payload) : undefined,
  ]

  const result = candidates.find(v => v && typeof v === "object" && Object.keys(v).length > 0)

  if (!result) {
    console.warn('parseOcrData: No valid extracted data found in payload', {
      payload: JSON.stringify(payload).substring(0, 500),
    })
    return {}
  }

  // Log what we found for debugging
  console.log('parseOcrData: Successfully extracted', {
    dataKeys: Object.keys(result),
    hasRequired: {
      numero_poliza: !!result.numero_poliza,
      tipo: !!result.tipo,
    },
  })

  return result
}
