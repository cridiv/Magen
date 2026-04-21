'use client'

import { useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { MemeBrief } from '../../../lib/types'

function timeAgo(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }) }
  catch { return '—' }
}

function confColor(s: string = '') {
  const v = s.toLowerCase()
  if (v.includes('strongly')) return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', bar: 'bg-red-500', glow: 'shadow-red-500/20' }
  if (v.includes('contested')) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: 'bg-amber-500', glow: 'shadow-amber-500/20' }
  if (v.includes('agreed') || v.includes('consensus')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500', glow: 'shadow-emerald-500/20' }
  return { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700/30', bar: 'bg-zinc-600', glow: '' }
}

const ARCHETYPE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  animal:    { text: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  meta:      { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  political: { text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  absurdist: { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
}
function archetypeColor(a: string = '') {
  const key = Object.keys(ARCHETYPE_COLORS).find(k => a.toLowerCase().includes(k))
  return key ? ARCHETYPE_COLORS[key] : { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700/30' }
}

export default function BriefModal({ brief, onClose }: { brief: MemeBrief; onClose: () => void }) {
  const conf = confColor(brief.confidenceSignal)
  const arch = archetypeColor(brief.culturalArchetype)
  const symbol = (brief.token?.symbol ?? brief.tokenAddress.slice(2, 5)).toUpperCase()

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0f0f11] border border-white/[0.1] rounded-2xl shadow-2xl">

        {/* Top accent bar */}
        <div className={`h-px w-full ${conf.bar} opacity-60`} />

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            {/* Token avatar */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold font-mono border ${arch.bg} ${arch.border} ${arch.text}`}>
              {symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold tracking-tight">{brief.token?.symbol ?? brief.tokenAddress.slice(0, 10) + '…'}</h2>
                {brief.token?.name && (
                  <span className="text-zinc-500 text-sm">{brief.token.name}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-wide uppercase border ${arch.text} ${arch.bg} ${arch.border}`}>
                  {brief.culturalArchetype}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-wide uppercase border ${conf.text} ${conf.bg} ${conf.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${conf.bar}`} />
                  {brief.confidenceSignal}
                </span>
                {brief.postedToTelegram && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-wide uppercase border border-sky-500/20 bg-sky-500/10 text-sky-400">
                    📨 Telegram
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Token address */}
        <div className="mx-6 mb-5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-between">
          <span className="font-mono text-[11px] text-zinc-500">{brief.tokenAddress}</span>
          <button
            onClick={() => navigator.clipboard.writeText(brief.tokenAddress)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
        </div>

        {/* Verdict tag */}
        <div className="mx-6 mb-5">
          <p className="text-zinc-400 text-[11px] font-mono uppercase tracking-widest mb-2">Verdict</p>
          <p className="text-white/90 text-base font-medium leading-snug italic" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
            &quot;{brief.verdictTag}&quot;
          </p>
        </div>

        {/* Synthesis */}
        <div className="mx-6 mb-5">
          <p className="text-zinc-400 text-[11px] font-mono uppercase tracking-widest mb-2">Synthesis</p>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] border-l-2 border-l-purple-500/50">
            <p className="text-zinc-200 text-sm leading-relaxed">{brief.synthesis}</p>
          </div>
        </div>

        {/* Debate */}
        <div className="mx-6 mb-6">
          <p className="text-zinc-400 text-[11px] font-mono uppercase tracking-widest mb-3">Agent Debate</p>
          <div className="grid grid-cols-2 gap-3">

            {/* Optimist */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/15">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-emerald-400 font-mono text-[10px] font-bold tracking-widest uppercase">▲ Optimist</span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed">{brief.optimist}</p>
            </div>

            {/* Skeptic */}
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/15">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400 font-mono text-[10px] font-bold tracking-widest uppercase">▼ Skeptic</span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed">{brief.skeptic}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mx-6 mb-6 flex items-center justify-between text-zinc-600 font-mono text-[10px]">
          <span>{timeAgo(brief.createdAt)}</span>
          <span>#{brief.id.slice(-8)}</span>
        </div>
      </div>
    </div>
  )
}