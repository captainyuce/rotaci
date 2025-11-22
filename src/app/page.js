import Link from 'next/link'

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-900 text-white">
            <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
                <h1 className="text-4xl font-bold mb-8">Akalbatu Lojistik</h1>
            </div>

            <div className="relative flex place-items-center">
                <div className="flex flex-col gap-4 text-center">
                    <p className="text-xl mb-8">Rota Optimizasyon Sistemi</p>
                    <Link
                        href="/login"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all"
                    >
                        Giriş Yap
                    </Link>
                </div>
            </div>
        </main>
    )
}
