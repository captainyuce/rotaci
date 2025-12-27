'use client'

import dynamic from 'next/dynamic'

const MapInner = dynamic(() => import('./MapInner'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
            Harita Yükleniyor...
        </div>
    ),
})

export default function MapComponent() {
    return <MapInner />
}
