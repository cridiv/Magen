'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import BriefModal from './components/BriefModal'
import ReplayModal from './components/ReplayModal'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemeBrief {
  id: string
  tokenAddress: string
  token?: { symbol: string; name?: string }
  culturalArchetype: string
  confidenceSignal: string
  verdictTag: string
  synthesis: string
  optimist: string
  skeptic: string
  postedToTelegram: boolean
  createdAt: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_BRIEFS: MemeBrief[] = [
  {
    id: 'a1b2c3d4e5f6a1b2',
    tokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
    token: { symbol: 'PEPE2', name: 'Pepe Two' },
    culturalArchetype: 'Animal Meme',
    confidenceSignal: 'Both agents agreed',
    verdictTag: 'Organic velocity with strong holder retention',
    synthesis: 'Token exhibits textbook animal meme trajectory — early holder clustering with progressive LP deepening. On-chain velocity aligns with social momentum spikes. Both agents flag this as a potential multi-day runner given current market conditions and narrative tailwinds.',
    optimist: 'Holder distribution unusually healthy for a 48hr-old token. LP locks signal team conviction. Social graph shows organic spread vs bot amplification. Volume profile matches early PEPE run in 2023.',
    skeptic: 'Volume is real but concentrated in three wallets. Archetype saturation is high — animal memes face fatigue cycles. Without a unique narrative hook, this could flush on first liquidity test.',
    postedToTelegram: true,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
  {
    id: 'b2c3d4e5f6a1b2c3',
    tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    token: { symbol: 'FLOKI3', name: 'Floki Three' },
    culturalArchetype: 'Political Satire',
    confidenceSignal: 'Strongly contested',
    verdictTag: 'Viral vector but paper-hand trap probable',
    synthesis: 'Political archetype with memetic reference to recent trending discourse. Pipeline flags anomalous LP injection pattern — possible coordinated launch. High velocity disguises thin sell-side depth beneath surface metrics.',
    optimist: 'Political memes have outsized viral coefficient. Narrative timing is near-perfect. If it catches a news cycle amplifier, 10x from here is realistic within 72 hours.',
    skeptic: 'LP injection fingerprints match known rug patterns. Holder count growing but median hold duration is 4 minutes. Dev wallet holds 18% of supply. This is a hard pass.',
    postedToTelegram: false,
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'c3d4e5f6a1b2c3d4',
    tokenAddress: '0x567890abcdef1234567890abcdef1234567890ab',
    token: { symbol: 'WOJAK', name: 'Wojak Classic' },
    culturalArchetype: 'Meta Meme',
    confidenceSignal: 'Contested',
    verdictTag: 'Self-aware archetype with cult potential',
    synthesis: 'Wojak derivative leveraging intra-community nostalgia. Meta-meme layer adds second-order virality. Debate centers on whether the market has sufficient irony appetite after recent meta-fatigue across the BNB ecosystem.',
    optimist: 'Meta layer gives this real staying power. Community is self-organizing and self-referential — high retention probability. Reddit crossover detected in social graph.',
    skeptic: 'Wojak derivatives are a crowded field. Three similar tokens launched this week. Differentiation unclear. Copying a meme meta that peaked 18 months ago rarely works.',
    postedToTelegram: true,
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: 'd4e5f6a1b2c3d4e5',
    tokenAddress: '0x90abcdef1234567890abcdef1234567890abcdef',
    token: { symbol: 'CATZ', name: 'Catz Finance' },
    culturalArchetype: 'Animal Meme',
    confidenceSignal: 'Both agents agreed',
    verdictTag: 'Clean launch with genuine holder momentum',
    synthesis: 'Cat archetype launched with unusually clean on-chain hygiene. No pre-mine fingerprints detected. LP deployed across three DEX pairs simultaneously indicating strategic preparation. Both agents rate this as a high-conviction entry window.',
    optimist: 'LP structure is best-in-class for a token this young. Holder count doubling every 3 hours. No suspicious wallet clustering. Strong fundamentals for a meme.',
    skeptic: 'Cat memes need a hook beyond being cute. Marketing leg unclear. Without influencer pickup in next 6hrs, momentum stalls and liquidity evaporates.',
    postedToTelegram: true,
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
  },
  {
    id: 'e5f6a1b2c3d4e5f6',
    tokenAddress: '0xdef1234567890abcdef1234567890abcdef123456',
    token: { symbol: 'MOON99', name: 'Moon99' },
    culturalArchetype: 'Absurdist',
    confidenceSignal: 'Contested',
    verdictTag: 'Absurdist narrative with niche ceiling',
    synthesis: 'Absurdist token relying on irony-native audience. On-chain metrics are stable but uninspiring. The archetype has found recent success on Solana but BNB Chain audience skews differently — translation risk is real.',
    optimist: 'Absurdist memes are having a genuine moment. Discord shows 2k+ members day one, organic not airdropped. This could be the BNB answer to NEIRO.',
    skeptic: 'Absurdism works in bull markets with high risk appetite. Current sentiment index is neutral. Ceiling here is probably a 3x then fade unless a major KOL picks it up.',
    postedToTelegram: false,
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }) }
  catch { return '—' }
}

