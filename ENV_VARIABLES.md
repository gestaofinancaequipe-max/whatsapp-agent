# Variáveis de Ambiente

Este documento lista todas as variáveis de ambiente necessárias para o projeto.

## Configuração do WhatsApp Business API

```env
WHATSAPP_TOKEN=your_permanent_token_here
WHATSAPP_PHONE_NUMBER_ID=896106376916223
WHATSAPP_BUSINESS_ACCOUNT_ID=2267097247091915
```

### Como obter:
- Veja `COMO_OBTER_TOKEN.md` para instruções detalhadas
- Token permanente obtido no Meta for Developers
- Phone Number ID e Business Account ID disponíveis na configuração do WhatsApp Business API

## Configuração do Webhook

```env
WEBHOOK_VERIFY_TOKEN=seu_token_secreto_random_string
```

### Uso:
- Token usado para verificar o webhook quando o Meta faz a verificação inicial
- Use uma string aleatória e segura
- Configure o mesmo token no Meta for Developers

## Configuração do Groq API

```env
GROQ_API_KEY=your_groq_api_key_here
```

### Como obter:
1. Acesse: https://console.groq.com/
2. Faça login ou crie uma conta
3. Vá em "API Keys"
4. Crie uma nova chave ou copie uma existente
5. A Groq oferece free tier generoso

## Configuração do Supabase

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Como obter:
1. Acesse: https://supabase.com/
2. Crie um projeto ou selecione um existente
3. Vá em "Settings" > "API"
4. Copie:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

### Estrutura do Banco (já deve estar criada):

**Tabela: conversations**
```sql
id (uuid, primary key)
phone_number (text)
status (text)
last_message_at (timestamp)
created_at (timestamp)
```

**Tabela: messages**
```sql
id (uuid, primary key)
conversation_id (uuid, foreign key -> conversations.id)
role (text) -- 'user' ou 'assistant'
content (text)
created_at (timestamp)
```

## Arquivo .env.local

Crie um arquivo `.env.local` na raiz do projeto com todas as variáveis acima:

```env
# WhatsApp Business API Configuration
WHATSAPP_TOKEN=your_permanent_token_here
WHATSAPP_PHONE_NUMBER_ID=896106376916223
WHATSAPP_BUSINESS_ACCOUNT_ID=2267097247091915

# Webhook Verification Token
WEBHOOK_VERIFY_TOKEN=seu_token_secreto_random_string

# Groq API Key
GROQ_API_KEY=your_groq_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Importante

- **Nunca commite** o arquivo `.env.local` no git (já está no `.gitignore`)
- Configure as mesmas variáveis na **Vercel** em "Settings" > "Environment Variables"
- Após adicionar/editar variáveis na Vercel, faça um **redeploy** completo
- Variáveis sem o prefixo `NEXT_PUBLIC_` só funcionam no servidor (API routes)

