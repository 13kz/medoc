'use client'

import { useState } from 'react'
import { deliveredAlerts, resolvedMessage } from '@medoc/lib/alerts'
import { changeTitle } from '@medoc/lib/changes'
import { formatGlucose, glucoseLevel } from '@medoc/lib/glucose'
import { dosesForDay } from '@medoc/lib/schedule'
import { daysLeft, needsRefill, stockLabel } from '@medoc/lib/stock'
import type { DisplayMode, Dose } from '@medoc/lib/types'
import { LIDS, lidOf } from '@/lib/box'
import { useStore } from '@/lib/store'
import { cx, hhmm, hm } from '@/lib/util'
import { Icon, type IconName } from '../ui/Icon'
import { Pill } from '../ui/Pill'

type Tab = 'jour' | 'alertes' | 'stock' | 'reglages'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'jour', label: 'Aujourd’hui', icon: 'heart' },
  { id: 'alertes', label: 'Alertes', icon: 'bell' },
  { id: 'stock', label: 'Stock', icon: 'box' },
  { id: 'reglages', label: 'Réglages', icon: 'settings' },
]

const STATUS: Record<Dose['status'], string> = {
  pris: 'Pris',
  'a-venir': 'À venir',
  'a-prendre': 'C’est l’heure',
  reporte: 'Reporté',
  'en-retard': 'Pas encore pris',
}

/**
 * Le téléphone d'un proche. Il veut savoir une chose : est-ce que tout va bien ?
 * Il reçoit une alerte seulement quand une prise n'est pas faite après la relance,
 * gère le stock et règle le téléphone du patient. Il ne voit pas les réglages cliniques.
 */
