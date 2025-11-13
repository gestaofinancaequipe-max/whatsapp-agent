import axios from 'axios'

// Interface para mensagens do WhatsApp recebidas via webhook
export interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  text?: {
    body: string
  }
  type: string
}

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
      console.error('Missing:', {
        phoneNumberId: !phoneNumberId,
        token: !token,
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
    })

    const response = await axios.post(url, payload, { headers })

    console.log('✅ Message sent successfully:', response.data)

    return response.data
  } catch (error: any) {
    console.error('❌ Error sending WhatsApp message:', {
      to,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    })
    return null
  }
}

/**
 * Extrai a mensagem do payload do webhook do Meta
 * @param body Body recebido do webhook
 * @returns Mensagem extraída ou null se não encontrar
 */
export function extractMessage(body: WebhookPayload): WhatsAppMessage | null {
  try {
    // Estrutura do webhook do Meta:
    // body.entry[0].changes[0].value.messages[0]
    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      console.log('⚠️ No messages found in webhook payload')
      return null
    }

    const message = messages[0]

    const extractedMessage: WhatsAppMessage = {
      from: message.from,
      id: message.id,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text,
    }

    console.log('📥 Extracted message:', {
      from: extractedMessage.from,
      type: extractedMessage.type,
      hasText: !!extractedMessage.text,
      textPreview: extractedMessage.text?.body?.substring(0, 50),
    })

    return extractedMessage
  } catch (error: any) {
    console.error('❌ Error extracting message from webhook:', {
      error: error.message,
      body: JSON.stringify(body).substring(0, 200),
    })
    return null
  }
}

