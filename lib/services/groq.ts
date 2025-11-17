import Groq from 'groq-sdk'
import axios from 'axios'
import FormData from 'form-data'

// Inicializar cliente Groq
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    console.error('❌ GROQ_API_KEY não está configurada')
    return null
  }

  return new Groq({
    apiKey: apiKey,
  })
}

/**
 * Processa imagem com Groq Vision para análise de refeições
 * @param imageUrl URL da imagem do WhatsApp (com autenticação)
 * @param caption Legenda opcional enviada com a imagem
 * @returns Resposta com análise de calorias ou null em caso de erro
 */
export async function processImageWithGroq(
  imageUrl: string,
  caption?: string
): Promise<string | null> {
  try {
    const groq = getGroqClient()
    if (!groq) {
      throw new Error('Groq client not initialized')
    }

    console.log('📸 Processing image with Groq Vision...', {
      imageUrl: imageUrl.substring(0, 100),
      hasCaption: !!caption,
      captionPreview: caption?.substring(0, 50),
    })

    // 1. Baixar imagem do WhatsApp (Meta API já retorna URL autenticada)
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
    })

    // 2. Converter para base64
    const base64Image = Buffer.from(imageResponse.data).toString('base64')
    const mimeType = imageResponse.headers['content-type'] || 'image/jpeg'

    console.log('✅ Image downloaded and converted:', {
      size: imageResponse.data.length,
      mimeType,
      base64Length: base64Image.length,
    })

    // 3. Construir prompt do usuário (melhorado para incluir caption como contexto)
    const userPrompt = caption
      ? `Analise esta foto de refeição e calcule as calorias e proteínas. O usuário escreveu: "${caption}". Use essa informação como contexto adicional para identificar os alimentos e porções.`
      : 'Analise esta foto de refeição e calcule as calorias e proteínas estimadas de cada alimento visível.'

    // 4. Enviar para Groq Vision
    const response = await groq.chat.completions.create({
      model: 'llama-3.2-90b-vision-preview',
      messages: [
        {
          role: 'system',
          content:
            'Você é um nutricionista assistente especializado em análise visual de refeições. Identifique os alimentos, estime porções e calcule calorias E PROTEÍNAS. Use o formato: lista de alimentos com calorias e proteínas (ex: "Arroz (150g): ~195 kcal | ~4g proteína"), total de calorias, total de proteínas, e breve comentário nutricional. Use emojis. SEMPRE inclua calorias E proteínas.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const reply =
      response.choices[0]?.message?.content ||
      'Desculpe, não consegui analisar a imagem.'

    console.log('✅ Groq Vision response:', {
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
    console.error('❌ Error processing image:', {
      error: error.message,
      status: error.response?.status,
      statusCode: error.statusCode,
      details: error.response?.data || error.error,
    })

    return null
  }
}

/**
 * Transcreve áudio com Groq Whisper
 * @param audioUrl URL do áudio do WhatsApp (com autenticação)
 * @returns Texto transcrito ou string vazia em caso de erro
 */
export async function transcribeAudioWithGroq(
  audioUrl: string
): Promise<string> {
  try {
    console.log('🎤 Transcribing audio with Groq...', {
      audioUrl: audioUrl.substring(0, 100),
    })

    // 1. Baixar áudio do WhatsApp
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
    })

    console.log('✅ Audio downloaded:', {
      size: audioResponse.data.length,
      mimeType: audioResponse.headers['content-type'],
    })

    // 2. Criar FormData para enviar áudio (Groq espera multipart/form-data)
    const FormData = require('form-data')
    const formData = new FormData()

    // Criar buffer do áudio
    const audioBuffer = Buffer.from(audioResponse.data)
    const mimeType =
      audioResponse.headers['content-type'] || 'audio/ogg; codecs=opus'

    // Adicionar arquivo ao form-data
    formData.append('file', audioBuffer, {
      filename: 'audio.ogg',
      contentType: mimeType,
    })
    formData.append('model', 'whisper-large-v3')
    formData.append('language', 'pt') // Português

    // 3. Transcrever com Groq Whisper API
    // Nota: Groq usa OpenAI-compatible API para Whisper
    const groqApiKey = process.env.GROQ_API_KEY
    const transcriptionResponse = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${groqApiKey}`,
        },
      }
    )

    const transcription = transcriptionResponse.data?.text || ''

    console.log('✅ Transcription completed:', {
      text: transcription.substring(0, 100),
      fullLength: transcription.length,
    })

    return transcription
  } catch (error: any) {
    console.error('❌ Error transcribing audio:', {
      error: error.message,
      status: error.response?.status,
      details: error.response?.data || error.error,
    })

    return ''
  }
}

/**
 * Processa mensagem de texto usando Groq LLM (substitui Claude)
 * @param message Texto recebido do usuário
 * @param conversationHistory Histórico opcional de mensagens [{role, content}]
 * @returns Resposta gerada pelo Groq ou mensagem de fallback
 */
export async function processTextWithGroq(
  message: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    console.log('🤖 Processing text with Groq...', {
      messageLength: message.length,
      hasHistory: !!conversationHistory,
      historyLength: conversationHistory?.length || 0,
    })

    const groqApiKey = process.env.GROQ_API_KEY

    if (!groqApiKey) {
      console.error('❌ GROQ_API_KEY not configured')
      return 'Desculpe, configuração pendente. Tente novamente mais tarde.'
    }

    const messages: Array<{ role: string; content: string }> = []

    // System prompt
    messages.push({
      role: 'system',
      content: `Você é um assistente prestativo e amigável via WhatsApp.
Responda de forma concisa e direta.
Use emojis quando apropriado.
Seja educado e útil.`,
    })

    // Histórico
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory)
    }

    // Mensagem atual
    messages.push({
      role: 'user',
      content: message,
    })

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Groq API error:', {
        status: response.status,
        error: errorData,
      })
      return 'Desculpe, tive um problema ao processar. Tente novamente.'
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content

    if (!reply) {
      console.error('❌ No response from Groq')
      return 'Desculpe, não consegui gerar uma resposta.'
    }

    console.log('✅ Groq response generated:', {
      replyLength: reply.length,
      tokensUsed: data.usage?.total_tokens || 'unknown',
    })

    return reply.trim()
  } catch (error: any) {
    console.error('❌ Error in processTextWithGroq:', {
      error: error.message,
      stack: error.stack,
    })
    return 'Desculpe, tive um erro ao processar. Tente novamente.'
  }
}

