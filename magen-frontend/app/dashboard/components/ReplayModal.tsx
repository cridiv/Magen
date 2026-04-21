'use client'

import { useEffect } from 'react'

export default function ReplayModal({ onStart, onClose }: {
  onStart: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-md bg-[#0f0f11] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent */}
        <div className="h-px w-full bg-purple-500/60" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-lg">
                ▶
              </div>
              <div>
                <h3 className="font-semibold text-base tracking-tight">Replay Mode</h3>
                <p className="text-zinc-500 text-xs">Demo playback</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <p className="text-zinc-400 text-sm leading-relaxed mb-5">
            Drip-feeds cached briefs at 1.8s intervals. Clears the current feed and replays all loaded briefs in chronological order.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-1">Interval</p>
              <p className="text-white font-semibold text-sm font-mono">1.8s / brief</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-1">Mode</p>
              <p className="text-white font-semibold text-sm font-mono">Chronological</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onStart}
              className="flex-1 py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 text-sm font-semibold transition-all"
            >
              ▶ Start Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}