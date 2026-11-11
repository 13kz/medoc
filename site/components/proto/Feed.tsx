'use client'

import { AnimatePresence, motion } from 'motion/react'
import { changeTitle } from '@medoc/lib/changes'
import { formatGlucose } from '@medoc/lib/glucose'
import { dayKey } from '@medoc/lib/schedule'
import { useStore } from '@/lib/store'
import { hm } from '@/lib/util'

type Who = 'patient' | 'proches' | 'medecin'
interface Event {
  id: string
  at: number
  from: Who
  to: Who[]
  text: string
}

const NAMES: Record<Who, string> = { patient: 'Mireille', proches: 'Naz', medecin: 'Dr Martin' }

/** Le fil du dossier : ce qui passe d'un rôle à l'autre, en direct. */
export function Feed() {
  const { state, now } = useStore()
  const today = dayKey(now)
  const events: Event[] = []
  for (const [key, it] of Object.entries(state.intakes)) {
    if (!key.startsWith(today)) continue
    const at = Date.parse(it.takenAt)
    if (at > now) continue
    const med = state.medications.find((m) => m.id === key.split('|')[1])
    events.push({ id: key, at, from: it.by === 'aidant' ? 'proches' : 'patient', to: ['proches', 'medecin'], text: `${med?.name.replace(/ \d.*$/, '') ?? 'Prise'} pris` })
  }
  for (const a of state.alerts) {
    const at = Date.parse(a.deliverAt)
    if (dayKey(at) !== today || at > now) continue
    const med = state.medications.find((m) => m.id === a.doseKey.split('|')[1])?.name.replace(/ \d.*$/, '')
    const what = a.doseKey.startsWith('glycemie') ? 'glycémie hors des seuils' : med ?? ''
    events.push({ id: a.id, at, from: 'patient', to: a.level === 'rappel' ? ['patient'] : ['proches'], text: `${a.level === 'rappel' ? 'Relance' : 'Alerte aux proches'} · ${what}${a.doseKey.startsWith(today) ? '' : ' d’hier'}` })
  }
  for (const n of state.notes) events.push({ id: n.id, at: Date.parse(n.at), from: 'medecin', to: ['patient', 'proches'], text: n.acknowledged ? 'Conseil envoyé, lu par Mireille' : 'Conseil envoyé' })
  for (const c of state.changes) events.push({ id: c.id, at: Date.parse(c.at), from: 'medecin', to: ['patient', 'proches'], text: changeTitle(c).replace('Dr Martin ', '') })
  for (const g of state.glucose) {
    const at = Date.parse(g.at)
    if (dayKey(at) === today && at <= now) events.push({ id: g.id, at, from: 'patient', to: ['proches', 'medecin'], text: `Glycémie ${formatGlucose(g.value)}` })
  }
  events.sort((a, b) => b.at - a.at)

  return (
    <div className="feed">
      <p className="feed-h">
        <i /> Le fil du dossier
      </p>
      {events.length === 0 ? (
        <p className="feed-empty">Rien encore aujourd’hui. Faites une prise, avancez l’heure ou envoyez un conseil.</p>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {events.slice(0, 6).map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="feed-time">{hm(e.at)}</span>
                <span className="feed-who" data-who={e.from}>
                  {NAMES[e.from]}
                </span>
                <span className="feed-text">{e.text}</span>
                <span className="feed-to">
                  {e.to.map((t) => (
                    <i key={t} data-who={t} title={NAMES[t]} />
                  ))}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
