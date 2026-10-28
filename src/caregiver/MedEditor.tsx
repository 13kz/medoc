import { useState } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { FORMS, addDays, dayKey } from '../lib/schedule'
import type { MedForm, Medication, Rhythm } from '../lib/types'

const QUICK_TIMES = [
  { label: 'Matin', time: '08:00' },
  { label: 'Midi', time: '12:30' },
  { label: 'Soir', time: '19:30' },
  { label: 'Coucher', time: '22:00' },
]

/** Lundi d'abord, comme sur un semainier. */
const WEEK = [
  { d: 1, label: 'Lun' },
  { d: 2, label: 'Mar' },
  { d: 3, label: 'Mer' },
  { d: 4, label: 'Jeu' },
  { d: 5, label: 'Ven' },
  { d: 6, label: 'Sam' },
  { d: 0, label: 'Dim' },
]

const DURATIONS = [5, 7, 10, 14, 30]

const COLORS = ['#ffffff', '#f2a33a', '#e64545', '#3fb37f', '#2f8fd8', '#8e5bd6', '#f5d33a', '#e8e1cf']

const DOSE_HINT: Record<MedForm, string> = {
  comprime: '1 comprimé',
  gelule: '1 gélule',
  sachet: '1 sachet',
  injection: '10 unités',
  gouttes: '1 goutte dans chaque œil',
  autre: '1 dose',
}

