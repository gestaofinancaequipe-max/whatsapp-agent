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
      model: 'llama-3.1-70b-versatile',
      messageCount: messages.length,
      totalMessages: messages.length + 1, // +1 para system message
    })

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Bot de WhatsApp. 1 frase curta. Máximo 15 palavras. Casual, direto, rápido. Como humano no celular.',
        },
        ...messages,
      ],
      max_tokens: 150,
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
