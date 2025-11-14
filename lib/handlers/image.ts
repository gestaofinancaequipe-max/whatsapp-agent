import { processImageWithGroq } from '@/lib/services/groq'
import { getMediaUrl } from '@/lib/services/whatsapp'
import {
  getOrCreateConversation,
  saveMessage,
} from '@/lib/services/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

interface ImageHandlerParams {
  senderPhone: string
  imageId: string
  caption?: string
  whatsappToken: string
  apiVersion?: string
}

const IMAGE_FALLBACK_MESSAGE =
  'Desculpe, tive problema ao analisar a foto. Tente descrever por texto!'

export async function handleImageMessage({
  senderPhone,
  imageId,
  caption,
  whatsappToken,
  apiVersion,
}: ImageHandlerParams) {
  console.log('📸 Handling image message...', {
    senderPhone,
    imageId,
    caption,
  })

  const imageUrl = await getMediaUrl(imageId, whatsappToken, apiVersion)

  const reply = await processImageWithGroq(imageUrl, caption)

  if (!reply) {
    await sendWhatsAppMessage(senderPhone, IMAGE_FALLBACK_MESSAGE)
    return
  }

  const conversationId = await getOrCreateConversation(senderPhone)
  const captionText = caption || '[Foto enviada]'
  await saveMessage(conversationId, 'user', `📸 ${captionText}`)
  await saveMessage(conversationId, 'assistant', reply)

  await sendWhatsAppMessage(senderPhone, reply)

  console.log('✅ Image processed successfully:', {
    senderPhone,
    imageId,
  })
}

