import { NextRequest, NextResponse } from 'next/server'
import { extractMessage } from '@/lib/whatsapp'
import {
  handleAudioMessage,
  handleImageMessage,
  handleTextMessage,
} from '@/lib/handlers'
import {
  isAudioMessage,
  isImageMessage,
  isTextMessage,
} from '@/lib/types/WhatsAppMessage'

// Forçar runtime Node.js para garantir acesso às variáveis de ambiente
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET - Verificação do webhook pelo Meta 
 * Meta envia um desafio (challenge) que precisa ser retornado para verificar o webhook --
 */
export async function GET(request: NextRequest) {
  // Obter token da variável de ambiente
  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.NEXT_PUBLIC_WEBHOOK_VERIFY_TOKEN
  
  if (!expectedToken) {
    console.error('❌ WEBHOOK_VERIFY_TOKEN não está configurado!')
    return new NextResponse('Server Configuration Error', { status: 500 })
  }
  
  console.log('🔍 Webhook verification request received')

  try {
    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    console.log('🔍 Webhook verification request:', {
      mode,
      token: token ? '***' : null,
      tokenLength: token?.length,
      challenge,
      searchParamsKeys: Array.from(searchParams.keys()),
    })

    // Normalizar tokens para comparação (trim whitespace, remover caracteres invisíveis)
    const normalizeToken = (t: string | null) => {
      if (!t) return ''
      let normalized = t.trim()
      normalized = normalized.replace(/\s+/g, '') // Remover todos os espaços
      normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '') // Remover caracteres invisíveis
      return normalized
    }
    
    const normalizedReceivedToken = normalizeToken(token || '')
    const normalizedExpectedToken = normalizeToken(expectedToken || '')
    
    console.log('🔑 Token verification:', {
      receivedLength: normalizedReceivedToken.length,
      expectedLength: normalizedExpectedToken.length,
      match: normalizedReceivedToken === normalizedExpectedToken,
    })

    // Verificar se é uma requisição de verificação do Meta
    const modeMatch = mode === 'subscribe'
    const tokenMatch = normalizedReceivedToken === normalizedExpectedToken
    
    if (modeMatch && tokenMatch) {
      console.log('✅ Webhook verified successfully!')
      console.log('📤 Returning challenge to Meta:', challenge)
      
      // Retornar o challenge para o Meta
      return new NextResponse(challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    console.log('❌ Webhook verification failed:', {
      modeMatch,
      mode,
      tokenMatch,
      reason: !modeMatch ? 'mode !== subscribe' : 'token mismatch',
    })

    // Token inválido ou modo incorreto
    return new NextResponse('Forbidden', { status: 403 })
  } catch (error: any) {
    console.error('❌ Error in webhook verification:', {
      error: error.message,
      stack: error.stack,
      expectedToken: expectedToken,
      envVarsAvailable: Object.keys(process.env).filter(k => k.includes('WEBHOOK')),
    })
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

/**
 * Valida credenciais do WhatsApp
 * @returns Objeto com hasCredentials e whatsappToken
 */
function validateWhatsAppCredentials() {
  const whatsappToken = process.env.WHATSAPP_TOKEN
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const hasCredentials = !!(whatsappToken && whatsappPhoneNumberId)

  if (!hasCredentials) {
    console.error('⚠️ WhatsApp credentials not configured')
  } else {
    console.log('✅ WhatsApp credentials configured')
  }

  return { hasCredentials, whatsappToken }
}

/**
 * Roteia mensagem para handler apropriado baseado no tipo
 */
async function routeMessageByType(
  message: any,
  senderPhone: string,
  hasCredentials: boolean,
  whatsappToken: string | undefined,
  apiVersion: string
) {
  if (isImageMessage(message)) {
    if (!hasCredentials || !whatsappToken) {
      console.error('❌ Cannot process image: credentials missing')
      return
    }

    await handleImageMessage({
      senderPhone,
      imageId: message.image.id,
      caption: message.image.caption,
      whatsappToken,
      apiVersion,
    })
    return
  }

  if (isAudioMessage(message)) {
    if (!hasCredentials || !whatsappToken) {
      console.error('❌ Cannot process audio: credentials missing')
      return
    }

    await handleAudioMessage({
      senderPhone,
      audioId: message.audio.id,
      whatsappToken,
      apiVersion,
    })
    return
  }

  if (isTextMessage(message) && message.text?.body) {
    if (!hasCredentials || !whatsappToken) {
      console.error('❌ Cannot process text: credentials missing')
      return
    }

    await handleTextMessage({
      senderPhone,
      text: message.text.body,
    })
    return
  }

  console.log('ℹ️ Unsupported message type:', message.type)
}

/**
 * POST - Receber mensagens do WhatsApp via webhook
 */
export async function POST(request: NextRequest) {
  const { hasCredentials, whatsappToken } = validateWhatsAppCredentials()

  try {
    const body = await request.json()
    console.log('📨 Webhook POST received')

    const message = extractMessage(body)

    if (!message) {
      console.log('⚠️ No valid message extracted (likely status update)')
      return NextResponse.json({ success: true }, { status: 200 })
    }

    console.log('💬 Message received:', {
      from: message.from,
      type: message.type,
    })

    const senderPhone = message.from
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0'

    try {
      await routeMessageByType(
        message,
        senderPhone,
        hasCredentials,
        whatsappToken,
        apiVersion
      )
    } catch (handlerError: any) {
      console.error('❌ Handler error:', {
        error: handlerError.message,
        senderPhone,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error processing webhook:', {
      error: error.message,
    })

    // Sempre retornar 200 para evitar retries infinitos
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 200 }
    )
  }
}

