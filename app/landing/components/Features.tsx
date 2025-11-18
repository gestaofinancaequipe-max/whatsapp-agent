import Link from 'next/link'

const whatsappUrl = 'https://wa.me/15556307279?text=Oi!%20Quero%20começar%20a%20controlar%20minhas%20calorias%20🔥'

const features = [
  {
    icon: '🔥',
    title: 'Sistema de Streaks',
    badge: 'Gamificação',
    description: 'Mantenha sua sequência de dias batendo a meta. Quanto mais dias, mais motivado você fica.'
  },
  {
    icon: '🏆',
    title: 'Badges & Conquistas',
    badge: 'Recompensas',
    description: 'Desbloqueie badges exclusivas: Semana Perfeita, Proteína King, Lendário e muito mais.'
  },
  {
    icon: '📊',
    title: 'Relatórios Inteligentes',
    badge: 'Análise',
    description: 'Gráficos diários, semanais e mensais. Veja seu progresso e entenda seus padrões.'
  },
  {
    icon: '🎯',
    title: 'Sugestões em Tempo Real',
    badge: 'IA Ativa',
    description: 'Passou da meta? Receba sugestões de refeições leves. Faltou proteína? A gente avisa.'
  },
  {
    icon: '🥘',
    title: '2.000+ Alimentos Brasileiros',
    badge: '100% BR',
    description: 'Arroz, feijão, pão de queijo, tapioca, açaí. Tudo que você come de verdade.'
  },
  {
    icon: '🔔',
    title: 'Lembretes Personalizados',
    badge: 'Automático',
    description: 'Notificações inteligentes quando você esquece de registrar. Seu streak não vai morrer.'
  }
]

export default function Features() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Por Que CaloriasBot?
          </h2>
          <p className="text-xl text-gray-600">
            Diferenciais que fazem a diferença
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-4xl">{feature.icon}</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Box */}
        <div className="bg-green-600 rounded-2xl p-8 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">
            Pronto pra começar?
          </h3>
          <p className="text-xl mb-6 opacity-90">
            14 dias grátis
          </p>
          <Link
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-green-600 font-bold rounded-xl hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Começar Grátis no WhatsApp
          </Link>
        </div>
      </div>
    </section>
  )
}

