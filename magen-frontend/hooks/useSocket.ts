'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MemeBrief, ConnectionStatus, PipelineError, AgentLog } from '../lib/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.trim() || 'http://localhost:5000'

type SocketClient = {
  disconnect: () => void
  on: (event: string, listener: (...args: unknown[]) => void) => void
}

type UseSocketOptions = {
  onBrief: (brief: MemeBrief) => void
  onAgentLog?: (log: AgentLog) => void
}

export function useSocket({ onBrief, onAgentLog }: UseSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [errors, setErrors] = useState<PipelineError[]>([])
  const socketRef = useRef<SocketClient | null>(null)

  useEffect(() => {
    let socket: SocketClient | undefined

    const connect = async () => {
      try {
        const { io: socketIo } = await import('socket.io-client')

        socket = socketIo(WS_URL, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        }) as SocketClient

        socketRef.current = socket

        socket.on('connect', () => {
          setStatus('live')
        })

        socket.on('disconnect', () => {
          setStatus('disconnected')
        })

        socket.on('connect_error', () => {
          setStatus('disconnected')
        })

        socket.on('brief:new', (...args: unknown[]) => {
          const brief = args[0] as MemeBrief
          onBrief(brief)
        })

        socket.on('backend:log', (...args: unknown[]) => {
          const log = args[0] as AgentLog
          onAgentLog?.(log)
        })

        socket.on('agent:log', (...args: unknown[]) => {
          const log = args[0] as AgentLog
          onAgentLog?.(log)
        })

        socket.on('pipeline:error', (...args: unknown[]) => {
          const err = args[0] as PipelineError
          setErrors(prev => [err, ...prev].slice(0, 10))
        })
      } catch {
        setStatus('disconnected')
      }
    }

    connect()

    return () => {
      socket?.disconnect()
    }
  }, [onAgentLog, onBrief])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
    setStatus('disconnected')
  }, [])

  return { status, errors, disconnect }
}