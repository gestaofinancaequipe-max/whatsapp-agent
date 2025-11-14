export interface BaseWhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: string
}

export interface WhatsAppText {
  body: string
}

export interface WhatsAppImage {
  id: string
  mime_type?: string
  sha256?: string
  caption?: string
  url?: string
}

export interface WhatsAppAudio {
  id: string
  mime_type?: string
  sha256?: string
  url?: string
}

export interface TextMessage extends BaseWhatsAppMessage {
  type: 'text'
  text: WhatsAppText
}

export interface ImageMessage extends BaseWhatsAppMessage {
  type: 'image'
  image: WhatsAppImage
  caption?: string
}

export interface AudioMessage extends BaseWhatsAppMessage {
  type: 'audio'
  audio: WhatsAppAudio
}

export type WhatsAppMessage =
  | TextMessage
  | ImageMessage
  | AudioMessage
  | BaseWhatsAppMessage

export function isTextMessage(
  message: WhatsAppMessage
): message is TextMessage {
  return message.type === 'text' && !!(message as TextMessage).text
}

export function isImageMessage(
  message: WhatsAppMessage
): message is ImageMessage {
  return message.type === 'image' && !!(message as ImageMessage).image
}

export function isAudioMessage(
  message: WhatsAppMessage
): message is AudioMessage {
  return message.type === 'audio' && !!(message as AudioMessage).audio
}

