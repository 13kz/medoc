import { useEffect, useState } from 'react'
import { simulatedNow, useStore } from './store'

/** Heure simulée, rafraîchie chaque seconde réelle. */
export function useNow(): number {
  const { state } = useStore()
  const [real, setReal] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setReal(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return simulatedNow(state.clock, real)
}
