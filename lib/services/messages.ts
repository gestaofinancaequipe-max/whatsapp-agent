import { saveMessage, updateConversationTimestamp } from '@/lib/services/supabase'
import {
  updateUserInteractionTimestamps,
  UserRecord,
} from '@/lib/services/users'

export async function recordUserMessage({
  conversationId,
  content,
  intent,
  user,
}: {
  conversationId: string
  content: string
  intent?: string
  user?: UserRecord | null
}) {
  await saveMessage(conversationId, 'user', content, intent)
  if (user) {
    await updateUserInteractionTimestamps(user.id, { userMessage: true })
  }
}

export async function recordAssistantMessage({
  conversationId,
  content,
  intent,
  user,
}: {
  conversationId: string
  content: string
  intent?: string
  user?: UserRecord | null
}) {
  await saveMessage(conversationId, 'assistant', content, intent)
  if (user) {
    await updateUserInteractionTimestamps(user.id)
  } else {
    await updateConversationTimestamp(conversationId)
  }
}

