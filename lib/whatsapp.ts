import axios from 'axios'
import {
  WhatsAppMessage,
  isAudioMessage,
  isImageMessage,
  isTextMessage,
} from '@/lib/types/WhatsAppMessage'

// Interface para a estrutura completa do webhook payload
interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string
          id: string
          timestamp: string
          type: string
          text?: {
            body: string
          }
          image?: {
            id: string
            mime_type?: string
            sha256?: string
            caption?: string
          }
          audio?: {
            id: string
            mime_type?: string
            sha256?: string
          }
        }>
        statuses?: Array<{
          id: string
          status: string
          recipient_id: string
          timestamp: string
        }>
      }
    }>
  }>
}

/**
 * Envia uma mensagem de texto via WhatsApp Business API
 * @param to Número de telefone do destinatário (formato: 5511999999999)
 * @param message Texto da mensagem a ser enviada
 * @returns Promise com a resposta da API ou null em caso de erro
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<any | null> {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const token = process.env.WHATSAPP_TOKEN

    // Validação das variáveis de ambiente
    if (!phoneNumberId || !token) {
      console.error('❌ WhatsApp credentials not configured')
      console.error('Missing credentials:', {
        phoneNumberId: !phoneNumberId,
        phoneNumberIdValue: phoneNumberId ? `${phoneNumberId.substring(0, 4)}...` : 'NOT SET',
        token: !token,
        tokenLength: token?.length || 0,
        envVarsCheck: {
          WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
          WHATSAPP_TOKEN: !!process.env.WHATSAPP_TOKEN,
        },
      })
      return null
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: message,
      },
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    console.log('📤 Sending WhatsApp message:', {
      to,
      messageLength: message.length,
      url,
      phoneNumberId: phoneNumberId,
      tokenLength: token.length,
    })

    const response = await axios.post(url, payload, { headers })

    console.log('✅ Message sent successfully:', {
      messageId: response.data?.messages?.[0]?.id,
      to: response.data?.contacts?.[0]?.wa_id,
      status: response.status,
    })

    return response.data
  } catch (error: any) {
    // Log detalhado do erro da API do Meta
    const errorDetails: any = {
      to,
      errorMessage: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
    }

    // Detalhes do erro da API do Meta
    if (error.response?.data) {
      errorDetails.apiError = {
        error: error.response.data.error,
        errorType: error.response.data.error?.type,
        errorCode: error.response.data.error?.code,
        errorSubcode: error.response.data.error?.error_subcode,
        errorMessage: error.response.data.error?.message,
        errorUserTitle: error.response.data.error?.error_user_title,
        errorUserMsg: error.response.data.error?.error_user_msg,
        fbtraceId: error.response.data.error?.fbtrace_id,
        fullErrorData: error.response.data,
      }
    }

    // Informações sobre headers e configuração
    if (error.config) {
      errorDetails.requestConfig = {
        method: error.config.method,
        url: error.config.url,
        hasAuthHeader: !!error.config.headers?.Authorization,
        authHeaderLength: error.config.headers?.Authorization?.length || 0,
      }
    }

    // Stack trace para erros de rede
    if (error.code) {
      errorDetails.networkError = {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port,
      }
    }

    console.error('❌ Error sending WhatsApp message (DETAILED):', errorDetails)
    
    return null
  }
}

/**
 * Busca a URL pública temporária de um media (imagem/áudio) via Graph API
 * @param mediaId ID do media do WhatsApp
 * @param token Token de acesso (opcional, usa env se não fornecido)
 * @param apiVersion Versão da API (padrão: v21.0)
 * @returns URL temporária do media
 */
