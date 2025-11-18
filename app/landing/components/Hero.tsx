'use client'

import Link from 'next/link'

const whatsappUrl = 'https://wa.me/15556307279?text=Oi!%20Quero%20começar%20a%20controlar%20minhas%20calorias%20🔥'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 via-blue-50 to-green-100">
      {/* Animated Blobs Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-sm font-semibold text-gray-700 mb-6 shadow-sm animate-pulse-slow">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Mais de 500 pessoas já controlam suas calorias aqui
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Saiba <span className="text-green-600">exatamente</span> quantas calorias você está comendo
            </h1>

            {/* Sub-headline */}
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 leading-relaxed">
              Consulte calorias. Registre refeições. Acompanhe atividades.<br />
              Tudo no WhatsApp. Simples assim. 🥗
            </p>

            {/* CTA Button */}
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-5 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 mb-6"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Começar Grátis no WhatsApp
            </Link>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-gray-600 mb-4">
              <span className="flex items-center gap-1">
                <span className="text-green-600 font-bold">✓</span> 7 dias grátis
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600 font-bold">✓</span> +7 dias com cartão
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-600 font-bold">✓</span> Cancela quando quiser
              </span>
            </div>

            {/* Link to Como Usar */}
            <div className="text-center lg:text-left">
              <Link
                href="/como-usar"
                className="text-green-600 hover:text-green-700 font-semibold text-sm underline"
              >
                Ver como usar →
              </Link>
            </div>
          </div>

          {/* Right Column - WhatsApp Mockup */}
          <div className="relative">
            {/* WhatsApp Mockup Card */}
            <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm mx-auto">
              {/* WhatsApp Header */}
              <div className="bg-green-600 rounded-t-2xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <div>
                    <div className="text-white font-semibold">CaloriasBot</div>
                    <div className="text-green-100 text-xs">online</div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4 mb-4">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-green-100 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-gray-800">Almocei arroz, feijão e frango grelhado</p>
                  </div>
                </div>

                {/* Bot Response */}
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                    <p className="text-sm text-gray-800 mb-2">
                      ✅ Registrado! Almoço: 650 kcal
                    </p>
                    <p className="text-xs text-gray-600 mb-2">
                      Proteína: 45g | Carbs: 80g
                    </p>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Hoje: 1.450/2.000 kcal</span>
                        <span>72.5%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '72.5%' }}></div>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 font-semibold">
                      Faltam 550 kcal ✨
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 bg-yellow-400 rounded-2xl px-4 py-2 shadow-lg transform rotate-3 animate-pulse-slow">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <span className="text-sm font-bold text-gray-800">3 dias de streak!</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-purple-500 rounded-2xl px-4 py-2 shadow-lg transform -rotate-3 animate-pulse-slow" style={{ animationDelay: '1s' }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <span className="text-sm font-bold text-white">Badge desbloqueada</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

