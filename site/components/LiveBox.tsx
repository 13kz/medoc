'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { boxWeek } from '@/lib/box'
import { useStore } from '@/lib/store'
import { useMounted } from '@/lib/util'

const PillBox = dynamic(() => import('./three/PillBox'), { ssr: false, loading: () => <div className="box-loading" aria-hidden="true" /> })

/** Le pilulier en 3D, relié au dossier de la démo. Une minute suffit pour le recalculer. */
export function LiveBox({ className, interactive = true, camera }: { className?: string; interactive?: boolean; camera?: [number, number, number] }) {
  const mounted = useMounted()
  const { state, now, dispatch } = useStore()
  const minute = Math.floor(now / 60000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => boxWeek(state, now), [state, minute])
  if (!mounted) return <div className={className}><div className="box-loading" aria-hidden="true" /></div>
  return (
    <PillBox
      className={className}
      days={days}
      interactive={interactive}
      camera={camera}
      onTake={(cell) => {
        for (const d of cell.doses) if (d.status !== 'pris' && d.status !== 'a-venir') dispatch({ type: 'take', doseKey: d.key, by: 'patient', at: now })
      }}
    />
  )
}
