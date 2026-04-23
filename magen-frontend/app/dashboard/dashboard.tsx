'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useSocket } from '../../hooks/useSocket'
import { fetchRecentBriefs, fetchRecentAgentLogs } from '../../lib/api'
import type { MemeBrief, PipelineError, AgentLog } from '../../lib/types'
import BriefModal from './components/BriefModal'

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
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([])
  const [filter, setFilter] = useState('all')
  const [selectedBrief, setSelectedBrief] = useState<MemeBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [pipelineErrors, setPipelineErrors] = useState<PipelineError[]>([])

  // ── Add a new brief (deduplicated) ────────────────────────────────────────

  const addBrief = useCallback((b: MemeBrief) => {
    setBriefs((prev) => {
      if (prev.find((x) => x.id === b.id)) return prev
      return [b, ...prev].slice(0, 100)
    })
  }, [])

  const addAgentLog = useCallback((log: AgentLog) => {
    setAgentLogs((prev) => [log, ...prev].slice(0, 120))
  }, [])

  // ── WebSocket connection ──────────────────────────────────────────────────

  const { status, errors: socketErrors } = useSocket({
    onBrief: addBrief,
    onAgentLog: addAgentLog,
  })

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
        const [briefData, logData] = await Promise.all([
          fetchRecentBriefs(50),
          fetchRecentAgentLogs(40),
        ])
        if (!cancelled) {
          setBriefs(briefData)
          setAgentLogs(logData)
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

  const statusLabel = status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline'
  const statusColor = status === 'live' ? 'var(--positive)' : status === 'connecting' ? 'var(--caution)' : 'var(--text-3)'

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
                  animation: status === 'live' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
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

        {/* Summary */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {counts.total} brief{counts.total !== 1 ? 's' : ''}
            {counts.consensus > 0 && <> · <span style={{ color: 'var(--positive)' }}>{counts.consensus}</span> consensus</>}
            {counts.contested > 0 && <> · <span style={{ color: 'var(--caution)' }}>{counts.contested}</span> contested</>}
          </p>
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

        {/* Backend logs */}
        <section
          style={{
            marginBottom: 24,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Backend Logs
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
              {agentLogs.length} recent
            </span>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {agentLogs.length === 0 ? (
              <p style={{ margin: 0, padding: '12px', fontSize: 12, color: 'var(--text-3)' }}>
                Waiting for live backend pipeline activity...
              </p>
            ) : (
              agentLogs.map((log, i) => (
                <div
                  key={`${log.timestamp}-${log.eventType}-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 120px 1fr',
                    gap: 10,
                    padding: '8px 12px',
                    borderBottom: i === agentLogs.length - 1 ? 'none' : '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--text-3)' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: 'var(--text-2)', textTransform: 'uppercase' }}>{log.eventType}</span>
                  <span style={{ color: 'var(--text)' }}>
                    {log.tokenAddress ? `${log.tokenAddress.slice(0, 6)}…${log.tokenAddress.slice(-4)} · ` : ''}
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

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
    </div>
  )
}