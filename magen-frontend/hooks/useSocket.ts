'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MemeBrief, ConnectionStatus, PipelineError } from '../lib/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:5000'

export function useSocket(onBrief: (brief: MemeBrief) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [errors, setErrors] = useState<PipelineError[]>([])
  const socketRef = useRef<any>(null)

  useEffect(() => {
    let io: any
    let socket: any

    const connect = async () => {
      try {
        const { io: socketIo } = await import('socket.io-client')
        io = socketIo

        socket = socketIo(WS_URL, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        })

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

        socket.on('brief:new', (brief: MemeBrief) => {
          onBrief(brief)
        })

        socket.on('pipeline:error', (err: PipelineError) => {
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
    setStatus('disconnected')
  }, [])

  return { status, errors, disconnect }
}