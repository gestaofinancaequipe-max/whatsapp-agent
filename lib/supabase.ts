import { createClient } from '@supabase/supabase-js'

// Inicializar cliente Supabase
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase credentials not configured:', {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_ANON_KEY: !!supabaseAnonKey,
    })
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Obtém ou cria uma conversa ativa para um número de telefone
 * Conversas expiram após 30 minutos sem mensagem
 * @param phoneNumber Número de telefone do usuário
 * @returns ID da conversa (ativa ou nova)
 */
export async function getOrCreateConversation(
  phoneNumber: string
): Promise<string> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    console.log('🔍 Looking for active conversation:', {
      phoneNumber,
      thresholdMinutes: 30,
    })

    // Buscar conversa ativa (última mensagem há menos de 30 minutos)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: existingConversation, error: searchError } = await supabase
      .from('conversations')
      .select('id, last_message_at, status')
      .eq('phone_number', phoneNumber)
      .gt('last_message_at', thirtyMinutesAgo)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single()

    if (searchError && searchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (isso é ok)
      console.error('❌ Error searching for conversation:', searchError)
      throw searchError
    }

    // Se encontrou conversa ativa, retornar ID
    if (existingConversation) {
      console.log('✅ Found active conversation:', {
        conversationId: existingConversation.id,
        lastMessageAt: existingConversation.last_message_at,
      })
      return existingConversation.id
    }

    // Se não encontrou ou expirou, criar nova conversa
    console.log('📝 Creating new conversation for:', phoneNumber)

    const { data: newConversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        phone_number: phoneNumber,
        status: 'active',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !newConversation) {
      console.error('❌ Error creating conversation:', insertError)
      throw insertError || new Error('Failed to create conversation')
    }

    console.log('✅ New conversation created:', {
      conversationId: newConversation.id,
      phoneNumber,
    })

    return newConversation.id
  } catch (error: any) {
    console.error('❌ Error in getOrCreateConversation:', {
      error: error.message,
      phoneNumber,
    })
    throw error
  }
}

/**
 * Busca histórico de mensagens de uma conversa
 * @param conversationId ID da conversa
 * @param limit Número máximo de mensagens (padrão: 10)
 * @returns Array de mensagens em ordem cronológica [{role, content}, ...]
 */
export async function getConversationHistory(
  conversationId: string,
  limit: number = 10
): Promise<Array<{ role: string; content: string }>> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    console.log('📚 Fetching conversation history:', {
      conversationId,
      limit,
    })

    // Buscar últimas N mensagens (DESC) para depois reverter
    const { data: messages, error } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Error fetching conversation history:', error)
      throw error
    }

    if (!messages || messages.length === 0) {
      console.log('ℹ️ No history found for conversation:', conversationId)
      return []
    }

    // Reverter para ordem cronológica correta (mais antiga primeiro)
    const history = messages.reverse()

    console.log('✅ History loaded:', {
      conversationId,
      messageCount: history.length,
      roles: history.map((m) => m.role),
    })

    return history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
  } catch (error: any) {
    console.error('❌ Error in getConversationHistory:', {
      error: error.message,
      conversationId,
    })
    // Retornar array vazio em caso de erro (fallback gracioso)
    return []
  }
}

/**
 * Salva uma mensagem no banco de dados e atualiza timestamp da conversa
 * @param conversationId ID da conversa
 * @param role Role da mensagem ('user' ou 'assistant')
 * @param content Conteúdo da mensagem
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    console.log('💾 Saving message:', {
      conversationId,
      role,
      contentLength: content.length,
    })

    // Inserir mensagem
    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role,
      content,
    })

    if (insertError) {
      console.error('❌ Error saving message:', insertError)
      throw insertError
    }

    // Atualizar timestamp da conversa
    await updateConversationTimestamp(conversationId)

    console.log('✅ Message saved successfully:', {
      conversationId,
      role,
    })
  } catch (error: any) {
    console.error('❌ Error in saveMessage:', {
      error: error.message,
      conversationId,
      role,
    })
    throw error
  }
}

/**
 * Atualiza o timestamp da última mensagem de uma conversa
 * @param conversationId ID da conversa
 */
export async function updateConversationTimestamp(
  conversationId: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) {
      throw new Error('Supabase client not initialized')
    }

    const { error } = await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    if (error) {
      console.error('❌ Error updating conversation timestamp:', error)
      throw error
    }

    console.log('✅ Conversation timestamp updated:', conversationId)
  } catch (error: any) {
    console.error('❌ Error in updateConversationTimestamp:', {
      error: error.message,
      conversationId,
    })
    throw error
  }
}

