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

const FOOD_QUESTION_PREFIXES = [
  /^(quantas?|quanto)\s+(calorias?|kcal)\s+(tem|possui|existem)\s+/i,
  /(calorias?|kcal)\s+(tem|da|de)\s+/i,
  /^valor\s+nutricional\s+(de|do|da)\s+/i,
  /^informacoes?\s+nutricionais?\s+(de|do|da)\s+/i,
  /^nutrientes?\s+(de|do|da)\s+/i,
  /^quais?\s+os?\s+nutrientes?\s+(de|do|da)\s+/i,
]

export function extractFoodNameFromQuestion(text: string): string {
  let cleaned = text.trim()
  for (const pattern of FOOD_QUESTION_PREFIXES) {
    cleaned = cleaned.replace(pattern, '')
  }
  cleaned = cleaned.replace(/\?+$/, '').trim()
  if (!cleaned) {
    return sanitizeFoodQuery(text)
  }
  return sanitizeFoodQuery(cleaned)
}

