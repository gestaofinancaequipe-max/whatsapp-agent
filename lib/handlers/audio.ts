import { transcribeAudioWithGroq } from '@/lib/services/groq'
import { getMediaUrl } from '@/lib/whatsapp'
import { handleTextMessage } from '@/lib/handlers/text'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

interface AudioHandlerParams {
  senderPhone: string
  audioId: string
  whatsappToken: string
  apiVersion?: string
}

const AUDIO_FALLBACK_MESSAGE =
  'Desculpe, tive problema com o áudio. Pode escrever o que comeu?'

export async function handleAudioMessage({
  senderPhone,
  audioId,
  whatsappToken,
  apiVersion,
}: AudioHandlerParams) {
  console.log('🎤 Handling audio message...', {
    senderPhone,
    audioId,
  })

  const audioUrl = await getMediaUrl(audioId, whatsappToken, apiVersion)

  const transcription = await transcribeAudioWithGroq(audioUrl)

  if (!transcription || transcription.trim().length === 0) {
    await sendWhatsAppMessage(senderPhone, AUDIO_FALLBACK_MESSAGE)
    return
  }

  console.log('✅ Audio transcribed successfully:', {
    senderPhone,
    transcriptionPreview: transcription.substring(0, 80),
  })

  await handleTextMessage({
    senderPhone,
    text: transcription,
    displayText: `🎤 ${transcription}`,
  })
}