export async function getMediaUrl(
  mediaId: string,
  token?: string,
  apiVersion: string = 'v21.0'
): Promise<string> {
  const accessToken = token || process.env.WHATSAPP_TOKEN
  if (!accessToken) {
    throw new Error('WHATSAPP_TOKEN não está configurado')
  }

  const mediaUrl = `https://graph.facebook.com/${apiVersion}/${mediaId}`

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Failed to fetch media url (${response.status}): ${body || 'unknown error'}`
    )
  }

  const data = await response.json()
  if (!data.url) {
    throw new Error('Media response did not include url field')
  }

  return data.url as string
}

/**
 * Extrai a mensagem do payload do webhook do Meta
 * @param body Body recebido do webhook
 * @returns Mensagem extraída ou null se não encontrar
 */
export function extractMessage(body: WebhookPayload): WhatsAppMessage | null {
  try {
    // Estrutura do webhook do Meta pode variar:
    // - Mensagens: body.entry[0].changes[0].value.messages[0]
    // - Status: body.entry[0].changes[0].value.statuses[0]
    // - Outros eventos podem vir em structures diferentes

    const entry = body.entry?.[0]
    if (!entry) {
      console.log('⚠️ No entry found in webhook payload')
      return null
    }

    const changes = entry.changes
    if (!changes || changes.length === 0) {
      console.log('⚠️ No changes found in webhook entry')
      return null
    }

    // Iterar sobre todas as mudanças para encontrar mensagens
    for (const change of changes) {
      const value = change?.value
      if (!value) continue

      // Verificar se há mensagens nesta mudança
      const messages = value.messages
      if (messages && messages.length > 0) {
        const message = messages[0]

        const baseMessage = {
          from: message.from,
          id: message.id,
          timestamp: message.timestamp,
          type: message.type,
        }

        let extractedMessage: WhatsAppMessage = baseMessage

        if (message.type === 'text' && message.text) {
          extractedMessage = {
            ...baseMessage,
            type: 'text',
            text: message.text,
          }
        } else if (message.type === 'image' && message.image) {
          extractedMessage = {
            ...baseMessage,
            type: 'image',
            image: message.image,
          }
        } else if (message.type === 'audio' && message.audio) {
          extractedMessage = {
            ...baseMessage,
            type: 'audio',
            audio: message.audio,
          }
        }

        const textPreview = isTextMessage(extractedMessage)
          ? extractedMessage.text.body.substring(0, 50)
          : undefined
        const imageId = isImageMessage(extractedMessage)
          ? extractedMessage.image.id
          : undefined
        const imageCaption =
          isImageMessage(extractedMessage) && extractedMessage.image.caption
            ? extractedMessage.image.caption.substring(0, 50)
            : undefined
        const audioId = isAudioMessage(extractedMessage)
          ? extractedMessage.audio.id
          : undefined

        const hasText = !!textPreview
        const hasImage = !!imageId
        const hasAudio = !!audioId

        console.log('📥 Extracted message:', {
          from: extractedMessage.from,
          type: extractedMessage.type,
          hasText,
          hasImage,
          hasAudio,
          textPreview,
          imageId,
          audioId,
          imageCaption,
        })

        return extractedMessage
      }

      // Se não há mensagens, verificar se há status (notificações de entrega)
      if (value.statuses && value.statuses.length > 0) {
        const status = value.statuses[0]
        console.log('ℹ️ Received status update (not a message):', {
          statusId: status.id,
          status: status.status,
          recipientId: status.recipient_id,
          timestamp: status.timestamp,
        })
        // Status updates não são mensagens, então retornamos null
        return null
      }
    }

    // Se chegou aqui, não encontrou mensagens nem status conhecidos
    console.log('⚠️ No messages found in webhook payload')
    console.log('Payload structure:', {
      entriesCount: body.entry?.length || 0,
      changesCount: body.entry?.[0]?.changes?.length || 0,
      hasMessages: body.entry?.[0]?.changes?.[0]?.value?.messages ? true : false,
      hasStatuses: body.entry?.[0]?.changes?.[0]?.value?.statuses ? true : false,
      valueKeys: body.entry?.[0]?.changes?.[0]?.value ? Object.keys(body.entry[0].changes[0].value) : [],
    })

    return null
  } catch (error: any) {
    console.error('❌ Error extracting message from webhook:', {
      error: error.message,
      stack: error.stack,
      bodyPreview: JSON.stringify(body).substring(0, 500),
    })
    return null
  }
}

