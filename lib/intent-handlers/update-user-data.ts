import { IntentContext } from '@/lib/intent-handlers/types'
import { upsertUserData, UserRecord } from '@/lib/services/users'

// Regex fallback para casos onde LLM não extraiu dados
const weightRegex = /(?:peso|quilo)\s*(?:para|é|esta|está|de)?\s*(\d{2,3}(?:[.,]\d{1,2})?)\s?(?:kg|quilo?s?)|(\d{2,3}(?:[.,]\d{1,2})?)\s?(?:kg|quilo?s?)/i
const heightRegex = /(?:altura|cent[ií]metro)\s*(?:para|é|esta|está|de)?\s*(\d{1}(?:[.,]\d{1,2})?)\s?m\b|(\d{1}(?:[.,]\d{1,2})?)\s?m\b|(?:altura|cent[ií]metro)\s*(?:para|é|esta|está|de)?\s*(\d{2,3})\s?(?:cm|cent[ií]metros?)|(\d{2,3})\s?(?:cm|cent[ií]metros?)/i
const ageRegex = /(?:idade|ano)\s*(?:para|é|esta|está|de)?\s*(\d{2})\s?(?:anos?|idade)|(\d{2})\s?(?:anos?)/i
const goalCaloriesRegex = /(?:meta|objetivo|calorias?)\s*(?:de|é|para|esta|está)?\s*(\d{3,4})\s?(?:kcal|calorias?)|(\d{3,4})\s?(?:kcal|calorias?)(?:\s+(?:de\s+)?(?:meta|objetivo))?/i
const goalProteinRegex = /(?:prote[ií]na|prot)\s*(?:de|é|para|esta|está)?\s*(\d{2,3})\s?(?:g|gramas?)|(\d{2,3})\s?(?:g|gramas?)\s+(?:de\s+)?(?:prote[ií]na|prot)/i
const genderRegex = /\b(masculino|feminino|m|f|homem|mulher|h|M|F)\b/i
const nameRegex = /(?:meu\s+nome\s+é|sou\s+(?:o|a)|chamo|nome)\s+([A-Za-zÀ-ÿ\s]{2,30})/i

/**
 * Normaliza gênero para formato padrão
 */
function normalizeGender(gender: string | null | undefined): string | null {
  if (!gender) return null
  
  const normalized = gender.toLowerCase().trim()
  if (['masculino', 'm', 'homem', 'h'].includes(normalized)) {
    return 'masculino'
  }
  if (['feminino', 'f', 'mulher'].includes(normalized)) {
    return 'feminino'
  }
  return null
}

/**
 * Identifica quais campos estão faltando no perfil do usuário
 */
function getMissingFields(user: UserRecord | null | undefined): string[] {
  if (!user) return []
  
  const missing: string[] = []
  if (!user.weight_kg) missing.push('peso (kg)')
  if (!user.height_cm) missing.push('altura (cm)')
  if (!user.age) missing.push('idade')
  if (!user.gender) missing.push('gênero')
  if (!user.goal_calories) missing.push('meta calórica (kcal)')
  // user_name é opcional, não incluir em missing
  return missing
}

/**
 * Handler unificado para atualizar dados do usuário e onboarding
 * Prioriza dados extraídos pelo LLM, usa regex como fallback
 */
