import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, sendWhatsAppMessage } from '@/lib/whatsapp'
import { processMessageWithClaude } from '@/lib/claude'
import {
  getOrCreateConversation,
  getConversationHistory,
  saveMessage,
} from '@/lib/supabase'
import {
  processImageWithGroq,
  transcribeAudioWithGroq,
} from '@/lib/groq-vision'

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
  // Validação prévia das variáveis de ambiente necessárias para envio de mensagens
  const whatsappToken = process.env.WHATSAPP_TOKEN
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  
  const hasCredentials = !!(whatsappToken && whatsappPhoneNumberId)
  
  if (!hasCredentials) {
    console.error('⚠️ WhatsApp credentials not configured for sending messages:', {
      WHATSAPP_TOKEN: !!whatsappToken,
      WHATSAPP_PHONE_NUMBER_ID: !!whatsappPhoneNumberId,
      note: 'Webhook will receive messages but cannot send auto-replies',
    })
  } else {
    console.log('✅ WhatsApp credentials configured:', {
      phoneNumberId: whatsappPhoneNumberId,
      tokenLength: whatsappToken.length,
    })
  }

  try {
    const body = await request.json()

    console.log('📨 Webhook POST received:', {
      hasEntry: !!body.entry,
      entryLength: body.entry?.length,
      timestamp: new Date().toISOString(),
      hasCredentials,
    })

    // Log detalhado do payload completo para debug
    console.log('🔍 Full webhook payload structure:', {
      hasObject: typeof body === 'object',
      keys: Object.keys(body),
      entryStructure: body.entry?.map((entry: any, idx: number) => ({
        index: idx,
        hasId: !!entry.id,
        hasChanges: !!entry.changes,
        changesLength: entry.changes?.length,
        changesTypes: entry.changes?.map((change: any) => ({
          hasValue: !!change.value,
          valueKeys: change.value ? Object.keys(change.value) : [],
          hasMessages: !!change.value?.messages,
          messagesLength: change.value?.messages?.length,
          hasStatuses: !!change.value?.statuses,
          statusesLength: change.value?.statuses?.length,
        })),
      })),
      fullPayloadPreview: JSON.stringify(body).substring(0, 500),
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
      hasImage: !!message.image,
      hasAudio: !!message.audio,
      timestamp: message.timestamp,
    })

    const senderPhone = message.from

    // Processar IMAGEM
    if (message.type === 'image' && message.image) {
      console.log('📸 Image message received')

      if (!hasCredentials) {
        console.error('❌ Cannot process image: WhatsApp credentials not configured')
        return NextResponse.json({ success: true }, { status: 200 })
      }

      try {
        // Obter URL da imagem via Meta API
        // O WhatsApp envia image.id, precisamos buscar a URL
        const imageId = message.image.id
        const caption = message.image.caption

        console.log('🔄 Fetching image URL from Meta API...', {
          imageId,
          hasCaption: !!caption,
        })

        // Buscar URL da imagem via Meta API
        const phoneNumberId = whatsappPhoneNumberId
        const token = whatsappToken
        const mediaUrl = `https://graph.facebook.com/v21.0/${imageId}`

        const mediaResponse = await fetch(mediaUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!mediaResponse.ok) {
          throw new Error(`Failed to fetch image URL: ${mediaResponse.status}`)
        }

        const mediaData = await mediaResponse.json()
        const imageUrl = mediaData.url

        if (!imageUrl) {
          console.error('❌ No image URL found in media response')
          await sendWhatsAppMessage(
            senderPhone,
            'Desculpe, não consegui acessar a imagem. Tente enviar novamente!'
          )
          return NextResponse.json({ success: true }, { status: 200 })
        }

        console.log('✅ Image URL obtained:', {
          imageUrl: imageUrl.substring(0, 100),
        })

        // Processar imagem com Groq Vision
        console.log('🔄 Processing image with Groq Vision...')
        const reply = await processImageWithGroq(imageUrl, caption)

        if (!reply) {
          await sendWhatsAppMessage(
            senderPhone,
            'Desculpe, tive problema ao analisar a foto. Tente descrever por texto!'
          )
          return NextResponse.json({ success: true }, { status: 200 })
        }

        // Salvar no histórico
        try {
          const conversationId = await getOrCreateConversation(senderPhone)
          const captionText = caption || '[Foto enviada]'
          await saveMessage(conversationId, 'user', `📸 ${captionText}`)
          await saveMessage(conversationId, 'assistant', reply)
        } catch (historyError) {
          console.error('⚠️ Error saving image to history:', historyError)
          // Continua mesmo se falhar histórico
        }

        // Enviar resposta
        await sendWhatsAppMessage(senderPhone, reply)
        console.log('✅ Image processed and response sent')

        return NextResponse.json({ success: true }, { status: 200 })
      } catch (error: any) {
        console.error('❌ Error processing image:', {
          error: error.message,
          stack: error.stack,
        })
        await sendWhatsAppMessage(
          senderPhone,
          'Desculpe, tive problema ao analisar a foto. Tente descrever por texto!'
        )
        return NextResponse.json({ success: true }, { status: 200 })
      }
    }

    // Processar ÁUDIO
    if (message.type === 'audio' && message.audio) {
      console.log('🎤 Audio message received')

      if (!hasCredentials) {
        console.error('❌ Cannot process audio: WhatsApp credentials not configured')
        return NextResponse.json({ success: true }, { status: 200 })
      }

      try {
        // Obter URL do áudio via Meta API
        const audioId = message.audio.id

        console.log('🔄 Fetching audio URL from Meta API...', {
          audioId,
        })

        // Buscar URL do áudio via Meta API
        const phoneNumberId = whatsappPhoneNumberId
        const token = whatsappToken
        const mediaUrl = `https://graph.facebook.com/v21.0/${audioId}`

        const mediaResponse = await fetch(mediaUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!mediaResponse.ok) {
          throw new Error(`Failed to fetch audio URL: ${mediaResponse.status}`)
        }

        const mediaData = await mediaResponse.json()
        const audioUrl = mediaData.url

        if (!audioUrl) {
          console.error('❌ No audio URL found in media response')
          await sendWhatsAppMessage(
            senderPhone,
            'Não consegui acessar o áudio. Pode repetir?'
          )
          return NextResponse.json({ success: true }, { status: 200 })
        }

        console.log('✅ Audio URL obtained:', {
          audioUrl: audioUrl.substring(0, 100),
        })

        // Transcrever áudio
        console.log('🔄 Transcribing audio...')
        const transcription = await transcribeAudioWithGroq(audioUrl)

        if (!transcription || transcription.trim() === '') {
          await sendWhatsAppMessage(
            senderPhone,
            'Não consegui entender o áudio. Pode repetir ou escrever?'
          )
          return NextResponse.json({ success: true }, { status: 200 })
        }

        console.log('✅ Audio transcribed:', {
          transcription: transcription.substring(0, 100),
        })

        // Processar texto transcrito como mensagem normal (com histórico)
        try {
          const conversationId = await getOrCreateConversation(senderPhone)
          const history = await getConversationHistory(conversationId, 10)

          await saveMessage(conversationId, 'user', `🎤 ${transcription}`)

          let reply = await processMessageWithClaude(transcription, history)

          if (!reply) {
            reply = 'Desculpe, não entendi. Pode repetir?'
          }

          await saveMessage(conversationId, 'assistant', reply)
          await sendWhatsAppMessage(senderPhone, reply)

          console.log('✅ Audio processed successfully')
        } catch (historyError: any) {
          console.error('⚠️ Error in conversation flow for audio:', historyError)

          // Fallback sem histórico
          let reply = await processMessageWithClaude(transcription)

          if (!reply) {
            reply = 'Desculpe, não entendi. Pode repetir?'
          }

          await sendWhatsAppMessage(senderPhone, reply)
        }

        return NextResponse.json({ success: true }, { status: 200 })
      } catch (error: any) {
        console.error('❌ Error processing audio:', {
          error: error.message,
          stack: error.stack,
        })
        await sendWhatsAppMessage(
          senderPhone,
          'Desculpe, tive problema com o áudio. Pode escrever?'
        )
        return NextResponse.json({ success: true }, { status: 200 })
      }
    }

    // Processar apenas mensagens de texto
    if (message.type === 'text' && message.text?.body) {
      const receivedText = message.text.body

      console.log('📝 Processing text message:', {
        from: senderPhone,
        text: receivedText.substring(0, 50),
      })

      // Verificar se as credenciais estão disponíveis antes de tentar enviar
      if (!hasCredentials) {
        console.error('❌ Cannot send auto-reply: WhatsApp credentials not configured')
        console.error('Missing:', {
          WHATSAPP_TOKEN: !whatsappToken,
          WHATSAPP_PHONE_NUMBER_ID: !whatsappPhoneNumberId,
        })
      } else {
        try {
          // 1. Obter ou criar conversa
          console.log('🔄 Getting or creating conversation...')
          const conversationId = await getOrCreateConversation(senderPhone)
          console.log('✅ Conversation ID:', conversationId)

          // 2. Buscar histórico
          console.log('📚 Fetching conversation history...')
          const history = await getConversationHistory(conversationId, 10)
          console.log('📚 History loaded:', history.length, 'messages')

          // 3. Salvar mensagem do usuário
          console.log('💾 Saving user message...')
          await saveMessage(conversationId, 'user', receivedText)

          // 4. Processar com Claude (com histórico)
          console.log('🤖 Processing with Claude...')
          let replyMessage = await processMessageWithClaude(receivedText, history)

          // Fallback se Claude retornar null
          if (!replyMessage) {
            console.warn('⚠️ Claude returned null, using default message')
            replyMessage = `✅ Mensagem recebida!\n\nVocê disse: "${receivedText}"\n\nEm breve terei mais funcionalidades! 🚀`
          } else {
            console.log('✅ Claude response generated successfully')
          }

          // 5. Salvar resposta do Claude
          console.log('💾 Saving assistant response...')
          await saveMessage(conversationId, 'assistant', replyMessage)

          // 6. Enviar resposta via WhatsApp
          console.log('📤 Sending WhatsApp reply...')
          const sendResult = await sendWhatsAppMessage(senderPhone, replyMessage)

          if (sendResult) {
            console.log('✅ Message processed successfully with conversation history:', {
              messageId: sendResult?.messages?.[0]?.id,
              to: senderPhone,
              conversationId,
              historyLength: history.length,
            })
          } else {
            console.error('❌ Failed to send auto-reply - check logs above for detailed error')
            console.error('Possible causes:', {
              credentialsConfigured: hasCredentials,
              tokenValid: !!whatsappToken,
              phoneNumberIdValid: !!whatsappPhoneNumberId,
              note: 'See detailed error logs from sendWhatsAppMessage function',
            })
          }
        } catch (error: any) {
          console.error('❌ Error in conversation flow:', {
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name,
          })

          // Fallback: funciona sem histórico (modo stateless)
          console.log('⚠️ Falling back to stateless mode...')
          try {
            let replyMessage = await processMessageWithClaude(receivedText)

            if (!replyMessage) {
              replyMessage = `✅ Mensagem recebida!\n\nVocê disse: "${receivedText}"\n\nEm breve terei mais funcionalidades! 🚀`
            }

            const sendResult = await sendWhatsAppMessage(senderPhone, replyMessage)

            if (sendResult) {
              console.log('✅ Fallback message sent successfully:', {
                messageId: sendResult?.messages?.[0]?.id,
                to: senderPhone,
              })
            } else {
              console.error('❌ Failed to send fallback message')
            }
          } catch (fallbackError: any) {
            console.error('❌ Error in fallback mode:', {
              error: fallbackError.message,
            })
          }
        }
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

