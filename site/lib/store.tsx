'use client'

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { planAlerts } from '@medoc/lib/alerts'
import { reducer, simulatedNow, type Action } from '@medoc/lib/reducer'
import { seedState } from '@medoc/lib/seed'
import type { AppState } from '@medoc/lib/types'

/**
 * Le dossier partagé de la démo : un seul état, le même réducteur que l'appli et le serveur,
 * et le même moteur d'alertes. Les trois rôles le lisent, chacun à sa façon.
 */
type Store = { state: AppState; now: number; dispatch: (a: Action) => void }

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState)
  const [real, setReal] = useState(() => Date.now())
  const fast = state.clock.speed > 1

  useEffect(() => {
    const id = setInterval(() => setReal(Date.now()), fast ? 200 : 1000)
    return () => clearInterval(id)
  }, [fast])

  const now = simulatedNow(state.clock, real)

  // Moteur d'alertes, comme sur le serveur : relance du patient, puis proches prévenus.
  const last = useRef('')
  useEffect(() => {
    const plan = planAlerts(state, now)
    const sig = plan.create.map((a) => a.id).join() + plan.resolve.map((r) => r.id).join()
    if (!sig || sig === last.current) return
    last.current = sig
    for (const alert of plan.create) dispatch({ type: 'addAlert', alert })
    for (const r of plan.resolve) dispatch({ type: 'resolveAlert', id: r.id, at: r.at })
  }, [state, now])

  const value = useMemo(() => ({ state, now, dispatch }), [state, now])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors de StoreProvider')
  return s
}

/** Amène l'horloge de démo à l'heure `hhmm` du jour simulé (en avançant ou en reculant). */
export function jumpTo(state: AppState, now: number, hhmm: string): Action {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return { type: 'clockJump', deltaMs: d.getTime() - now, realNow: Date.now() }
}