function confColor(s: string = '') {
  const v = s.toLowerCase()
  if (v.includes('strongly')) return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-400', bar: '#f43f5e' }
  if (v.includes('contested')) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400', bar: '#f59e0b' }
  if (v.includes('agreed') || v.includes('consensus')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400', bar: '#10b981' }
  return { text: 'text-zinc-500', bg: 'bg-zinc-800/50', border: 'border-zinc-700/30', dot: 'bg-zinc-500', bar: '#52525b' }
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

// ─── Subcomponents ────────────────────────────────────────────────────────────

function NavPill({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium
      ${accent
        ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
        : 'border-white/10 bg-white/5 text-zinc-300'
      }`}>
      {children}
    </div>
  )
}

function Tag({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium tracking-wide uppercase border ${color} ${bg} ${border}`}>
      {children}
    </span>
  )
}

function StatCard({ icon, label, value, unit, color = 'text-white' }: {
  icon: React.ReactNode; label: string; value: string | number; unit?: string; color?: string
}) {
  return (
    <div className="bg-[#111113] border border-white/[0.07] rounded-2xl p-6 hover:border-white/[0.13] transition-colors">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-zinc-400 mb-4">
        <span className="text-base">{icon}</span>
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-5xl font-bold tracking-tight ${color}`}>{value}</span>
        {unit && <span className={`text-2xl font-semibold ${color} opacity-70`}>{unit}</span>}
      </div>
    </div>
  )
}

function BriefRow({ brief, onClick }: { brief: MemeBrief; onClick: () => void }) {
  const conf = confColor(brief.confidenceSignal)
  const arch = archetypeColor(brief.culturalArchetype)

  return (
    <div
      onClick={onClick}
      className="group flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#0e0e10] hover:bg-[#141416] hover:border-white/[0.12] cursor-pointer transition-all duration-150"
    >
      {/* Color bar */}
      <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: conf.bar }} />

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold font-mono flex-shrink-0 border ${arch.bg} ${arch.border} ${arch.text}`}>
        {(brief.token?.symbol ?? brief.tokenAddress.slice(2, 5)).slice(0, 2).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-white tracking-tight">
            {brief.token?.symbol ?? brief.tokenAddress.slice(0, 8) + '…'}
          </span>
          <span className="text-zinc-600 font-mono text-[10px]">
            {brief.tokenAddress.slice(0, 6)}…{brief.tokenAddress.slice(-4)}
          </span>
          {brief.postedToTelegram && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono font-medium">TG</span>
          )}
          <span className="text-zinc-600 text-[10px] font-mono ml-auto">{timeAgo(brief.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Tag color={arch.text} bg={arch.bg} border={arch.border}>{brief.culturalArchetype}</Tag>
          <Tag color={conf.text} bg={conf.bg} border={conf.border}>{brief.confidenceSignal}</Tag>
        </div>

        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{brief.synthesis}</p>
      </div>

      {/* Arrow */}
      <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-1">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [briefs, setBriefs]           = useState<MemeBrief[]>(MOCK_BRIEFS)
  const [filter, setFilter]           = useState('all')
  const [selectedBrief, setSelectedBrief] = useState<MemeBrief | null>(null)
  const [showReplayModal, setShowReplayModal] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const replayIdx = useRef(0)
  const cachedBriefs = useRef<MemeBrief[]>(MOCK_BRIEFS)

  const addBrief = useCallback((b: MemeBrief) => {
    setBriefs(prev => {
      if (prev.find(x => x.id === b.id)) return prev
      return [b, ...prev].slice(0, 100)
    })
  }, [])

  const startReplay = useCallback(() => {
    setIsReplaying(true)
    setShowReplayModal(false)
    setBriefs([])
    replayIdx.current = 0
    const cached = [...cachedBriefs.current].reverse()
    replayRef.current = setInterval(() => {
      if (replayIdx.current >= cached.length) {
        clearInterval(replayRef.current!); setIsReplaying(false); return
      }
      addBrief(cached[replayIdx.current++])
    }, 1800)
  }, [addBrief])

  const stopReplay = useCallback(() => {
    if (replayRef.current) clearInterval(replayRef.current)
    setIsReplaying(false)
    setBriefs(MOCK_BRIEFS)
  }, [])

  useEffect(() => () => { if (replayRef.current) clearInterval(replayRef.current) }, [])

  const filtered = briefs.filter(b => {
    if (filter === 'all') return true
    if (filter === 'contested') return b.confidenceSignal?.toLowerCase().includes('contested')
    if (filter === 'consensus') return b.confidenceSignal?.toLowerCase().includes('agreed')
    if (filter === 'telegram') return b.postedToTelegram
    return true
  })

  const stats = {
    total: briefs.length,
    contested: briefs.filter(b => b.confidenceSignal?.toLowerCase().includes('contested')).length,
    consensus: briefs.filter(b => b.confidenceSignal?.toLowerCase().includes('agreed')).length,
    telegram: briefs.filter(b => b.postedToTelegram).length,
  }

  const FILTERS = [
    { key: 'all', label: 'All Briefs' },
    { key: 'consensus', label: 'Consensus' },
    { key: 'contested', label: 'Contested' },
    { key: 'telegram', label: 'Telegram' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur-xl">
        {/* Purple accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
                <div className="w-3 h-3 rounded-sm bg-white/90" />
              </div>
              <span className="font-bold text-[15px] tracking-tight">Magen</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-400 font-mono font-semibold tracking-wider">BETA</span>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <nav className="flex items-center gap-1">
              {['Feed', 'Dashboard', 'Pipeline'].map((item) => (
                <button key={item} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${item === 'Dashboard' ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <NavPill>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] text-emerald-400 font-semibold tracking-wider">BNB · LIVE</span>
            </NavPill>
            <NavPill accent>
              <span>🤖</span>
              <span className="font-mono text-[11px]">AI · Meme Intelligence</span>
            </NavPill>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-10">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Brief Feed</h1>
          <p className="text-zinc-500 text-sm">
            AI-generated meme token intelligence on BNB Chain. Real-time pipeline analysis with optimist/skeptic debate.
          </p>
        </div>

        {/* Stat cards — exact Hyperway style */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          <StatCard icon="📊" label="Total Briefs"  value={stats.total} />
          <StatCard icon="⚡" label="Contested"     value={stats.contested}  color="text-red-400" />
          <StatCard icon="✅" label="Consensus"     value={stats.consensus}  color="text-emerald-400" />
          <StatCard icon="📨" label="To Telegram"   value={stats.telegram}   color="text-sky-400" />
        </div>

        <div className="h-px bg-white/[0.06] mb-8" />

        {/* Feed section */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold tracking-tight">Latest Briefs</h2>

          <div className="flex items-center gap-2">
            {/* Replay button */}
            <button
              onClick={() => isReplaying ? stopReplay() : setShowReplayModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
                ${isReplaying
                  ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:border-white/20'
                }`}
            >
              {isReplaying ? (
                <><span className="w-2 h-2 rounded-sm bg-red-400" /> Stop Replay</>
              ) : (
                <><span className="text-[11px]">▶</span> Replay</>
              )}
            </button>

            <span className="text-zinc-600 font-mono text-xs">{filtered.length} / {briefs.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${filter === f.key
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                  : 'border-white/[0.07] bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-white/15'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Brief list */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-zinc-600 font-mono text-xs tracking-widest uppercase mb-2">— Awaiting Token Data —</p>
              <p className="text-zinc-700 text-sm">Pipeline is running. Briefs appear here when tokens pass filter.</p>
            </div>
          ) : filtered.map(b => (
            <BriefRow key={b.id} brief={b} onClick={() => setSelectedBrief(b)} />
          ))}
        </div>
      </main>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {selectedBrief && (
        <BriefModal brief={selectedBrief} onClose={() => setSelectedBrief(null)} />
      )}
      {showReplayModal && (
        <ReplayModal onStart={startReplay} onClose={() => setShowReplayModal(false)} />
      )}
    </div>
  )
}