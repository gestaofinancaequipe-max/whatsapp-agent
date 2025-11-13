import Anthropic from '@anthropic-ai/sdk'

/**
 * Processa uma mensagem usando Claude API e retorna uma resposta conversacional
 * @param message Mensagem recebida do usuário
 * @returns Resposta gerada pelo Claude ou null em caso de erro
 */
export async function processMessageWithClaude(
  message: string
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

    console.log('🤖 Processing message with Claude:', {
      messageLength: message.length,
      messagePreview: message.substring(0, 100),
    })

    // Fazer requisição para Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'Você é um assistente conversacional amigável no WhatsApp. Responda de forma natural, casual e em português brasileiro. Seja breve e objetivo.',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
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

