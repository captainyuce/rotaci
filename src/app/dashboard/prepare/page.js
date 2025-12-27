'use client'

import WorkerPanelContent from '@/components/WorkerPanelContent'

export default function PreparePage() {
    return (
        <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[600px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">
            <div className="p-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Depo / Hazırlık</h2>
                <p className="text-xs text-slate-500">Sevkiyat hazırlama ve durum yönetimi</p>
            </div>
            <div className="flex-1 overflow-hidden relative">
                <WorkerPanelContent isDashboard={true} />
            </div>
        </div>
    )
}
