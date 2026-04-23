'use client'

import { useEffect } from 'react'

export default function ReplayModal({ onStart, onClose }: {
  onStart: () => void
  onClose: () => void
}) {
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
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.75)' }} />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          border: '1px solid var(--border-h)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 24 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                Replay Mode
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Demo playback
              </p>
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
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 20 }}>
            Replays cached briefs at 1.8s intervals. Clears the current feed and plays all loaded briefs in order.
          </p>

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <DetailBox label="Interval" value="1.8s / brief" />
            <DetailBox label="Order" value="Chronological" />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-2)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'border-color 0.12s, color 0.12s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.color = 'var(--text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.color = 'var(--text-2)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onStart}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 8,
                border: '1px solid var(--accent)',
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.12s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              Start Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-3)',
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </p>
    </div>
  )
}