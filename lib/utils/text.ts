export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function sanitizeFoodQuery(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

