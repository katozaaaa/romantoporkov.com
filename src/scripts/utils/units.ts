export function pxToRem(px: number) {
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize
  )
  const rem = px / rootFontSize
  return `${parseFloat(rem.toFixed(6))}rem`
}

export function toRemLength(value: string) {
  const trimmed = value.trim()
  if (!trimmed.endsWith('px')) {
    return trimmed
  }
  const px = Number.parseFloat(trimmed)
  if (Number.isNaN(px)) {
    return trimmed
  }
  return pxToRem(px)
}
