import { NextRequest, NextResponse } from 'next/server'

/**
 * Endpoint de teste para verificar se o webhook está acessível
 * Use para testar se a rota está funcionando antes de configurar no Meta
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    url: request.url,
    webhookUrl: request.url.replace('/test', ''),
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook POST test successful',
    timestamp: new Date().toISOString(),
    receivedBody: body,
    bodyKeys: Object.keys(body),
  })
}