export function FamilyView() {
  const { state, now, dispatch } = useStore()
  const [tab, setTab] = useState<Tab>('jour')
  const p = state.patient
  const doses = dosesForDay(state, now)
  const alerts = deliveredAlerts(state, now)
  const open = alerts.filter((a) => !a.resolvedAt && !a.doseKey.startsWith('glycemie'))
  const unread = alerts.filter((a) => !a.read).length
  const refill = state.medications.filter((m) => needsRefill(m, state.settings.refillDays))
  const done = doses.filter((d) => d.status === 'pris').length
  const late = doses.filter((d) => d.status === 'en-retard')

  const lateDose = open.length ? doses.find((d) => d.key === open[0].doseKey) : undefined
  let tone: 'ok' | 'wait' | 'alert' = 'ok'
  let headline = `Tout va bien.`
  let sub = `${done} prise${done > 1 ? 's' : ''} sur ${doses.length} faite${done > 1 ? 's' : ''} aujourd’hui.`
  if (open.length) {
    tone = 'alert'
    headline = open[0].message
    sub = `${p.name} a été relancée sur son téléphone, sans réponse.`
  } else if (late.length) {
    tone = 'wait'
    headline = `Petit retard, ${p.name} a été relancée.`
    sub = 'Vous serez prévenu si la prise n’est toujours pas faite.'
  }

  return (
    <div className="fm">
      <header className="fm-top">
        <div className="fm-who">
          <span className="fm-avatar">M</span>
          <div>
            <strong>{p.name}</strong>
            <small>Suivi par Naz · {hm(now)}</small>
          </div>
        </div>
        <span className="fm-sync" title="Dossier synchronisé">
          <i /> en direct
        </span>
      </header>

      <div className="fm-body">
        {tab === 'jour' && (
          <>
            <section className={cx('fm-status', `is-${tone}`)}>
              <span className="fm-status-icon">
                <Icon name={tone === 'ok' ? 'check' : tone === 'wait' ? 'snooze' : 'alert'} size={22} stroke={2.4} />
              </span>
              <div>
                <p className="fm-status-head">{headline}</p>
                <p className="fm-status-sub">{sub}</p>
              </div>
              {tone === 'alert' && (
                <div className="fm-status-actions">
                  <a className="fm-btn fm-btn-light" href="tel:+33600000000" onClick={(e) => e.preventDefault()}>
                    <Icon name="phone" size={16} /> Appeler {p.name}
                  </a>
                  {lateDose && (
                    <button className="fm-btn fm-btn-light" onClick={() => dispatch({ type: 'take', doseKey: lateDose.key, by: 'aidant', at: now })}>
                      Je l’ai vue le prendre
                    </button>
                  )}
                </div>
              )}
            </section>

            <ol className="fm-line">
              {doses.map((d) => {
                const lid = LIDS.find((l) => l.id === lidOf(d.time))!
                return (
                  <li key={d.key} data-status={d.status} style={{ ['--tone' as string]: lid.tone }}>
                    <span className="fm-line-time">{hhmm(d.time)}</span>
                    <span className="fm-line-dot" />
                    <Pill med={d.med} size="sm" />
                    <span className="fm-line-name">
                      {d.med.name}
                      <small>
                        {STATUS[d.status]}
                        {d.intake && ` à ${hm(Date.parse(d.intake.takenAt))}${d.intake.by === 'aidant' ? ' (noté par un proche)' : ''}`}
                      </small>
                    </span>
                  </li>
                )
              })}
            </ol>

            {state.notes.slice(0, 1).map((n) => (
              <section key={n.id} className="fm-card fm-note">
                <p className="fm-card-kicker">
                  <Icon name="stethoscope" size={15} /> Conseil de {n.from}
                </p>
                <p>{n.text}</p>
                <p className={cx('fm-ack', n.acknowledged && 'is-ok')}>{n.acknowledged ? `${p.name} l’a lu ✓` : `${p.name} ne l’a pas encore lu`}</p>
              </section>
            ))}
            {state.changes.slice(0, 1).map((c) => (
              <section key={c.id} className="fm-card">
                <p className="fm-card-kicker">
                  <Icon name="list" size={15} /> Traitement modifié
                </p>
                <p>{changeTitle(c)}</p>
                <p className="fm-muted">{c.details.join(' · ')}</p>
              </section>
            ))}
            {refill.length > 0 && (
              <button className="fm-card fm-refill" onClick={() => setTab('stock')}>
                <Icon name="box" size={18} />
                <span>
                  <strong>{refill[0].name}</strong> : {stockLabel(refill[0]).toLowerCase()}
                </span>
                <Icon name="chevron" size={16} />
              </button>
            )}
          </>
        )}

        {tab === 'alertes' && (
          <section>
            <h3 className="fm-h">Alertes reçues</h3>
            {alerts.length === 0 ? (
              <p className="fm-empty">
                Aucune alerte aujourd’hui. Medoc vous prévient seulement si {p.name} ne répond pas à la relance, {state.settings.lateAfterMin + state.settings.escalateAfterMin} minutes après l’heure prévue.
              </p>
            ) : (
              <ul className="fm-alerts">
                {alerts.map((a) => {
                  const ok = resolvedMessage(state, a)
                  return (
                    <li key={a.id} className={cx(ok && 'is-ok')}>
                      <span className="fm-alert-time">{hm(Date.parse(a.deliverAt))}</span>
                      <p>{a.message}</p>
                      {ok && <p className="fm-alert-ok">✓ {ok}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
            {state.glucose.length > 0 && (
              <>
                <h3 className="fm-h">Dernières glycémies</h3>
                <ul className="fm-gly">
                  {state.glucose.slice(0, 4).map((g) => (
                    <li key={g.id} data-level={glucoseLevel(state.settings, g.value)}>
                      <span>{new Date(g.at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                      <strong>{formatGlucose(g.value)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {tab === 'stock' && (
          <section>
            <h3 className="fm-h">Boîtes à la maison</h3>
            <ul className="fm-stock">
              {state.medications
                .filter((m) => m.active)
                .map((m) => {
                  const days = daysLeft(m)
                  const low = needsRefill(m, state.settings.refillDays)
                  return (
                    <li key={m.id} className={cx(low && 'is-low')}>
                      <Pill med={m} size="sm" />
                      <div>
                        <strong>{m.name}</strong>
                        <small>{m.stock ? stockLabel(m) : 'Stock non suivi'}</small>
                        {m.stock && days !== null && (
                          <span className="fm-gauge">
                            <i style={{ width: `${Math.min(100, (days / 30) * 100)}%` }} />
                          </span>
                        )}
                      </div>
                      {m.stock && (
                        <button className="fm-btn fm-btn-sm" onClick={() => dispatch({ type: 'restock', medId: m.id })}>
                          + 1 boîte
                        </button>
                      )}
                    </li>
                  )
                })}
            </ul>
          </section>
        )}

        {tab === 'reglages' && (
          <section className="fm-settings">
            <h3 className="fm-h">Le téléphone de {p.name}</h3>
            <div className="fm-seg" role="radiogroup" aria-label="Affichage">
              {(
                [
                  ['voix', 'Voix d’abord', 'ear'],
                  ['malvoyant', 'Gros caractères', 'eye'],
                  ['standard', 'Standard', 'list'],
                ] as [DisplayMode, string, IconName][]
              ).map(([id, label, icon]) => (
                <button key={id} role="radio" aria-checked={p.displayMode === id} className={cx(p.displayMode === id && 'is-on')} onClick={() => dispatch({ type: 'patient', patch: { displayMode: id } })}>
                  <Icon name={icon} size={18} />
                  {label}
                </button>
              ))}
            </div>
            <label className="fm-toggle">
              <span>Tutoyer {p.name}</span>
              <input type="checkbox" checked={p.tutoiement} onChange={(e) => dispatch({ type: 'patient', patch: { tutoiement: e.target.checked } })} />
            </label>
            <label className="fm-toggle">
              <span>Lire les rappels à voix haute</span>
              <input type="checkbox" checked={p.autoRead} onChange={(e) => dispatch({ type: 'patient', patch: { autoRead: e.target.checked } })} />
            </label>
            <h3 className="fm-h">Quand me prévenir</h3>
            <div className="fm-chips">
              {[15, 30, 60].map((m) => (
                <button key={m} className={cx(state.settings.escalateAfterMin === m && 'is-on')} onClick={() => dispatch({ type: 'settings', patch: { escalateAfterMin: m } })}>
                  {m} min après la relance
                </button>
              ))}
            </div>
            <h3 className="fm-h">Personnes prévenues</h3>
            {state.contacts.map((c) => (
              <label key={c.id} className="fm-toggle">
                <span>{c.name}</span>
                <input type="checkbox" checked={c.notify} onChange={(e) => dispatch({ type: 'upsertContact', contact: { ...c, notify: e.target.checked } })} />
              </label>
            ))}
          </section>
        )}
      </div>

      <nav className="fm-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={cx(tab === t.id && 'is-on')}
            onClick={() => {
              setTab(t.id)
              if (t.id === 'alertes') dispatch({ type: 'readAlerts' })
            }}
          >
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
            {t.id === 'alertes' && unread > 0 && <b className="fm-badge">{unread}</b>}
          </button>
        ))}
      </nav>
    </div>
  )
}
