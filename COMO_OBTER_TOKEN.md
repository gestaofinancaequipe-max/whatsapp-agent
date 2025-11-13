# Como Obter Token Válido do WhatsApp Business API

## O problema
O token atual (`WHATSAPP_TOKEN`) está inválido ou expirado. Tokens do WhatsApp Business API geralmente têm centenas de caracteres, não apenas 19.

## Passos para obter um novo token

### 1. Acesse o Meta for Developers
- Vá para: https://developers.facebook.com/apps/
- Faça login com sua conta do Meta

### 2. Selecione seu App
- Encontre o app que está usando para WhatsApp Business API
- Se não tiver, crie um novo app do tipo "Business"

### 3. Configure WhatsApp Business API
- No menu lateral, vá em "WhatsApp" > "API Setup"
- Ou vá em "Products" e adicione "WhatsApp" se ainda não tiver

### 4. Obtenha o Access Token
- Na seção "Temporary access token" ou "Access tokens"
- Clique em "Generate" ou "Create Token"
- Selecione a página do WhatsApp Business que você quer usar
- Selecione as permissões necessárias:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`

### 5. Token Permanente (Recomendado)
Para um token permanente (não expira):

1. Vá em "Tools" > "Graph API Explorer"
2. Selecione seu app no dropdown
3. Clique em "Generate Access Token"
4. Selecione:
   - App: Seu app do WhatsApp
   - User or Page: Sua página do WhatsApp Business
   - Permissions: 
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
5. Copie o token gerado (será um token longo com centenas de caracteres)

### 6. Alternativa: Token via Sistema de Usuário do Sistema
Se você usa "System User":
1. Vá em "Business Settings" > "Users" > "System Users"
2. Crie ou selecione um System User
3. Atribua o app do WhatsApp a ele
4. Gere um token para o System User

## Atualizar na Vercel

1. Acesse seu projeto na Vercel
2. Vá em **Settings** > **Environment Variables**
3. Localize `WHATSAPP_TOKEN`
4. **Edite** e cole o novo token completo
5. **Importante**: Faça um **Redeploy** completo após atualizar

## Verificar Token

Um token válido do WhatsApp Business API:
- ✅ Tem centenas de caracteres (geralmente 200-500+)
- ✅ Começa com algo como `EAA...` ou similar
- ✅ Não é o mesmo que `WHATSAPP_PHONE_NUMBER_ID`

## Estrutura esperada
```
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
```

## Troubleshooting

Se ainda der erro 401 após atualizar:
1. Verifique se o token não expirou (tokens temporários expiram em ~60 dias)
2. Verifique se as permissões estão corretas
3. Verifique se o token é da página do WhatsApp Business correta
4. Tente gerar um novo token

