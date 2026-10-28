import { useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { asNeededLabel } from '../lib/asNeeded'
import { recognizeText } from '../lib/ocr'
import { parsePrescription, type PrescriptionLine } from '../lib/prescription'
import { dayKey, rhythmLabel, shortDate, spokenTime } from '../lib/schedule'
import type { Medication } from '../lib/types'
import { useFocusTrap } from '../lib/useFocusTrap'
import { MedEditor } from './MedEditor'

type Step = 'source' | 'reading' | 'review'
type LineState = 'a-voir' | 'ajoute' | 'ignore'

const toMedication = (line: PrescriptionLine, i: number, now: number): Medication => ({
  id: `med-${now.toString(36)}-${i}`,
  color: '#ffffff',
  active: true,
  since: new Date(now).toISOString(),
  ...line.draft,
})

function summary(m: Medication): string {
  if (m.asNeeded) return `${m.dose}, ${asNeededLabel(m).toLowerCase()}`
  const parts = [m.dose, m.times.map(spokenTime).join(' et ')]
  if (m.rhythm) parts.push(rhythmLabel(m).toLowerCase())
  if (m.endDate) parts.push(`jusqu’au ${shortDate(m.endDate)}`)
  return parts.join(', ')
}

/**
 * Scan d'ordonnance : photo (ou texte collé), lecture, puis une proposition par médicament.
 * Chaque proposition s'ouvre dans l'éditeur habituel : rien n'entre dans l'ordonnance sans « Enregistrer ».
 */
export function PrescriptionScan({ now, onSave, onClose }: { now: number; onSave: (med: Medication) => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>('source')
  const [text, setText] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [states, setStates] = useState<LineState[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  useFocusTrap(sheet, onClose)

  const lines = useMemo(() => parsePrescription(text, dayKey(now)), [text, now])
  const meds = useMemo(() => lines.map((l, i) => toMedication(l, i, now)), [lines, now])

  const review = (t: string) => {
    setText(t)
    setStates(parsePrescription(t, dayKey(now)).map(() => 'a-voir'))
    setStep('review')
  }

  const read = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setProgress(0)
    setStep('reading')
    try {
      review(await recognizeText(file, setProgress))
    } catch {
      setError('Lecture impossible. Vérifiez la connexion (le premier scan télécharge le lecteur), ou collez le texte.')
      setStep('source')
    }
  }

  if (editing !== null) {
    return (
      <MedEditor
        draft={meds[editing]}
        now={now}
        onClose={() => setEditing(null)}
        onDelete={() => setEditing(null)}
        onSave={(med) => {
          onSave(med)
          setStates((s) => s.map((v, i) => (i === editing ? 'ajoute' : v)))
          setEditing(null)
        }}
      />
    )
  }

  const left = states.filter((s) => s === 'a-voir').length

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={sheet} tabIndex={-1} className="sheet scan" role="dialog" aria-modal="true" aria-label="Scanner une ordonnance" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button type="button" className="ghost" onClick={onClose}>
            {step === 'review' && left === 0 ? 'Fermer' : 'Annuler'}
          </button>
          <strong>Scanner une ordonnance</strong>
          <span className="sheet-grip" aria-hidden="true" />
          <span />
        </div>

        {step === 'source' && (
          <>
            <p className="cg-help">
              Photographiez l’ordonnance à plat, bien éclairée. Medoc propose chaque médicament ; vous vérifiez et validez ligne par ligne.
            </p>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => read(e.target.files?.[0])} />
            <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => read(e.target.files?.[0])} />
            <button className="primary block" onClick={() => camera.current?.click()}>
              <Icon name="eye" size={18} />
              Prendre en photo
            </button>
            <button className="secondary block" onClick={() => gallery.current?.click()}>
              Choisir une photo
            </button>
            {error && (
              <p className="share-error" role="alert">
                {error}
              </p>
            )}
            <label className="field" htmlFor="scan-text">
              <span>Ou collez le texte de l’ordonnance</span>
              <textarea id="scan-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Metformine 1000 mg\n1 cp matin et soir'} />
            </label>
            <button className="secondary block" disabled={!text.trim()} onClick={() => review(text)}>
              Lire le texte
            </button>
          </>
        )}

        {step === 'reading' && (
          <div className="scan-reading" role="status">
            <p>Lecture de l’ordonnance…</p>
            <div className="scan-bar" role="progressbar" aria-label="Lecture" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {step === 'review' && (
          <>
            {lines.length === 0 ? (
              <p className="cg-help" role="status">
                Aucun médicament reconnu. Corrigez le texte ci-dessous (une ligne par médicament, avec son dosage) ou reprenez la photo.
              </p>
            ) : (
              <p className="cg-help" role="status">
                {lines.length} médicament{lines.length > 1 ? 's' : ''} trouvé{lines.length > 1 ? 's' : ''}. Vérifiez chacun avant de l’ajouter.
              </p>
            )}
            <ul className="scan-lines">
              {lines.map((line, i) => (
                <li key={i} className={`scan-line is-${states[i] ?? 'a-voir'}`}>
                  <div className="scan-line-top">
                    <Pill med={meds[i]} size="sm" />
                    <span className="scan-line-text">
                      <strong>{line.name}</strong>
                      <span>{summary(meds[i])}</span>
                      {line.draft.instructions && <span>{line.draft.instructions}</span>}
                    </span>
                  </div>
                  {line.issues.length > 0 && (
                    <ul className="scan-issues">
                      {line.issues.map((x) => (
                        <li key={x}>
                          <Icon name="alert" size={14} stroke={2.2} />
                          {x}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="scan-raw">{line.raw}</p>
                  {states[i] === 'ajoute' ? (
                    <p className="scan-done">
                      <Icon name="check" size={16} stroke={2.6} />
                      Ajouté à l’ordonnance
                    </p>
                  ) : states[i] === 'ignore' ? (
                    <button className="ghost compact" onClick={() => setStates((s) => s.map((v, j) => (j === i ? 'a-voir' : v)))}>
                      Ignoré. Reprendre
                    </button>
                  ) : (
                    <div className="scan-actions">
                      <button className="primary" onClick={() => setEditing(i)}>
                        Vérifier et ajouter
                      </button>
                      <button className="ghost" onClick={() => setStates((s) => s.map((v, j) => (j === i ? 'ignore' : v)))}>
                        Ignorer
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <details className="scan-text">
              <summary>Texte lu sur la photo</summary>
              <label className="field" htmlFor="scan-fix">
                <span className="sr-only">Texte lu, à corriger</span>
                <textarea id="scan-fix" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <button className="secondary block" onClick={() => review(text)}>
                Relire le texte corrigé
              </button>
            </details>
            <button className="ghost block" onClick={() => setStep('source')}>
              Reprendre une photo
            </button>
          </>
        )}
      </div>
    </div>
  )
}
