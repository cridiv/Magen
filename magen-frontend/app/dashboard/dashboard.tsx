'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useSocket } from '../../hooks/useSocket'
import { fetchRecentBriefs } from '../../lib/api'
import type { MemeBrief, PipelineError } from '../../lib/types'
import BriefModal from './components/BriefModal'
import ReplayModal from './components/ReplayModal'

// ─── Mock data for replay mode ───────────────────────────────────────────────

const MOCK_BRIEFS: MemeBrief[] = [
  {
    id: 'a1b2c3d4e5f6a1b2',
    tokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
    culturalArchetype: 'Animal Meme',
    confidenceSignal: 'Both agents agreed',
    verdictTag: 'Organic velocity with strong holder retention',
    synthesis: 'Token exhibits textbook animal meme trajectory — early holder clustering with progressive LP deepening. On-chain velocity aligns with social momentum spikes. Both agents flag this as a potential multi-day runner given current market conditions and narrative tailwinds.',
    optimist: 'Holder distribution unusually healthy for a 48hr-old token. LP locks signal team conviction. Social graph shows organic spread vs bot amplification. Volume profile matches early PEPE run in 2023.',
    skeptic: 'Volume is real but concentrated in three wallets. Archetype saturation is high — animal memes face fatigue cycles. Without a unique narrative hook, this could flush on first liquidity test.',
    postedToTelegram: true,
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    token: { symbol: 'PEPE2', name: 'Pepe Two' },
  },
  {
    id: 'b2c3d4e5f6a1b2c3',
    tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    culturalArchetype: 'Political Satire',
    confidenceSignal: 'Strongly contested',
    verdictTag: 'Viral vector but paper-hand trap probable',
    synthesis: 'Political archetype with memetic reference to recent trending discourse. Pipeline flags anomalous LP injection pattern — possible coordinated launch. High velocity disguises thin sell-side depth beneath surface metrics.',
    optimist: 'Political memes have outsized viral coefficient. Narrative timing is near-perfect. If it catches a news cycle amplifier, 10x from here is realistic within 72 hours.',
    skeptic: 'LP injection fingerprints match known rug patterns. Holder count growing but median hold duration is 4 minutes. Dev wallet holds 18% of supply. This is a hard pass.',
    postedToTelegram: false,
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    token: { symbol: 'FLOKI3', name: 'Floki Three' },
  },
  {
    id: 'c3d4e5f6a1b2c3d4',
    tokenAddress: '0x567890abcdef1234567890abcdef1234567890ab',
    culturalArchetype: 'Meta Meme',
    confidenceSignal: 'Contested',
    verdictTag: 'Self-aware archetype with cult potential',
    synthesis: 'Wojak derivative leveraging intra-community nostalgia. Meta-meme layer adds second-order virality. Debate centers on whether the market has sufficient irony appetite after recent meta-fatigue across the BNB ecosystem.',
    optimist: 'Meta layer gives this real staying power. Community is self-organizing and self-referential — high retention probability. Reddit crossover detected in social graph.',
    skeptic: 'Wojak derivatives are a crowded field. Three similar tokens launched this week. Differentiation unclear. Copying a meme meta that peaked 18 months ago rarely works.',
    postedToTelegram: true,
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    token: { symbol: 'WOJAK', name: 'Wojak Classic' },
  },
  {
    id: 'd4e5f6a1b2c3d4e5',
    tokenAddress: '0x90abcdef1234567890abcdef1234567890abcdef',
    culturalArchetype: 'Animal Meme',
    confidenceSignal: 'Both agents agreed',
    verdictTag: 'Clean launch with genuine holder momentum',
    synthesis: 'Cat archetype launched with unusually clean on-chain hygiene. No pre-mine fingerprints detected. LP deployed across three DEX pairs simultaneously indicating strategic preparation. Both agents rate this as a high-conviction entry window.',
    optimist: 'LP structure is best-in-class for a token this young. Holder count doubling every 3 hours. No suspicious wallet clustering. Strong fundamentals for a meme.',
    skeptic: 'Cat memes need a hook beyond being cute. Marketing leg unclear. Without influencer pickup in next 6hrs, momentum stalls and liquidity evaporates.',
    postedToTelegram: true,
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    token: { symbol: 'CATZ', name: 'Catz Finance' },
  },
  {
    id: 'e5f6a1b2c3d4e5f6',
    tokenAddress: '0xdef1234567890abcdef1234567890abcdef123456',
    culturalArchetype: 'Absurdist',
    confidenceSignal: 'Contested',
    verdictTag: 'Absurdist narrative with niche ceiling',
    synthesis: 'Absurdist token relying on irony-native audience. On-chain metrics are stable but uninspiring. The archetype has found recent success on Solana but BNB Chain audience skews differently — translation risk is real.',
    optimist: 'Absurdist memes are having a genuine moment. Discord shows 2k+ members day one, organic not airdropped. This could be the BNB answer to NEIRO.',
    skeptic: 'Absurdism works in bull markets with high risk appetite. Current sentiment index is neutral. Ceiling here is probably a 3x then fade unless a major KOL picks it up.',
    postedToTelegram: false,
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    token: { symbol: 'MOON99', name: 'Moon99' },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true })
  } catch {
    return '—'
  }
}

