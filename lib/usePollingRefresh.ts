"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export function usePollingRefresh(intervalMs: number, maxTries: number) {
  const [tick, setTick] = useState(0)
  const [isPolling, setIsPolling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const triesRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsPolling(false)
    triesRef.current = 0
  }, [])

  const triggerPoll = useCallback(() => {
    // Restart cleanly if already running
    if (timerRef.current !== null) clearInterval(timerRef.current)
    triesRef.current = 0
    setIsPolling(true)

    timerRef.current = setInterval(() => {
      setTick((n) => n + 1)
      triesRef.current += 1
      if (triesRef.current >= maxTries) stopPolling()
    }, intervalMs)
  }, [intervalMs, maxTries, stopPolling])

  // Clean up on unmount
  useEffect(() => stopPolling, [stopPolling])

  return { tick, triggerPoll, isPolling, stopPolling }
}
