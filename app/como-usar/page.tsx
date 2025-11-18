import Link from 'next/link'

const whatsappUrl = 'https://wa.me/15556307279?text=Oi!%20Quero%20começar%20a%20controlar%20minhas%20calorias%20🔥'

export const metadata = {
  title: 'Como Usar o CaloriasBot - Tutorial Completo',
  description: 'Aprenda como usar o CaloriasBot no WhatsApp. Registre refeições, consulte alimentos, acompanhe seu progresso e muito mais.',
}

export default function ComoUsarPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/landing" className="text-green-600 hover:text-green-700 font-semibold">
              ← Voltar
            </Link>
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Começar Agora
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Como Usar o CaloriasBot
          </h1>
          <p className="text-xl text-gray-600">
            Tudo que você precisa saber para começar
          </p>
        </div>

        {/* Section 1: Começando */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🚀</span>
              Começando
            </h2>
            <div className="space-y-4 text-gray-700 text-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl font-bold text-green-600">1.</span>
                <p>
                  <strong>Mande 'oi' no WhatsApp</strong> para{' '}
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-semibold">
                    +1 555 630 7279
                  </a>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl font-bold text-green-600">2.</span>
                <p>
                  <strong>Configure sua meta de calorias</strong> (o bot vai te perguntar)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl font-bold text-green-600">3.</span>
                <p>
                  <strong>Pronto!</strong> Já pode começar a registrar
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Registrando Refeições */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🍽️</span>
              Registrando Refeições
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              Exemplos práticos de como registrar suas refeições:
            </p>
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Você:</p>
                    <p className="bg-green-100 rounded-lg px-4 py-2 text-gray-800 font-medium">
                      "Comi arroz, feijão e frango"
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Bot:</p>
                    <p className="bg-gray-100 rounded-lg px-4 py-2 text-gray-800">
                      ✅ Registrado! Almoço: 650 kcal
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Você:</p>
                    <p className="bg-green-100 rounded-lg px-4 py-2 text-gray-800 font-medium">
                      "Café da manhã: 2 pães com manteiga e café"
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Bot:</p>
                    <p className="bg-gray-100 rounded-lg px-4 py-2 text-gray-800">
                      ✅ Registrado! Café da manhã: 320 kcal
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Você:</p>
                    <p className="bg-green-100 rounded-lg px-4 py-2 text-gray-800 font-medium">
                      "Almocei um PF"
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Bot:</p>
                    <p className="bg-gray-100 rounded-lg px-4 py-2 text-gray-800">
                      O que tinha no prato feito? (arroz, feijão, carne...)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-4 mt-4">
                <p className="text-blue-900">
                  <strong>💡 Dica:</strong> Você também pode mandar uma foto da comida! O bot analisa e calcula as calorias automaticamente.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Consultando Alimentos */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🔍</span>
              Consultando Alimentos
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              Quer saber as calorias de um alimento antes de comer? É só perguntar:
            </p>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Quantas calorias tem em 100g de frango?"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Quanto tem 1 scoop de whey?"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Macros do arroz integral"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Registrando Exercícios */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">💪</span>
              Registrando Exercícios
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              Registre suas atividades físicas e o bot ajusta sua meta do dia automaticamente:
            </p>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Corri 5km"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Academia 1 hora"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Bike 30 minutos"
                </p>
              </div>
            </div>
            <div className="bg-green-50 border-l-4 border-green-500 rounded-r-xl p-4 mt-4">
              <p className="text-green-900">
                <strong>✨ Resultado:</strong> O bot ajusta sua meta de calorias do dia automaticamente baseado no exercício!
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Acompanhando Progresso */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">📊</span>
              Acompanhando Progresso
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              Veja como está seu progresso a qualquer momento:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Como estou hoje?"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Resumo da semana"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Meu streak"
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  "Minhas badges"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Comandos Úteis */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">⌨️</span>
              Comandos Úteis
            </h2>
            <p className="text-gray-600 mb-6 text-lg">
              Lista de comandos que você pode usar:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <code className="text-green-600 font-mono font-bold">/ajuda</code>
                <span className="text-gray-700">Ver todos os comandos disponíveis</span>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <code className="text-green-600 font-mono font-bold">/meta</code>
                <span className="text-gray-700">Alterar meta de calorias</span>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <code className="text-green-600 font-mono font-bold">/relatorio</code>
                <span className="text-gray-700">Ver relatório completo do dia/semana</span>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <code className="text-green-600 font-mono font-bold">/streak</code>
                <span className="text-gray-700">Ver dias de sequência (streak)</span>
              </div>
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <code className="text-green-600 font-mono font-bold">/badges</code>
                <span className="text-gray-700">Ver todas as conquistas desbloqueadas</span>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl shadow-xl p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Comece agora e ganhe 14 dias grátis!
            </p>
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-5 bg-white text-green-600 text-lg font-bold rounded-xl hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Começar Grátis no WhatsApp
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">
            © 2025 CaloriasBot. Sua saúde, seu controle.
          </p>
        </div>
      </footer>
    </main>
  )
}

