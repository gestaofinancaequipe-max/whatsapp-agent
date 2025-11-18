import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm">
              © 2025 CaloriasBot. Sua saúde, seu controle.
            </p>
          </div>
          <div className="flex gap-6">
            <Link
              href="/como-usar"
              className="text-sm hover:text-white transition-colors"
            >
              Como Usar
            </Link>
            <Link
              href="/landing"
              className="text-sm hover:text-white transition-colors"
            >
              Início
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

