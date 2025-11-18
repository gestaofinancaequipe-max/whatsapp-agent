import Link from 'next/link'

const whatsappUrl = 'https://wa.me/15556307279?text=Oi!%20Quero%20começar%20a%20controlar%20minhas%20calorias%20🔥'

const features = [
  '7 dias grátis (sem cartão)',
  '+7 dias ao cadastrar cartão',
  'Tracking ilimitado de refeições',
  'Registro de atividades físicas',
  'Sistema de Streaks & Badges',
  'Relatórios e gráficos completos',
  'Sugestões inteligentes de IA',
  'Lembretes personalizados',
  '2.000+ alimentos brasileiros',
  'Cancela quando quiser'
]

const comparisons = [
  {
    icon: '🍦',
    item: '1 Açaí',
    price: 'R$ 15-20',
    duration: 'Dura 10 minutos'
  },
  {
    icon: '🍔',
    item: '1 iFood',
    price: 'R$ 30-40',
    duration: 'Dura 1 refeição'
  },
  {
    icon: '🔥',
    item: 'CaloriasBot',
    price: 'R$ 10/mês',
    duration: 'Dura o mês inteiro + resultados reais',
    highlight: true
  }
]

export default function Pricing() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Preço Justo, Resultados Reais
          </h2>
          <p className="text-xl text-gray-600">
            Menos que um açaí, mas te dá resultados o mês inteiro
          </p>
        </div>

        {/* Main Pricing Card */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-gradient-to-br from-green-50 to-white rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-green-200">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full mb-6">
              🔥 PLANO MAIS POPULAR
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-3xl text-gray-400 line-through">R$ 29</span>
                <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full">-66%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-bold text-gray-900">R$ 10</span>
                <span className="text-2xl text-gray-600">/mês</span>
              </div>
              <p className="text-gray-600 mt-2">
                R$ 0,33 por dia · Menos que um pão de queijo
              </p>
            </div>

            {/* Features List */}
            <ul className="space-y-3 mb-8">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-green-600 font-bold text-xl mt-0.5">✓</span>
                  <span className="text-gray-700 text-lg">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 mb-4"
            >
              Começar 14 Dias Grátis 🚀
            </Link>

            <p className="text-center text-sm text-gray-500">
              Sem compromisso. Sem pegadinhas.
            </p>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {comparisons.map((item, index) => (
            <div
              key={index}
              className={`rounded-2xl p-6 ${
                item.highlight
                  ? 'bg-green-600 text-white shadow-xl transform scale-105'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="text-5xl mb-4">{item.icon}</div>
              <h3 className="text-2xl font-bold mb-2">{item.item}</h3>
              <p className={`text-xl mb-2 ${item.highlight ? 'text-green-100' : 'text-gray-600'}`}>
                {item.price}
              </p>
              <p className={item.highlight ? 'text-green-100' : 'text-gray-500'}>
                {item.duration}
              </p>
            </div>
          ))}
        </div>

        {/* Guarantee Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-blue-50 rounded-xl border-2 border-blue-200">
            <span className="text-3xl">💎</span>
            <div className="text-left">
              <div className="font-bold text-blue-900">Garantia de 14 dias</div>
              <div className="text-sm text-blue-700">
                Não gostou? Cancele e receba seu dinheiro de volta
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

