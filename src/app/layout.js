import './globals.css'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'

export const metadata = {
    title: 'Akalbatu Rota Optimizasyon',
    description: 'Depo ve sevkiyat yönetim sistemi',
}

export default function RootLayout({ children }) {
    return (
        <html lang="tr">
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>{children}</body>
        </html>
    )
}
