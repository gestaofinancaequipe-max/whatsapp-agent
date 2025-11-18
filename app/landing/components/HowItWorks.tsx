export default function HowItWorks() {
  const steps = [
    {
      icon: '📱',
      title: 'Manda uma mensagem',
      description: 'Escreve ou manda foto do que você comeu'
    },
    {
      icon: '🤖',
      title: 'IA calcula tudo',
      description: 'Calorias, proteínas, carboidratos automaticamente'
    },
    {
      icon: '📊',
      title: 'Acompanha sua meta',
      description: 'Vê quanto falta. Mantém streaks. Ganha badges.'
    }
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Como Funciona
          </h2>
          <p className="text-xl text-gray-600">
            Simples, rápido e eficiente
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {steps.map((step, index) => (
            <div
              key={index}
              className="text-center p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-white hover:shadow-lg transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className="text-6xl mb-4">{step.icon}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {step.title}
              </h3>
              <p className="text-gray-600 text-lg">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-6 max-w-3xl mx-auto">
          <p className="text-blue-900 text-lg">
            <span className="font-semibold">💡 Também registra atividades físicas</span> para ajustar sua meta diária
          </p>
        </div>
      </div>
    </section>
  )
}