export async function handleUpdateUserDataIntent(
  context: IntentContext
): Promise<string> {
  if (!context.user?.id) {
    return '⚠️ Preciso do seu cadastro para atualizar dados. Digite "ajuda" para começar.'
  }

  const payload: Record<string, any> = {}
  const message = context.messageText
  const missing = getMissingFields(context.user)

  // PRIORIDADE 1: Usar dados extraídos pelo LLM (se disponível)
  if (context.intentResult?.user_data) {
    const llmData = context.intentResult.user_data
    
    if (llmData.user_name !== undefined) payload.user_name = llmData.user_name
    if (llmData.gender !== undefined) {
      const normalizedGender = normalizeGender(llmData.gender)
      if (normalizedGender) payload.gender = normalizedGender
    }
    if (llmData.weight_kg !== undefined) payload.weight_kg = llmData.weight_kg
    if (llmData.height_cm !== undefined) payload.height_cm = llmData.height_cm
    if (llmData.age !== undefined) payload.age = llmData.age
    if (llmData.goal_calories !== undefined) payload.goal_calories = llmData.goal_calories
    if (llmData.goal_protein_g !== undefined) payload.goal_protein_g = llmData.goal_protein_g
    
    console.log('✅ Using LLM extracted data:', payload)
  }

  // PRIORIDADE 2: Fallback para regex (apenas se LLM não extraiu o campo)
  // Detectar peso
  if (!payload.weight_kg) {
    const weightMatch = message.match(weightRegex)
    if (weightMatch) {
      const weightValue = weightMatch[1] || weightMatch[2]
      if (weightValue) {
        payload.weight_kg = parseFloat(weightValue.replace(',', '.'))
        console.log('✅ Detected weight from regex fallback:', payload.weight_kg)
      }
    }
  }

  // Detectar altura (suporta cm e metros)
  if (!payload.height_cm) {
    const heightMatch = message.match(heightRegex)
    if (heightMatch) {
      // Verificar se é em metros (1,7m ou 1.70m)
      if (heightMatch[1] || heightMatch[2]) {
        // É em metros
        const metersValue = heightMatch[1] || heightMatch[2]
        const meters = parseFloat(metersValue.replace(',', '.'))
        payload.height_cm = Math.round(meters * 100) // Converter para cm
        console.log('✅ Detected height from regex fallback (meters):', {
          meters,
          cm: payload.height_cm,
        })
      } else {
        // É em cm
        const heightValue = heightMatch[3] || heightMatch[4]
        if (heightValue) {
          payload.height_cm = parseInt(heightValue, 10)
          console.log('✅ Detected height from regex fallback (cm):', payload.height_cm)
        }
      }
    }
  }

  // Detectar idade
  if (!payload.age) {
    const ageMatch = message.match(ageRegex)
    if (ageMatch) {
      const ageValue = ageMatch[1] || ageMatch[2]
      if (ageValue) {
        payload.age = parseInt(ageValue, 10)
        console.log('✅ Detected age from regex fallback:', payload.age)
      }
    }
  }

  // Detectar gênero
  if (!payload.gender) {
    const genderMatch = message.match(genderRegex)
    if (genderMatch) {
      const normalizedGender = normalizeGender(genderMatch[1] || genderMatch[0])
      if (normalizedGender) {
        payload.gender = normalizedGender
        console.log('✅ Detected gender from regex fallback:', payload.gender)
      }
    }
  }

  // Detectar nome
  if (!payload.user_name) {
    const nameMatch = message.match(nameRegex)
    if (nameMatch && nameMatch[1]) {
      payload.user_name = nameMatch[1].trim()
      console.log('✅ Detected name from regex fallback:', payload.user_name)
    }
  }

  // Detectar meta calórica
  if (!payload.goal_calories) {
    const goalMatch = message.match(goalCaloriesRegex)
    if (goalMatch) {
      const goalValue = goalMatch[1] || goalMatch[2]
      if (goalValue) {
        payload.goal_calories = parseInt(goalValue, 10)
        console.log('✅ Detected goal calories from regex fallback:', payload.goal_calories)
      }
    }
  }

  // Detectar meta de proteína
  if (!payload.goal_protein_g) {
    const proteinMatch = message.match(goalProteinRegex)
    if (proteinMatch) {
      const proteinValue = proteinMatch[1] || proteinMatch[2]
      if (proteinValue) {
        payload.goal_protein_g = parseInt(proteinValue, 10)
        console.log('✅ Detected goal protein from regex fallback:', payload.goal_protein_g)
      }
    }
  }

  // Se não detectou nada, retornar mensagem de ajuda
  if (Object.keys(payload).length === 0) {
    const missing = getMissingFields(context.user)
    
    // Se está em onboarding (faltam campos), mostrar campos faltantes
    if (missing.length > 0) {
      return (
        '📝 Vamos terminar seu cadastro.\n' +
        'Me envie (um por mensagem):\n' +
        missing.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
      )
    }
    
    return '📝 Não entendi os novos dados. Envie mensagens como "Peso 82kg", "Altura 175cm" ou "1,75m", "Idade 30 anos", "Gênero masculino", "Meta 2000 kcal" ou "Proteína 150g".\n\n💡 Dica: Você pode enviar múltiplos valores juntos, como "32, 170" (idade e altura).'
  }

  // Atualizar dados no Supabase
  await upsertUserData(context.user.id, payload)

  // Verificar se completou todos os campos obrigatórios
  const updatedUser = {
    ...context.user,
    ...payload,
  }
  const refreshedMissing = getMissingFields(updatedUser)

  // Criar mensagem de confirmação elegante
  const fieldLabels: Record<string, string> = {
    user_name: 'Nome',
    gender: 'Gênero',
    weight_kg: 'Peso',
    height_cm: 'Altura',
    age: 'Idade',
    goal_calories: 'Meta de calorias',
    goal_protein_g: 'Meta de proteína',
  }

  const units: Record<string, string> = {
    weight_kg: 'kg',
    height_cm: 'cm',
    age: 'anos',
    goal_calories: 'kcal/dia',
    goal_protein_g: 'g/dia',
  }

  const confirmationLines = Object.keys(payload).map(field => {
    const label = fieldLabels[field] || field
    const unit = units[field] || ''
    const newValue = payload[field]
    const oldValue = context.user?.[field as keyof UserRecord]

    if (oldValue) {
      return `• ${label}: ${oldValue}${unit} → ${newValue}${unit}`
    }
    return `• ${label}: ${newValue}${unit}`
  })

  let message = `✅ Perfil atualizado!\n\n${confirmationLines.join('\n')}`

  // Se ainda faltam campos
  if (refreshedMissing.length > 0) {
    message += `\n\n⚠️ Ainda faltam:\n${refreshedMissing.map(f => `• ${f}`).join('\n')}`
    message += '\n\nComplete para melhor precisão!'
  } else {
    message += '\n\n✅ Cadastro 100% completo!'
    message += '\n\nAgora é só registrar suas refeições e exercícios. Digite "ajuda" quando quiser rever os comandos.'
  }

  return message.trim()
}
