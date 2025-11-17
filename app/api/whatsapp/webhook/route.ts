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
  console.log('🔀 routeMessageByType called:', {
    messageType: message.type,
    senderPhone,
    hasCredentials,
    hasToken: !!whatsappToken,
  })

  if (isImageMessage(message)) {
    console.log('📸 Routing to image handler')
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
    console.log('🎤 Routing to audio handler')
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
    console.log('💬 Routing to text handler:', {
      textPreview: message.text.body.substring(0, 50),
    })
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
  // LOG INICIAL ABSOLUTO - deve aparecer SEMPRE
  console.log('🚀 ===== WEBHOOK POST CALLED =====')
  console.log('🚀 Timestamp:', new Date().toISOString())
  console.log('🚀 URL:', request.url)
  console.log('🚀 Method:', request.method)

  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`

  console.log('📨 Webhook POST received:', {
    requestId,
    timestamp: new Date().toISOString(),
    path: '/api/whatsapp/webhook',
  })

  const { hasCredentials, whatsappToken } = validateWhatsAppCredentials()

  try {
    console.log('🔍 Starting to parse body...', { requestId })
    const parseStart = Date.now()
    const body = await request.json()
    console.log('✅ Body parsed:', {
      requestId,
      parseTime: Date.now() - parseStart,
      hasEntry: !!body.entry,
      entryLength: body.entry?.length,
      bodyType: typeof body,
      bodyKeys: body ? Object.keys(body) : [],
    })

    console.log('🔍 Extracting message from body...', { requestId })
    const extractStart = Date.now()
    const message = extractMessage(body)
    console.log('✅ Message extracted:', {
      requestId,
      extractTime: Date.now() - extractStart,
      hasMessage: !!message,
      messageType: message?.type,
      messageFrom: message?.from,
      messageId: message?.id,
    })

    // Log detalhado se não há mensagem
    if (!message) {
      console.log('⚠️ DETAILED - No message extracted:', {
        requestId,
        bodyStructure: {
          hasObject: typeof body === 'object',
          hasEntry: !!body.entry,
          entryLength: body.entry?.length,
          firstEntryId: body.entry?.[0]?.id,
          firstChangeField: body.entry?.[0]?.changes?.[0]?.field,
          hasMessages: !!body.entry?.[0]?.changes?.[0]?.value?.messages,
          hasStatuses: !!body.entry?.[0]?.changes?.[0]?.value?.statuses,
          messagesCount: body.entry?.[0]?.changes?.[0]?.value?.messages?.length || 0,
          statusesCount: body.entry?.[0]?.changes?.[0]?.value?.statuses?.length || 0,
        },
      })
    }

    if (!message) {
      console.log('⚠️ No valid message extracted (likely status update):', {
        requestId,
        bodyKeys: Object.keys(body),
      })
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const textPreview = isTextMessage(message) && message.text
      ? message.text.body.substring(0, 100)
      : undefined

    console.log('💬 Processing message:', {
      requestId,
      from: message.from,
      type: message.type,
      textPreview,
      timestamp: message.timestamp,
    })

    const senderPhone = message.from
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0'

    console.log('🔍 Routing message to handler...', {
      requestId,
      senderPhone,
      messageType: message.type,
    })

    const handlerStart = Date.now()
    try {
      await routeMessageByType(
        message,
        senderPhone,
        hasCredentials,
        whatsappToken,
        apiVersion
      )
      console.log('✅ Handler completed:', {
        requestId,
        handlerTime: Date.now() - handlerStart,
        totalTime: Date.now() - startTime,
      })
    } catch (handlerError: any) {
      console.error('❌ Handler error:', {
        requestId,
        error: handlerError.message,
        stack: handlerError.stack,
        senderPhone,
        handlerTime: Date.now() - handlerStart,
        totalTime: Date.now() - startTime,
      })
      // Log mais detalhado do erro
      console.error('❌ Handler error details:', {
        requestId,
        errorName: handlerError.name,
        errorMessage: handlerError.message,
        errorStack: handlerError.stack?.substring(0, 500),
      })
    }

    console.log('✅ ===== WEBHOOK POST FINISHED =====', {
      requestId,
      totalTime: Date.now() - startTime,
    })

    const responseTime = Date.now() - startTime
    console.log('✅ Returning 200 OK:', {
      requestId,
      totalTime: responseTime,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('❌ ===== WEBHOOK POST ERROR =====')
    console.error('❌ Error processing webhook:', {
      requestId,
      error: error.message,
      errorName: error.name,
      stack: error.stack?.substring(0, 1000),
      totalTime: Date.now() - startTime,
    })

    // Sempre retornar 200 para evitar retries infinitos
    console.log('✅ Returning 200 OK despite error (to prevent retries)')
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 200 }
    )
  }
}