/** Feuille de saisie d'un médicament, ouverte depuis le bas de l'écran. */
export function MedEditor({
  med,
  now,
  onSave,
  onClose,
  onDelete,
}: {
  med?: Medication
  now: number
  onSave: (m: Medication) => void
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<Medication>(
    med ?? {
      id: `med-${Date.now().toString(36)}`,
      name: '',
      form: 'comprime',
      dose: '1 comprimé',
      times: ['08:00'],
      color: '#ffffff',
      active: true,
      since: new Date(now).toISOString(),
    },
  )
  const set = (patch: Partial<Medication>) => setDraft((d) => ({ ...d, ...patch }))
  const times = [...new Set(draft.times)].sort()
  const today = dayKey(now)
  const rhythm: Rhythm = draft.rhythm ?? { kind: 'daily' }
  const setRhythm = (r: Rhythm) => set({ rhythm: r.kind === 'daily' ? undefined : r })
  const validRhythm = rhythm.kind !== 'weekdays' || rhythm.days.length > 0
  const validDates = !draft.startDate || !draft.endDate || draft.startDate <= draft.endDate
  const prn = draft.asNeeded
  const valid = draft.name.trim() !== '' && draft.dose.trim() !== '' && (prn || times.length > 0) && validRhythm && validDates
  const durationDays = draft.endDate ? Math.round((Date.parse(draft.endDate) - Date.parse(draft.startDate ?? today)) / 86400000) + 1 : null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={med ? 'Modifier le médicament' : 'Ajouter un médicament'}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ ...draft, name: draft.name.trim(), times: prn ? [] : times, instructions: draft.instructions?.trim() || undefined })
        }}
      >
        <div className="sheet-head">
          <button type="button" className="ghost" onClick={onClose}>
            Annuler
          </button>
          <strong>{med ? 'Modifier' : 'Nouveau médicament'}</strong>
          <span className="sheet-grip" aria-hidden="true" />
          <button type="submit" className="primary" disabled={!valid}>
            Enregistrer
          </button>
        </div>

        <label className="field">
          <span>Nom et dosage</span>
          <input
            autoFocus={!med}
            value={draft.name}
            placeholder="ex. Metformine 1000 mg"
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>

        <fieldset className="field">
          <legend>Forme</legend>
          <div className="chips">
            {FORMS.map((f) => (
              <button
                type="button"
                key={f.id}
                aria-pressed={draft.form === f.id}
                onClick={() => set({ form: f.id, dose: draft.dose === DOSE_HINT[draft.form] ? DOSE_HINT[f.id] : draft.dose })}
              >
                <Pill med={{ ...draft, form: f.id }} size="xs" />
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Quantité à chaque prise</span>
          <input value={draft.dose} placeholder={DOSE_HINT[draft.form]} onChange={(e) => set({ dose: e.target.value })} />
        </label>

        <label className="switch">
          <span>
            Si besoin
            <small>Sans heure fixe : la personne le prend à la demande (douleur, fièvre…).</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={!!prn}
            onChange={(e) => set({ asNeeded: e.target.checked ? { maxPerDay: 3, minGapH: 6 } : undefined })}
          />
        </label>

        {prn ? (
          <div className="field-row">
            <label className="field">
              <span>Au plus, par 24 h</span>
              <select value={prn.maxPerDay} onChange={(e) => set({ asNeeded: { ...prn, maxPerDay: Number(e.target.value) } })}>
                {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} fois
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Écart minimal</span>
              <select value={prn.minGapH} onChange={(e) => set({ asNeeded: { ...prn, minGapH: Number(e.target.value) } })}>
                {[0, 1, 2, 4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? 'aucun' : `${n} h`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <>
          <fieldset className="field">
            <legend>Heures de prise</legend>
            <div className="chips">
              {QUICK_TIMES.map((q) => {
                const on = times.includes(q.time)
                return (
                  <button
                    type="button"
                    key={q.time}
                    aria-pressed={on}
                    onClick={() => set({ times: on ? times.filter((t) => t !== q.time) : [...times, q.time] })}
                  >
                    {q.label} {q.time}
                  </button>
                )
              })}
            </div>
            <ul className="times">
              {times.map((t) => (
                <li key={t}>
                  <input
                    type="time"
                    value={t}
                    aria-label="Heure"
                    onChange={(e) => e.target.value && set({ times: times.map((x) => (x === t ? e.target.value : x)) })}
                  />
                  <button type="button" className="ghost" aria-label={`Retirer ${t}`} onClick={() => set({ times: times.filter((x) => x !== t) })}>
                    <Icon name="close" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const free = ['09:00', '14:00', '16:00', '18:00', '20:00'].find((x) => !times.includes(x)) ?? '10:00'
                set({ times: [...times, free] })
              }}
            >
              <Icon name="plus" size={18} />
              Autre heure
            </button>
          </fieldset>

          <fieldset className="field">
            <legend>Jours de prise</legend>
            <div className="chips">
              <button type="button" aria-pressed={rhythm.kind === 'daily'} onClick={() => setRhythm({ kind: 'daily' })}>
                Tous les jours
              </button>
              <button
                type="button"
                aria-pressed={rhythm.kind === 'weekdays'}
                onClick={() => rhythm.kind !== 'weekdays' && setRhythm({ kind: 'weekdays', days: [new Date(now).getDay()] })}
              >
                Certains jours
              </button>
              <button
                type="button"
                aria-pressed={rhythm.kind === 'interval'}
                onClick={() => rhythm.kind !== 'interval' && setRhythm({ kind: 'interval', every: 2, from: draft.startDate ?? today })}
              >
                Un jour sur…
              </button>
            </div>
            {rhythm.kind === 'weekdays' && (
              <div className="chips week-chips" role="group" aria-label="Jours de la semaine">
                {WEEK.map(({ d, label }) => {
                  const on = rhythm.days.includes(d)
                  return (
                    <button
                      type="button"
                      key={d}
                      aria-pressed={on}
                      onClick={() => setRhythm({ kind: 'weekdays', days: on ? rhythm.days.filter((x) => x !== d) : [...rhythm.days, d] })}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
            {rhythm.kind === 'interval' && (
              <div className="field-row">
                <label className="field">
                  <span>Un jour sur</span>
                  <select value={rhythm.every} onChange={(e) => setRhythm({ ...rhythm, every: Number(e.target.value) })}>
                    {[2, 3, 7, 14].map((n) => (
                      <option key={n} value={n}>
                        {n === 7 ? '7 (une fois par semaine)' : n === 14 ? '14 (toutes les deux semaines)' : n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>À compter du</span>
                  <input type="date" value={rhythm.from} onChange={(e) => e.target.value && setRhythm({ ...rhythm, from: e.target.value })} />
                </label>
              </div>
            )}
          </fieldset>
          </>
        )}

        <fieldset className="field">
          <legend>Durée du traitement</legend>
          <div className="chips">
            <button type="button" aria-pressed={!draft.endDate} onClick={() => set({ endDate: undefined })}>
              Sans fin
            </button>
            {DURATIONS.map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={durationDays === n}
                onClick={() => set({ startDate: draft.startDate ?? today, endDate: addDays(draft.startDate ?? today, n - 1) })}
              >
                {n === 30 ? '1 mois' : `${n} jours`}
              </button>
            ))}
          </div>
          <div className="field-row">
            <label className="field">
              <span>Début</span>
              <input type="date" value={draft.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || undefined })} />
            </label>
            <label className="field">
              <span>Dernier jour</span>
              <input
                type="date"
                value={draft.endDate ?? ''}
                min={draft.startDate}
                aria-invalid={!validDates}
                onChange={(e) => set({ endDate: e.target.value || undefined })}
              />
            </label>
          </div>
          {!validDates && <p className="field-error">Le dernier jour est avant le début.</p>}
        </fieldset>

        <label className="field">
          <span>Consigne (lue à voix haute)</span>
          <input
            value={draft.instructions ?? ''}
            placeholder="ex. Pendant le repas"
            onChange={(e) => set({ instructions: e.target.value })}
          />
        </label>

        <fieldset className="field">
          <legend>Couleur de repère</legend>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className="swatch"
                style={{ background: c }}
                aria-label={`Couleur ${c}`}
                aria-pressed={draft.color === c}
                onClick={() => set({ color: c })}
              />
            ))}
          </div>
        </fieldset>

        <label className="toggle">
          <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
          <span>Traitement en cours</span>
        </label>

        {med && (
          <ConfirmButton className="ghost danger block" confirmLabel="Toucher à nouveau pour supprimer" onConfirm={() => onDelete(med.id)}>
            Supprimer de l’ordonnance
          </ConfirmButton>
        )}
      </form>
    </div>
  )
}
