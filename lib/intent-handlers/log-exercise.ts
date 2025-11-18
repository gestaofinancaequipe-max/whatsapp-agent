import { IntentContext } from '@/lib/intent-handlers/types'
import { logFoodFallback } from '@/lib/services/fallback-log'
import { encodeTempData, TemporaryExerciseData } from '@/lib/utils/temp-data'
import { processExerciseCascade } from '@/lib/processors/exercise-item-processor'

const DEFAULT_WEIGHT_KG = 70

export async function handleLogExerciseIntent(
  context: IntentContext
): Promise<string> {
  const { intentResult, user, conversationId, messageText } = context

  if (!user?.id) {
    return '⚠️ Preciso do seu cadastro para registrar exercícios. Digite "ajuda" para começar.'
  }

  if (!user.weight_kg) {
    return '⚖️ Para calcular calorias queimadas preciso do seu peso atual. Envie algo como "Peso 82kg" e depois tente registrar o exercício novamente.'
  }

  // Verificar se temos items extraídos do intent
  // FALLBACK: Se não extraiu, tentar extrair exercício e duração da mensagem
  let exerciseItems = intentResult.items || []
  
  if (exerciseItems.length === 0) {
    // Primeiro, tentar extrair duração da mensagem original
    const durationRegex = /(\d+(?:\.\d+)?)\s*(?:minutos?|min|hora|horas?|h)/i
    const durationMatch = messageText.match(durationRegex)
    let extractedDuration: string | null = null
    
    if (durationMatch) {
      extractedDuration = durationMatch[1] + ' ' + (durationMatch[0].includes('hora') || durationMatch[0].includes('h') ? 'hora' : 'min')
      console.log('🔄 Fallback: Extracted duration from message:', extractedDuration)
    }
    
    // Agora limpar mensagem para pegar exercício
    const cleanedMessage = messageText
      .trim()
      .toLowerCase()
      // Remover duração extraída
      .replace(durationRegex, '')
      // Remover palavras irrelevantes
      .replace(/\b(fiz|fazer|pratiquei|na|no|do|da|de)\b/gi, '')
      .trim()
    
    if (cleanedMessage && cleanedMessage.length >= 3) {
      console.log('🔄 Fallback: Using message text as exercise name:', {
        exercise: cleanedMessage,
        duration: extractedDuration,
      })
      exerciseItems = [{ exercicio: cleanedMessage, duracao: extractedDuration }]
    } else if (extractedDuration) {
      // Se só tem duração (sem exercício), o LLM deveria ter extraído do contexto
      // Mas se não extraiu, vamos retornar erro pedindo o exercício
      return '🤔 Identifiquei a duração, mas não consegui identificar o exercício. Pode descrever o que fez?'
    } else {
      return '🤔 Não consegui identificar o exercício. Pode descrever o que fez?'
    }
  }

  console.log('💪 Processing exercise items:', exerciseItems)

  // Obter peso do usuário (necessário para cálculo de calorias)
  const userWeight = user.weight_kg || DEFAULT_WEIGHT_KG

  // Processar cada dupla (exercicio, duracao)
  const processedItems: Array<any> = []
  const failedItems: Array<string> = []
  const itemsNeedingDuration: Array<any> = [] // Exercícios encontrados mas sem duração
  const itemCache = new Map<string, any>() // Cache local para esta sessão

  for (const item of exerciseItems) {
    if (!item.exercicio) continue

    // Limpar nome do exercício: remover números que podem ter sido extraídos incorretamente
    let exerciseName = item.exercicio.trim()
    // Remover números no início ou seguidos de espaço (ex: "25 cross-fit" → "cross-fit")
    exerciseName = exerciseName.replace(/^\d+\s+/, '').trim()
    // Remover números no final (ex: "cross-fit 25" → "cross-fit")
    exerciseName = exerciseName.replace(/\s+\d+$/, '').trim()
    
    console.log('🧹 Cleaned exercise name:', {
      original: item.exercicio,
      cleaned: exerciseName,
    })

    const processed = await processExerciseCascade(
      exerciseName,
      item.duracao || null,
      user.id,
      userWeight,
      itemCache
    )

    if (processed) {
      // Se precisa de duração, adicionar à lista de itens que precisam
      if (processed.needsDuration) {
        itemsNeedingDuration.push(processed)
        console.log('⏳ Exercise found but needs duration:', {
          exercise: processed.exercise.exercise_name,
        })
      } else {
        processedItems.push(processed)
        console.log('✅ Exercise processed:', {
          exercise: processed.exercise.exercise_name,
          duration: `${processed.duration} min`,
          intensity: processed.intensity,
          caloriesBurned: processed.caloriesBurned?.toFixed(0),
          method: processed.method,
        })
      }

      // Log fallback para exercícios não encontrados (se necessário)
      if (processed.method === 'llm' && processed.exercise) {
        await logFoodFallback({
          query: item.exercicio,
          phoneNumber: user.phone_number || 'unknown',
        })
      }
    } else {
      failedItems.push(exerciseName)
      await logFoodFallback({
        query: exerciseName,
        phoneNumber: user.phone_number || 'unknown',
      })
    }
  }

  // Se há exercícios que precisam de duração, perguntar
  if (itemsNeedingDuration.length > 0) {
    const exerciseNames = itemsNeedingDuration.map(p => p.exercise.exercise_name).join(', ')
    return `✅ Identifiquei: ${exerciseNames}\n\n⏱️ Quanto tempo você fez? (ex: "30 minutos", "1 hora", "45 min")`
  }

  if (processedItems.length === 0) {
    return `🤔 Não consegui processar: ${failedItems.join(', ')}`
  }

  // Somar totais
  // Nota: processedItems só contém itens com duração (sem needsDuration), então duration e caloriesBurned não são null
  const totalDuration = processedItems.reduce((sum, i) => sum + (i.duration || 0), 0)
  const totalCalories = processedItems.reduce((sum, i) => sum + (i.caloriesBurned || 0), 0)

  // Montar mensagem
  const visibleMessage =
    processedItems.length === 1
      ? `💪 ${processedItems[0].duration} min de ${processedItems[0].exercise.exercise_name}
- Calorias queimadas: ~${processedItems[0].caloriesBurned.toFixed(0)} kcal
- Intensidade: ${processedItems[0].intensity}
- MET: ${processedItems[0].metValue.toFixed(1)}
- Peso considerado: ${userWeight} kg

Confirma? 1️⃣ Sim | 2️⃣ Corrigir`
      : `💪 Treino (${totalDuration} min)
${processedItems
  .map(
    (item) =>
      `• ${item.duration} min de ${item.exercise.exercise_name}: ~${item.caloriesBurned.toFixed(0)} kcal`
  )
  .join('\n')}

📊 TOTAL:
- Duração: ${totalDuration} min
- Calorias queimadas: ~${totalCalories.toFixed(0)} kcal
- Peso considerado: ${userWeight} kg

Confirma? 1️⃣ Sim | 2️⃣ Corrigir`

  // Encode tempData
  const tempData: TemporaryExerciseData = {
    type: 'exercise',
    timestamp: new Date().toISOString(),
    userId: user.id,
    data:
      processedItems.length === 1
        ? {
            description: `${processedItems[0].duration} min de ${processedItems[0].exercise.exercise_name}`,
            exerciseType: processedItems[0].exercise.exercise_name,
            durationMinutes: processedItems[0].duration,
            intensity: processedItems[0].intensity,
            metValue: processedItems[0].metValue,
            caloriesBurned: processedItems[0].caloriesBurned,
          }
        : {
            description: processedItems
              .map((i) => `${i.duration} min de ${i.exercise.exercise_name}`)
              .join(', '),
            exerciseType: 'múltiplos',
            durationMinutes: totalDuration,
            intensity: 'moderate',
            metValue:
              processedItems.reduce((sum, i) => sum + i.metValue, 0) / processedItems.length,
            caloriesBurned: totalCalories,
          },
  }

  return `${visibleMessage}${encodeTempData(tempData)}`
}

