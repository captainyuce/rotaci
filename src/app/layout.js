import './globals.css'
import 'driver.js/dist/driver.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
    title: 'Akalbatu Route Optimization',
    description: 'Lojistik ve Rota Optimizasyon Sistemi',
}

export default function RootLayout({ children }) {
    return (
        <html lang="tr">
            <body className={inter.className}>
                <ThemeProvider>
                    <AuthProvider>
                        {children}
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
