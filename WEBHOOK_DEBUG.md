# Debug: Webhook não está recebendo mensagens

Se o webhook não está recebendo mensagens (POST não sendo chamado), siga este guia de diagnóstico.

## 1. Verificar se a rota está acessível

Teste se o endpoint está funcionando:

```bash
# Teste GET (deve funcionar)
curl https://seu-dominio.vercel.app/api/whatsapp/webhook/test

# Teste POST
curl -X POST https://seu-dominio.vercel.app/api/whatsapp/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Se esses testes funcionarem, a rota está acessível.

## 2. Verificar configuração no Meta/Facebook

### Passo 1: Acessar configuração do webhook
1. Vá para: https://developers.facebook.com/apps/
2. Selecione seu app do WhatsApp
3. Vá em **WhatsApp** > **Configuration** (ou **API Setup**)

### Passo 2: Verificar URL do webhook
A URL deve ser exatamente:
```
https://seu-dominio.vercel.app/api/whatsapp/webhook
```

**Verificações importantes:**
- ✅ URL deve começar com `https://` (não `http://`)
- ✅ Não deve ter barra no final (`/api/whatsapp/webhook` e não `/api/whatsapp/webhook/`)
- ✅ Deve ser o domínio correto da Vercel (verifique na Vercel qual é o seu domínio)

### Passo 3: Verificar Webhook Verify Token
1. No Meta, na seção de webhook, veja qual token está configurado
2. Na Vercel, verifique a variável de ambiente `WEBHOOK_VERIFY_TOKEN`
3. **Os dois devem ser EXATAMENTE iguais** (incluindo maiúsculas/minúsculas e espaços)

### Passo 4: Verificar se o webhook está verificado
1. No Meta, na seção de webhook, deve mostrar status **"Verificado"** (Verified)
2. Se não estiver verificado, clique em **"Verify and Save"** ou **"Editar"** e verifique novamente

### Passo 5: Verificar campos (Fields) subscritos
Certifique-se de que os seguintes campos estão marcados:
- ✅ `messages`
- ✅ `message_deliveries` (opcional, mas recomendado)
- ✅ `message_reads` (opcional, mas recomendado)

## 3. Verificar se o número está recebendo mensagens

1. No Meta, vá em **WhatsApp** > **API Setup**
2. Verifique se o número do WhatsApp está ativo
3. Tente enviar uma mensagem do número configurado para outro número para verificar se está funcionando

## 4. Testar webhook manualmente

### Teste 1: Verificação do webhook (GET)
```bash
# Substitua YOUR_TOKEN pelo seu WEBHOOK_VERIFY_TOKEN
curl "https://seu-dominio.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

Deve retornar: `test123`

### Teste 2: Simular POST do Meta
```bash
curl -X POST https://seu-dominio.vercel.app/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "15555555555",
            "phone_number_id": "123456789"
          },
          "contacts": [{
            "profile": {
              "name": "Test User"
            },
            "wa_id": "5511999999999"
          }],
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.test123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Test message"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

Este teste deve gerar logs no Vercel com `🚀 ===== WEBHOOK POST CALLED =====`

## 5. Verificar logs na Vercel

1. Vá para seu projeto na Vercel
2. Clique em **Deployments** > Selecione o deploy mais recente
3. Clique em **Functions** > Selecione `api/whatsapp/webhook/route`
4. Veja os logs em tempo real

**O que procurar:**
- `🚀 ===== WEBHOOK POST CALLED =====` - Confirma que POST foi chamado
- `📨 Webhook POST received` - Confirma recebimento
- `💬 Message received` - Confirma extração da mensagem

## 6. Problemas comuns

### Problema: Webhook mostra como "Não verificado"
**Solução:**
1. Verifique se `WEBHOOK_VERIFY_TOKEN` na Vercel está correto
2. Verifique se o token no Meta é exatamente igual
3. Tente verificar novamente no Meta
4. Verifique os logs do GET no Vercel para ver se há erros

### Problema: Webhook está verificado mas não recebe mensagens
**Possíveis causas:**
1. URL incorreta no Meta
2. Campos não subscritos no Meta
3. Número do WhatsApp não está ativo
4. Mensagens não estão sendo enviadas do número configurado

### Problema: Logs mostram status updates mas não mensagens
**Causa:** Isso é normal! Status updates (sent, delivered, read) também vêm pelo webhook mas não são processados como mensagens.
**Solução:** Isso está funcionando corretamente. O webhook só processa mensagens com `type: 'text'`, `type: 'image'`, ou `type: 'audio'`.

## 7. Checklist final

Antes de reportar problema, verifique:

- [ ] URL do webhook está correta e acessível
- [ ] `WEBHOOK_VERIFY_TOKEN` está configurado na Vercel
- [ ] Token no Meta é exatamente igual ao da Vercel
- [ ] Webhook está **Verificado** no Meta
- [ ] Campo `messages` está subscrito
- [ ] Número do WhatsApp está ativo
- [ ] Enviou mensagem do número configurado
- [ ] Verificou logs na Vercel (deploy correto)
- [ ] Testou com curl (deve aparecer logs)

## 8. Como testar rapidamente

Execute este comando (substitua as variáveis):

```bash
# 1. Testar se endpoint está acessível
curl https://seu-dominio.vercel.app/api/whatsapp/webhook/test

# 2. Testar webhook com payload simulado
curl -X POST https://seu-dominio.vercel.app/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"id":"123","changes":[{"value":{"messaging_product":"whatsapp","messages":[{"from":"5511999999999","id":"test","timestamp":"123","type":"text","text":{"body":"teste"}}]},"field":"messages"}]}]}'

# 3. Verificar logs na Vercel após o teste acima
```

Se o teste #2 gerar logs com `🚀 ===== WEBHOOK POST CALLED =====`, o webhook está funcionando e o problema é configuração no Meta.

## 9. Próximos passos

1. Execute os testes acima
2. Verifique a configuração no Meta
3. Verifique os logs na Vercel
4. Se ainda não funcionar, compartilhe:
   - Resultado do teste com curl
   - Screenshot da configuração do webhook no Meta
   - Logs da Vercel

