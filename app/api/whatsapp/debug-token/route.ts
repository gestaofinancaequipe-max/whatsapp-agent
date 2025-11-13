import { NextRequest, NextResponse } from 'next/server'

/**
 * ENDPOINT DE DEBUG - Mostra preview mascarado do token (apenas para desenvolvimento)
 * ATENÇÃO: Remover ou proteger este endpoint em produção!
 */
export async function GET(request: NextRequest) {
  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.NEXT_PUBLIC_WEBHOOK_VERIFY_TOKEN
  
  // Mostrar apenas primeiros e últimos 4 caracteres do token
  const maskToken = (t: string | undefined) => {
    if (!t) return 'NOT SET'
    if (t.length <= 8) return '***' // Muito curto para mostrar
    return `${t.substring(0, 4)}...${t.substring(t.length - 4)}`
  }
  
  return NextResponse.json({
    tokenExists: !!expectedToken,
    tokenLength: expectedToken?.length || 0,
    tokenPreview: maskToken(expectedToken),
    message: 'Use este token na URL de teste do webhook',
  })
}

