import { useState } from 'react'
import { ConfirmButton } from '../components/ConfirmButton'
import { FORMS } from '../lib/schedule'
import type { MedForm, Medication } from '../lib/types'

const QUICK_TIMES = [
  { label: 'Matin', time: '08:00' },
  { label: 'Midi', time: '12:30' },
  { label: 'Soir', time: '19:30' },
  { label: 'Coucher', time: '22:00' },
]

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
  const valid = draft.name.trim() !== '' && draft.dose.trim() !== '' && times.length > 0

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={med ? 'Modifier le médicament' : 'Ajouter un médicament'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ ...draft, name: draft.name.trim(), times, instructions: draft.instructions?.trim() || undefined })
        }}
      >
        <div className="sheet-head">
          <button type="button" className="ghost" onClick={onClose}>
            Annuler
          </button>
          <strong>{med ? 'Modifier' : 'Nouveau médicament'}</strong>
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
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Quantité à chaque prise</span>
          <input value={draft.dose} placeholder={DOSE_HINT[draft.form]} onChange={(e) => set({ dose: e.target.value })} />
        </label>

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
                  ✕
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
            + Autre heure
          </button>
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
