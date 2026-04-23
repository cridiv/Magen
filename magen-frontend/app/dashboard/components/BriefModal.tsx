'use client'

import { useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { MemeBrief } from '../../../lib/types'

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

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  negative: 'High risk',
  caution: 'Mixed signals',
  positive: 'Consensus',
  neutral: 'Unclassified',
}

export default function BriefModal({ brief, onClose }: { brief: MemeBrief; onClose: () => void }) {
  const level = getConfidenceLevel(brief.confidenceSignal)
  const accentColor = CONFIDENCE_COLORS[level]
  const symbol = brief.token?.symbol ?? brief.tokenAddress.slice(0, 8) + '…'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border-h)',
          borderRadius: 12,
        }}
      >
        {/* Top accent line */}
        <div style={{ height: 2, background: accentColor, borderRadius: '12px 12px 0 0' }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                {symbol}
              </h2>
              {brief.token?.name && (
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{brief.token.name}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag>{brief.culturalArchetype}</Tag>
              <Tag>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: accentColor }} />
                {brief.confidenceSignal}
              </Tag>
              {brief.postedToTelegram && <Tag>Telegram</Tag>}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-3)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              borderRadius: 6,
              transition: 'color 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Address */}
        <div
          style={{
            margin: '0 24px 16px',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {brief.tokenAddress}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(brief.tokenAddress)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-3)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              transition: 'color 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>

        {/* Verdict */}
        <Section label="Verdict" style={{ margin: '0 24px 16px' }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4, fontStyle: 'italic' }}>
            &quot;{brief.verdictTag}&quot;
          </p>
        </Section>

        {/* Synthesis */}
        <Section label="Synthesis" style={{ margin: '0 24px 16px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65 }}>
            {brief.synthesis}
          </p>
        </Section>

        {/* Debate */}
        <Section label="Agent Debate" style={{ margin: '0 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DebateColumn label="Optimist" text={brief.optimist} />
            <DebateColumn label="Skeptic" text={brief.skeptic} />
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-3)',
          }}
        >
          <span>{timeAgo(brief.createdAt)}</span>
          <span>#{brief.id.slice(-8)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        color: 'var(--text-2)',
        padding: '2px 7px',
        borderRadius: 4,
        border: '1px solid var(--border)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </span>
  )
}

function Section({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <p
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-3)',
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function DebateColumn({ label, text }: { label: string; text: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 8,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-3)',
          marginBottom: 8,
        }}
      >
        {label === 'Optimist' ? '▲' : '▼'} {label}
      </p>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-2)' }}>
        {text}
      </p>
    </div>
  )
}