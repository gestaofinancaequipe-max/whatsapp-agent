import Groq from 'groq-sdk'

/**
 * Processa uma mensagem usando Groq API e retorna uma resposta conversacional
 * @param message Mensagem recebida do usuário
 * @param history Histórico opcional de mensagens anteriores [{role: 'user'|'assistant', content: string}, ...]
 * @returns Resposta gerada pelo Groq ou null em caso de erro
 */
export async function processMessageWithClaude(
  message: string,
  history?: Array<{ role: string; content: string }>
): Promise<string | null> {
  try {
    const apiKey = process.env.GROQ_API_KEY

    // Validação da chave da API
    if (!apiKey) {
      console.error('❌ GROQ_API_KEY não está configurada')
      return null
    }

    // Inicializar cliente Groq
    const groq = new Groq({
      apiKey: apiKey,
    })

    console.log('🤖 Processing with Groq...', {
      messageLength: message.length,
      messagePreview: message.substring(0, 100),
      historyLength: history?.length || 0,
      historyRoles: history?.map((h) => h.role),
    })

    // Construir array de mensagens
    const messages: Array<{
      role: 'user' | 'assistant' | 'system'
      content: string
    }> = []

    // Adicionar histórico se existir
    if (history && history.length > 0) {
      history.forEach((msg) => {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
      })
    }

    // Adicionar mensagem atual
    messages.push({
      role: 'user',
      content: message,
    })

    console.log('📨 Sending to Groq:', {
      model: 'llama-3.3-70b-versatile',
      messageCount: messages.length,
      totalMessages: messages.length + 1, // +1 para system message
    })

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Você é um nutricionista assistente no WhatsApp especializado em calcular calorias e proteínas.\n\nFORMATO DA RESPOSTA:\n1. Lista dos alimentos com calorias e proteínas individuais\n2. Total de calorias\n3. Total de proteínas\n4. Breve comentário nutricional (1-2 frases)\n\nEXEMPLO:\n🍽️ Sua refeição:\n- Arroz (150g): ~195 kcal | ~4g proteína\n- Frango (120g): ~198 kcal | ~37g proteína\n- Salada: ~50 kcal | ~2g proteína\n\n📊 Total: ~443 kcal | ~43g proteína\n\n💡 Boa quantidade de proteína! Refeição equilibrada.\n\nREGRAS:\n- Use emojis\n- Seja encorajador\n- Estimativas se não souber porção\n- Respostas de 3-5 linhas OK\n- Avise que são estimativas\n- SEMPRE inclua calorias E proteínas',
        },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const reply =
      response.choices[0]?.message?.content || 'Desculpe, não entendi.'

    console.log('✅ Groq response received:', {
      replyLength: reply.length,
      replyPreview: reply.substring(0, 100),
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    })

    return reply
  } catch (error: any) {
    console.error('❌ Error calling Groq API:', {
      error: error.message,
      status: error.status,
      statusCode: error.statusCode,
      details: error.error || error,
    })

    return null
  }
}
