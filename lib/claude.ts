import Anthropic from '@anthropic-ai/sdk'

/**
 * Processa uma mensagem usando Claude API e retorna uma resposta conversacional
 * @param message Mensagem recebida do usuário
 * @param history Histórico opcional de mensagens anteriores [{role: 'user'|'assistant', content: string}, ...]
 * @returns Resposta gerada pelo Claude ou null em caso de erro
 */
export async function processMessageWithClaude(
  message: string,
  history?: Array<{ role: string; content: string }>
): Promise<string | null> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    // Validação da chave da API
    if (!apiKey) {
      console.error('❌ ANTHROPIC_API_KEY não está configurada')
      return null
    }

    // Inicializar cliente Anthropic
    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    // Construir array de mensagens incluindo histórico se disponível
    let messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    if (history && history.length > 0) {
      // Converter histórico para formato do Claude
      messages = history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))
      console.log('🤖 Processing message with Claude (with history):', {
        messageLength: message.length,
        messagePreview: message.substring(0, 100),
        historyLength: history.length,
        historyRoles: history.map((h) => h.role),
      })
    } else {
      console.log('🤖 Processing message with Claude (no history):', {
        messageLength: message.length,
        messagePreview: message.substring(0, 100),
      })
    }

    // Adicionar mensagem atual ao final
    messages.push({
      role: 'user',
      content: message,
    })

    console.log('📝 Total messages in context:', messages.length)

    // Fazer requisição para Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: 'Você é um bot de WhatsApp. Responda com NO MÁXIMO 1 FRASE CURTA. Seja direto, casual e objetivo. Pense como se fosse um humano respondendo rápido no celular. Nada de explicações longas ou parágrafos. Uma frase, ponto final. Exemplos de respostas boas: 'Azul claro fica legal!', 'Pode ser às 15h?', 'Entendi, vou anotar'. Exemplos de respostas RUINS (não faça): qualquer coisa com mais de 10-15 palavras.',
      messages: messages,
    })

    // Extrair texto da resposta
    const replyText = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')

    console.log('✅ Claude response received:', {
      replyLength: replyText.length,
      replyPreview: replyText.substring(0, 100),
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    })

    return replyText || null
  } catch (error: any) {
    console.error('❌ Error processing message with Claude:', {
      error: error.message,
      errorType: error.type,
      status: error.status,
      statusCode: error.statusCode,
      details: error.error || error,
    })

    return null
  }
}

