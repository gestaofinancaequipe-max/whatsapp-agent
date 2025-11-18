import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import Footer from './components/Footer'

export const metadata = {
  title: 'CaloriasBot - Controle de Calorias no WhatsApp',
  description: 'Saiba exatamente quantas calorias você está comendo. Registre refeições, acompanhe atividades e ganhe badges. Tudo no WhatsApp. 14 dias grátis.',
}

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  )
}

