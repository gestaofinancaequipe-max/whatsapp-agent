import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, sendWhatsAppMessage } from '@/lib/whatsapp'

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
 * OUTRAS SOLUÇÕES POSSÍVEIS SE O PROBLEMA PERSISTIR:
 * 
 * 1. VERIFICAR NA VERCEL:
 *    - Settings > Environment Variables
 *    - Garantir que WEBHOOK_VERIFY_TOKEN está definido para TODOS os ambientes (Production, Preview, Development)
 *    - Redeploy APÓS adicionar/editar variável (não é automático)
 * 
 * 2. TESTAR COM HARDCODED (temporariamente):
 *    - Substituir expectedToken por 'abc123' diretamente para verificar se o problema é com env vars
 * 
 * 3. VERIFICAR ENCODING:
 *    - Se o token contém caracteres especiais, pode haver problema de encoding
 *    - Tente usar apenas letras e números no token
 * 
 * 4. VERIFICAR NEXT_PUBLIC_ prefix:
 *    - Para API routes, NÃO precisa de NEXT_PUBLIC_
 *    - Mas pode tentar criar WEBHOOK_VERIFY_TOKEN E NEXT_PUBLIC_WEBHOOK_VERIFY_TOKEN
 * 
 * 5. CACHE DA VERCEL:
 *    - Fazer "Redeploy" completo (não apenas "Redeploy" do último commit)
 *    - Ou criar um novo deploy (push novo commit)
 * 
 * 6. VERIFICAR SE O ROUTE ESTÁ SENDO CHAMADO:
 *    - Os logs iniciais (🚀 ===== WEBHOOK GET CALLED =====) devem aparecer SEMPRE
 *    - Se não aparecerem, o problema pode ser rota/cache
 * 
 * 7. TESTAR LOCALMENTE:
 *    - Criar .env.local com WEBHOOK_VERIFY_TOKEN=abc123
 *    - Testar com: http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=abc123&hub.challenge=test123
 *    - Se funcionar localmente mas não na Vercel, é problema de env vars na Vercel
 * 
 * 8. ALTERNATIVA: Usar Edge Runtime com env vars públicas:
 *    - Se Node.js runtime não funcionar, pode tentar Edge Runtime
 *    - Mas precisa usar NEXT_PUBLIC_ prefix (menos seguro)
 */

/**
 * POST - Receber mensagens do WhatsApp via webhook
 * O Meta envia notificações quando há mensagens recebidas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('📨 Webhook POST received:', {
      hasEntry: !!body.entry,
      entryLength: body.entry?.length,
      timestamp: new Date().toISOString(),
    })

    // Extrair a mensagem do payload
    const message = extractMessage(body)

    if (!message) {
      console.log('⚠️ No valid message extracted, returning 200 to prevent retries')
      return NextResponse.json({ success: true }, { status: 200 })
    }

    // Log da mensagem recebida
    console.log('💬 Message received:', {
      from: message.from,
      type: message.type,
      text: message.text?.body?.substring(0, 100),
      timestamp: message.timestamp,
    })

    // Processar apenas mensagens de texto
    if (message.type === 'text' && message.text?.body) {
      const senderPhone = message.from
      const receivedText = message.text.body

      console.log('📝 Processing text message:', {
        from: senderPhone,
        text: receivedText.substring(0, 50),
      })

      // Enviar resposta automática
      const replyMessage = `✅ Mensagem recebida!\n\nVocê disse: "${receivedText}"\n\nEm breve terei mais funcionalidades! 🚀`

      const sendResult = await sendWhatsAppMessage(senderPhone, replyMessage)

      if (sendResult) {
        console.log('✅ Auto-reply sent successfully')
      } else {
        console.error('❌ Failed to send auto-reply')
      }
    } else {
      console.log('ℹ️ Non-text message received, skipping auto-reply:', {
        type: message.type,
      })
    }

    // Sempre retornar 200 OK para o Meta não retentar a requisição
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error processing webhook:', {
      error: error.message,
      stack: error.stack,
    })

    // Mesmo com erro, retornar 200 para evitar retries infinitos
    // Mas logar o erro para debug
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 200 }
    )
  }
}