type ConfidenceLevel = 'negative' | 'caution' | 'positive' | 'neutral'

function getConfidenceLevel(s: string = ''): ConfidenceLevel {
  const v = s.toLowerCase()
  if (v.includes('strongly')) return 'negative'
  if (v.includes('contested')) return 'caution'
  if (v.includes('agreed') || v.includes('consensus') || v.includes('aligned')) return 'positive'
  return 'neutral'
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  negative: 'var(--negative)',
  caution: 'var(--caution)',
  positive: 'var(--positive)',
  neutral: 'var(--text-3)',
}

// ─── BriefRow ─────────────────────────────────────────────────────────────────

function BriefRow({ brief, onClick }: { brief: MemeBrief; onClick: () => void }) {
  const level = getConfidenceLevel(brief.confidenceSignal)
  const borderColor = CONFIDENCE_COLORS[level]
  const symbol = brief.token?.symbol ?? brief.tokenAddress.slice(0, 8) + '…'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
      }}
    >
      {/* Left confidence border */}
      <div
        style={{
          width: 2,
          borderRadius: 1,
          background: borderColor,
          flexShrink: 0,
          alignSelf: 'stretch',
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: symbol + address + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {symbol}
          </span>
          {brief.token?.name && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {brief.token.name}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
            }}
          >
            {brief.tokenAddress.slice(0, 6)}…{brief.tokenAddress.slice(-4)}
          </span>
          {brief.postedToTelegram && (
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                color: 'var(--text-3)',
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid var(--border)',
              }}
            >
              TG
            </span>
          )}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
              flexShrink: 0,
            }}
          >
            {timeAgo(brief.createdAt)}
          </span>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--text-2)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {brief.culturalArchetype}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--text-2)',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: borderColor,
                flexShrink: 0,
              }}
            />
            {brief.confidenceSignal}
          </span>
        </div>

        {/* Verdict */}
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--text-2)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {brief.synthesis}
        </p>
      </div>

      {/* Chevron */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--text-3)' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [briefs, setBriefs] = useState<MemeBrief[]>([])
  const [filter, setFilter] = useState('all')
  const [selectedBrief, setSelectedBrief] = useState<MemeBrief | null>(null)
  const [showReplayModal, setShowReplayModal] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pipelineErrors, setPipelineErrors] = useState<PipelineError[]>([])

  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const replayIdx = useRef(0)

  // ── Add a new brief (deduplicated) ────────────────────────────────────────

  const addBrief = useCallback((b: MemeBrief) => {
    setBriefs((prev) => {
      if (prev.find((x) => x.id === b.id)) return prev
      return [b, ...prev].slice(0, 100)
    })
  }, [])

  // ── WebSocket connection ──────────────────────────────────────────────────

  const { status, errors: socketErrors } = useSocket(addBrief)

  // Sync pipeline errors from socket
  useEffect(() => {
    if (socketErrors.length > 0) {
      setPipelineErrors(socketErrors)
    }
  }, [socketErrors])

  // ── Fetch initial briefs on mount ─────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchRecentBriefs(50)
        if (!cancelled) {
          setBriefs(data)
        }
      } catch {
        // Backend offline — leave briefs empty
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Replay mode ───────────────────────────────────────────────────────────

  const startReplay = useCallback(() => {
    setIsReplaying(true)
    setShowReplayModal(false)
    setBriefs([])
    replayIdx.current = 0
    const queue = [...MOCK_BRIEFS].reverse()

    replayRef.current = setInterval(() => {
      if (replayIdx.current >= queue.length) {
        clearInterval(replayRef.current!)
        setIsReplaying(false)
        return
      }
      addBrief(queue[replayIdx.current++])
    }, 1800)
  }, [addBrief])

  const stopReplay = useCallback(() => {
    if (replayRef.current) clearInterval(replayRef.current)
    setIsReplaying(false)
    setBriefs([])
  }, [])

  useEffect(() => {
    return () => {
      if (replayRef.current) clearInterval(replayRef.current)
    }
  }, [])

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = briefs.filter((b) => {
    if (filter === 'all') return true
    if (filter === 'contested') return b.confidenceSignal?.toLowerCase().includes('contested')
    if (filter === 'consensus') {
      const v = b.confidenceSignal?.toLowerCase() ?? ''
      return v.includes('agreed') || v.includes('consensus') || v.includes('aligned')
    }
    if (filter === 'telegram') return b.postedToTelegram
    return true
  })

  const counts = {
    total: briefs.length,
    contested: briefs.filter((b) => b.confidenceSignal?.toLowerCase().includes('contested')).length,
    consensus: briefs.filter((b) => {
      const v = b.confidenceSignal?.toLowerCase() ?? ''
      return v.includes('agreed') || v.includes('consensus') || v.includes('aligned')
    }).length,
  }

  // ── Status label ──────────────────────────────────────────────────────────

  const statusLabel = isReplaying ? 'Replay' : status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'
  const statusColor = isReplaying ? 'var(--caution)' : status === 'live' ? 'var(--positive)' : status === 'connecting' ? 'var(--caution)' : 'var(--text-3)'

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'consensus', label: 'Consensus' },
    { key: 'contested', label: 'Contested' },
    { key: 'telegram', label: 'Telegram' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 960,
            margin: '0 auto',
            padding: '0 24px',
            height: 52,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <a href="/" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Magen
            </a>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dashboard
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Pipeline errors */}
            {pipelineErrors.length > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--negative)' }}>
                {pipelineErrors.length} error{pipelineErrors.length !== 1 ? 's' : ''}
              </span>
            )}

            {/* Connection status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: statusColor,
                  animation: status === 'live' && !isReplaying ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                  color: statusColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 6 }}>
            Brief Feed
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
            AI-generated meme token verdicts on BNB Chain. Each brief is produced by an adversarial multi-agent debate.
          </p>
        </div>

        {/* Summary line + controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {/* Summary */}
          <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {counts.total} brief{counts.total !== 1 ? 's' : ''}
            {counts.consensus > 0 && <> · <span style={{ color: 'var(--positive)' }}>{counts.consensus}</span> consensus</>}
            {counts.contested > 0 && <> · <span style={{ color: 'var(--caution)' }}>{counts.contested}</span> contested</>}
          </p>

          {/* Replay */}
          <button
            onClick={() => (isReplaying ? stopReplay() : setShowReplayModal(true))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: isReplaying ? 'var(--negative)' : 'var(--text-2)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.12s, color 0.12s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
              if (!isReplaying) e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              if (!isReplaying) e.currentTarget.style.color = 'var(--text-2)'
            }}
          >
            {isReplaying ? (
              <>
                <span style={{ width: 7, height: 7, borderRadius: 1, background: 'var(--negative)' }} />
                Stop
              </>
            ) : (
              <>
                <span style={{ fontSize: 9 }}>▶</span>
                Replay
              </>
            )}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filter === f.key ? 'var(--border-h)' : 'transparent',
                background: filter === f.key ? 'var(--surface)' : 'transparent',
                color: filter === f.key ? 'var(--text)' : 'var(--text-3)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.12s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (filter !== f.key) {
                  e.currentTarget.style.color = 'var(--text-2)'
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== f.key) {
                  e.currentTarget.style.color = 'var(--text-3)'
                }
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

        {/* Brief list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            // Loading state
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 96,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    opacity: 0.5,
                  }}
                />
              ))}
            </>
          ) : filtered.length === 0 ? (
            // Empty state
            <div
              style={{
                padding: '64px 24px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                {briefs.length === 0 ? 'No briefs yet' : 'No matching briefs'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', opacity: 0.6 }}>
                {briefs.length === 0
                  ? 'Briefs will appear here when the pipeline produces verdicts.'
                  : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            filtered.map((b) => (
              <BriefRow
                key={b.id}
                brief={b}
                onClick={() => setSelectedBrief(b)}
              />
            ))
          )}
        </div>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {selectedBrief && (
        <BriefModal brief={selectedBrief} onClose={() => setSelectedBrief(null)} />
      )}
      {showReplayModal && (
        <ReplayModal onStart={startReplay} onClose={() => setShowReplayModal(false)} />
      )}
    </div>
  )
}