'use client'

import { useState } from 'react'
import Link from 'next/link'

const whatsappUrl = 'https://wa.me/15556307279?text=Oi!%20Quero%20começar%20a%20controlar%20minhas%20calorias%20🔥'
const whatsappDuvidasUrl = 'https://wa.me/15556307279?text=Oi!%20Tenho%20algumas%20dúvidas%20sobre%20o%20CaloriasBot'

const faqs = [
  {
    question: 'Mais um app que vou abandonar em 1 semana?',
    answer: 'Não é app. É WhatsApp - que você já usa o dia inteiro. E com o sistema de streaks, você fica viciado em manter sua sequência. Teste 7 dias grátis pra ver. 😉'
  },
  {
    question: 'Tem comida brasileira de verdade?',
    answer: 'Sim! 2.000+ alimentos brasileiros. Arroz, feijão, pão de queijo, tapioca, açaí, marmitex, PF... tudo que você realmente come. Nada de "1 cup" ou comida americana.'
  },
  {
    question: 'Vai ser trabalhoso demais?',
    answer: 'Leva 30 segundos por refeição. É só mandar "comi arroz, frango e feijão" e pronto. A IA calcula tudo. Muito mais rápido que qualquer app.'
  },
  {
    question: 'Vale mesmo R$ 10 por mês?',
    answer: 'R$ 10 é o preço de 1 açaí ou 1 lanche no Mc. Só que o CaloriasBot te ajuda o mês inteiro a bater suas metas e ter resultados reais. Se não valer, cancela - sem burocracia.'
  },
  {
    question: 'Como funciona o teste grátis?',
    answer: '7 dias grátis sem precisar de cartão. Se você cadastrar o cartão, ganha +7 dias (14 dias no total). Só cobramos após o período de teste - e você pode cancelar quando quiser.'
  },
  {
    question: 'Preciso pesar toda comida na balança?',
    answer: 'Não necessariamente. Você pode falar "1 concha de arroz", "1 filé de frango", "1 colher de azeite". A gente trabalha com medidas caseiras brasileiras também.'
  },
  {
    question: 'Funciona para ganhar massa ou só emagrecer?',
    answer: 'Funciona para qualquer objetivo: emagrecer, ganhar massa, ou só manter. Você define sua meta de calorias e macros, e a gente te ajuda a bater ela todo dia.'
  },
  {
    question: 'E se eu comer fora, em restaurante?',
    answer: 'Sem problema! É só descrever o prato. "Comi um prato feito com arroz, feijão, bife e batata frita". A IA estima as calorias com base em porções padrão.'
  },
  {
    question: 'Posso registrar exercícios também?',
    answer: 'Sim! Você pode registrar suas atividades físicas (corrida, academia, bike...) e a gente ajusta sua meta de calorias do dia automaticamente.'
  },
  {
    question: 'Como funciona o sistema de streaks e badges?',
    answer: 'Cada dia que você bate sua meta, seu streak aumenta (tipo Duolingo). Você desbloqueia badges especiais: Semana Perfeita (7 dias), Mês Constante (30 dias), Lendário (100 dias)... É viciante! 🔥'
  },
  {
    question: 'E se eu esquecer de registrar uma refeição?',
    answer: 'A gente manda lembretes inteligentes quando você esquece. E você pode registrar depois - "jantar de ontem foi X". Seu streak continua vivo!'
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Sim! Sem multa, sem burocracia. É só mandar uma mensagem pedindo cancelamento e pronto. Nada de ligação ou email formal.'
  }
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-xl text-gray-600">
            Tire todas as suas dúvidas
          </p>
        </div>

        <div className="space-y-4 mb-12">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                <span className="text-2xl text-gray-400 flex-shrink-0 transform transition-transform duration-300">
                  {openIndex === index ? '−' : '+'}
                </span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5 text-gray-600 leading-relaxed animate-in slide-in-from-top-2 duration-300">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA Final */}
        <div className="bg-green-600 rounded-2xl p-8 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">
            Ainda tem dúvidas?
          </h3>
          <p className="text-xl mb-6 opacity-90">
            Fala com a gente no WhatsApp!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={whatsappDuvidasUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-green-600 font-bold rounded-xl hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Tirar Dúvidas
            </Link>
            <Link
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Começar Agora Grátis
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

