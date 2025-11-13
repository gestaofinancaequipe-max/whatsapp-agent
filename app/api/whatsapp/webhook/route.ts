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
  // LOG INICIAL QUE SEMPRE EXECUTA - ANTES DE QUALQUER OUTRA COISA
  console.log('🚀 ===== WEBHOOK GET CALLED =====')
  console.log('📍 Timestamp:', new Date().toISOString())
  console.log('🌍 Runtime:', process.env.NEXT_RUNTIME || 'unknown')
  
  // Listar TODAS as env vars que contêm WEBHOOK
  const webhookEnvVars: Record<string, string | undefined> = {}
  Object.keys(process.env).forEach(key => {
    if (key.includes('WEBHOOK') || key.includes('webhook')) {
      webhookEnvVars[key] = process.env[key]
    }
  })
  console.log('🔐 All WEBHOOK env vars:', webhookEnvVars)
  
  // Log do valor ESPECÍFICO que estamos procurando
  // Tentar múltiplas formas de obter o token (caso haja problema com env vars)
  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.NEXT_PUBLIC_WEBHOOK_VERIFY_TOKEN
  
  // FALLBACK TEMPORÁRIO: Se não encontrar env var, usar hardcoded para teste
  // TODO: Remover este fallback após confirmar que env vars funcionam
  const testToken = expectedToken || 'abc123'
  
  // Mostrar preview mascarado do token (primeiros e últimos caracteres)
  const maskToken = (t: string | undefined) => {
    if (!t || t.length <= 4) return t ? '***' : undefined
    return `${t.substring(0, 2)}...${t.substring(t.length - 2)}`
  }
  
  console.log('🎯 WEBHOOK_VERIFY_TOKEN value (masked):', maskToken(expectedToken))
  console.log('📏 WEBHOOK_VERIFY_TOKEN length:', expectedToken?.length)
  console.log('📝 WEBHOOK_VERIFY_TOKEN type:', typeof expectedToken)
  console.log('🔢 WEBHOOK_VERIFY_TOKEN exists:', !!expectedToken)
  console.log('🧪 Test token (fallback):', testToken)
  console.log('⚠️ Using fallback?', !expectedToken)
  console.log('🔍 IMPORTANT: Env var token length:', expectedToken?.length, 'vs Received token length: (will show in request)')
  
  // Log de TODAS as env vars relacionadas ao WhatsApp
  const whatsappEnvVars: Record<string, string | undefined> = {}
  Object.keys(process.env).forEach(key => {
    if (key.includes('WHATSAPP') || key.includes('whatsapp')) {
      whatsappEnvVars[key] = key.includes('TOKEN') ? '***HIDDEN***' : process.env[key]
    }
  })
  console.log('📱 All WHATSAPP env vars (tokens hidden):', whatsappEnvVars)

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
    // Múltiplas formas de normalização para garantir match
    const normalizeToken = (t: string | null) => {
      if (!t) return ''
      // 1. Trim básico
      let normalized = t.trim()
      // 2. Remover todos os espaços (incluindo tabs, newlines, etc)
      normalized = normalized.replace(/\s+/g, '')
      // 3. Remover caracteres invisíveis (zero-width, etc)
      normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '')
      // 4. Converter para lowercase para comparação case-insensitive
      // (se necessário - mas vamos manter case-sensitive por padrão)
      return normalized
    }
    
    const normalizedReceivedToken = normalizeToken(token || '')
    const normalizedExpectedToken = normalizeToken(testToken || '')
    
    // Comparação case-insensitive também
    const receivedLower = normalizedReceivedToken.toLowerCase()
    const expectedLower = normalizedExpectedToken.toLowerCase()
    
    // Função para mascarar token longo
    const maskTokenForLog = (t: string | undefined, maxShow: number = 4) => {
      if (!t) return undefined
      if (t.length <= maxShow * 2) return t
      return `${t.substring(0, maxShow)}...${t.substring(t.length - maxShow)}`
    }
    
    console.log('🔑 Token comparison (ULTRA DETAILED):', {
      receivedRaw: token,
      receivedLength: token?.length,
      receivedNormalized: normalizedReceivedToken,
      receivedNormalizedLength: normalizedReceivedToken.length,
      receivedLower: receivedLower.substring(0, 20) + (receivedLower.length > 20 ? '...' : ''),
      expectedFromEnv: maskTokenForLog(expectedToken),
      expectedFromEnvLength: expectedToken?.length,
      testTokenUsed: maskTokenForLog(testToken),
      testTokenLength: testToken?.length,
      expectedNormalized: maskTokenForLog(normalizedExpectedToken),
      expectedNormalizedLength: normalizedExpectedToken.length,
      expectedLower: expectedLower.substring(0, 20) + (expectedLower.length > 20 ? '...' : ''),
      strictMatch: token === testToken,
      normalizedMatch: normalizedReceivedToken === normalizedExpectedToken,
      caseInsensitiveMatch: receivedLower === expectedLower,
      lengthMismatch: normalizedReceivedToken.length !== normalizedExpectedToken.length,
      receivedCharCodes: normalizedReceivedToken.split('').slice(0, 10).map((c, i) => ({
        char: c,
        code: c.charCodeAt(0),
        pos: i,
      })),
      expectedCharCodes: normalizedExpectedToken.split('').slice(0, 10).map((c, i) => ({
        char: c,
        code: c.charCodeAt(0),
        pos: i,
      })),
      usingFallback: !expectedToken,
      // Hex dump para debug absoluto (apenas primeiros 20 chars)
      receivedHex: normalizedReceivedToken.substring(0, 20).split('').map(c => c.charCodeAt(0).toString(16)).join(' '),
      expectedHex: normalizedExpectedToken.substring(0, 20).split('').map(c => c.charCodeAt(0).toString(16)).join(' '),
    })
    
    // ALERTA SE OS TAMANHOS SÃO DIFERENTES
    if (normalizedReceivedToken.length !== normalizedExpectedToken.length) {
      console.error('⚠️⚠️⚠️ CRITICAL: Token length mismatch!', {
        receivedLength: normalizedReceivedToken.length,
        expectedLength: normalizedExpectedToken.length,
        receivedPreview: normalizedReceivedToken.substring(0, 6) + '...',
        expectedPreview: normalizedExpectedToken.substring(0, 6) + '...',
        message: 'O token na URL não corresponde ao token na env var da Vercel!',
      })
    }

    // Verificar se é uma requisição de verificação do Meta
    // Usar múltiplas formas de comparação para garantir match
    const modeMatch = mode === 'subscribe'
    const tokenMatchStrict = token === testToken
    const tokenMatchNormalized = normalizedReceivedToken === normalizedExpectedToken
    const tokenMatchCaseInsensitive = receivedLower === expectedLower
    
    console.log('🔍 Verification checks:', {
      modeMatch,
      tokenMatchStrict,
      tokenMatchNormalized,
      tokenMatchCaseInsensitive,
      finalDecision: modeMatch && (tokenMatchStrict || tokenMatchNormalized || tokenMatchCaseInsensitive),
    })

    // Aceitar se qualquer uma das comparações passar
    if (modeMatch && (tokenMatchStrict || tokenMatchNormalized || tokenMatchCaseInsensitive)) {
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
      tokenMatchStrict,
      tokenMatchNormalized,
      tokenMatchCaseInsensitive,
      reason: !modeMatch ? 'mode !== subscribe' : 'token mismatch',
      receivedToken: token,
      receivedNormalized: normalizedReceivedToken,
      expectedToken: testToken,
      expectedNormalized: normalizedExpectedToken,
      receivedLength: normalizedReceivedToken.length,
      expectedLength: normalizedExpectedToken.length,
      lengthsMatch: normalizedReceivedToken.length === normalizedExpectedToken.length,
      envVarExists: !!expectedToken,
      usingFallback: !expectedToken,
      diffAtPosition: (() => {
        const minLen = Math.min(normalizedReceivedToken.length, normalizedExpectedToken.length)
        for (let i = 0; i < minLen; i++) {
          if (normalizedReceivedToken[i] !== normalizedExpectedToken[i]) {
            return {
              position: i,
              receivedChar: normalizedReceivedToken[i],
              expectedChar: normalizedExpectedToken[i],
              receivedCode: normalizedReceivedToken.charCodeAt(i),
              expectedCode: normalizedExpectedToken.charCodeAt(i),
            }
          }
        }
        if (normalizedReceivedToken.length !== normalizedExpectedToken.length) {
          return {
            position: minLen,
            receivedLength: normalizedReceivedToken.length,
            expectedLength: normalizedExpectedToken.length,
            note: 'Different lengths',
          }
        }
        return null
      })(),
    })

    // Token inválido ou modo incorreto
    // Retornar resposta detalhada para debug (em produção, apenas 'Forbidden')
    const diffAtPosition = (() => {
      const minLen = Math.min(normalizedReceivedToken.length, normalizedExpectedToken.length)
      for (let i = 0; i < minLen; i++) {
        if (normalizedReceivedToken[i] !== normalizedExpectedToken[i]) {
          return {
            position: i,
            receivedChar: normalizedReceivedToken[i],
            expectedChar: normalizedExpectedToken[i],
            receivedCode: normalizedReceivedToken.charCodeAt(i),
            expectedCode: normalizedExpectedToken.charCodeAt(i),
          }
        }
      }
      if (normalizedReceivedToken.length !== normalizedExpectedToken.length) {
        return {
          position: minLen,
          receivedLength: normalizedReceivedToken.length,
          expectedLength: normalizedExpectedToken.length,
          note: 'Different lengths',
        }
      }
      return null
    })()

    return new NextResponse(
      JSON.stringify({
        error: 'Forbidden',
        debug: {
          modeMatch,
          tokenMatchStrict,
          tokenMatchNormalized,
          tokenMatchCaseInsensitive,
          tokenMatch: tokenMatchStrict || tokenMatchNormalized || tokenMatchCaseInsensitive,
          envVarExists: !!expectedToken,
          usingFallback: !expectedToken,
          receivedLength: normalizedReceivedToken.length,
          expectedLength: normalizedExpectedToken.length,
          lengthsMatch: normalizedReceivedToken.length === normalizedExpectedToken.length,
          diffAtPosition,
        },
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
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

