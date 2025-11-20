'use client'

import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./MapInner'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-100 flex items-center justify-center">Harita Yükleniyor...</div>
})

export default Map
