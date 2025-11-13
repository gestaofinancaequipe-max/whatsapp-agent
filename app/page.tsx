'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [copied, setCopied] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  useEffect(() => {
    // Detectar URL do ambiente automaticamente
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      
      // Se estiver em localhost, usar localhost:3000
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        setWebhookUrl('http://localhost:3000/api/whatsapp/webhook')
      } else {
        // Em produção, usar window.location.origin (já inclui protocolo e host)
        // Ou usar NEXT_PUBLIC_VERCEL_URL se estiver definido
        const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
          ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
          : window.location.origin
        setWebhookUrl(`${baseUrl}/api/whatsapp/webhook`)
      }
    }
  }, [])

  const handleCopyUrl = async () => {
    if (!webhookUrl) return
    
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  const handleTestMessage = () => {
    // Funcionalidade de teste será implementada depois
    alert('Test message feature coming soon!')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-white flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10 max-w-md w-full">
        {/* Header com ícone e título */}
        <div className="text-center mb-10">
          <div className="text-7xl mb-5">🤖</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            WhatsApp Agent
          </h1>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="text-[#10b981] text-xl">●</span>
          <span className="text-gray-700 font-semibold text-base">System Online</span>
        </div>

        {/* Webhook URL Section */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Webhook URL:
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#3b82f6] transition-all"
            />
            <button
              onClick={handleCopyUrl}
              disabled={!webhookUrl}
              className="px-5 py-3 bg-[#3b82f6] text-white rounded-lg hover:bg-[#2563eb] active:bg-[#1d4ed8] transition-all duration-200 text-sm font-semibold whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {copied ? 'Copied! ✓' : 'Copy URL'}
            </button>
          </div>
        </div>

        {/* Divisória */}
        <div className="border-t border-gray-200 my-8"></div>

        {/* Quick Test Section */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Quick Test:
          </label>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Envie uma mensagem de teste para verificar se o webhook está funcionando corretamente.
          </p>
          <button
            onClick={handleTestMessage}
            className="w-full px-5 py-3 bg-[#10b981] text-white rounded-lg hover:bg-[#059669] active:bg-[#047857] transition-all duration-200 font-semibold focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:ring-offset-2 shadow-sm hover:shadow-md"
          >
            Send Test Message
          </button>
        </div>
      </div>
    </main>
  )
}

