import { useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { formatGlucose } from '../lib/glucose'
import { canSpeak, speak } from '../lib/platform'
import { useStore } from '../lib/store'
import type { ContactRole, DisplayMode } from '../lib/types'

const MODES: { id: DisplayMode; icon: IconName; title: string; desc: string }[] = [
  { id: 'voix', icon: 'speaker', title: 'Voix d’abord', desc: 'Ne voit pas ou presque. Le téléphone parle, deux très grands boutons.' },
  { id: 'malvoyant', icon: 'glass', title: 'Gros caractères', desc: 'Cataracte, glaucome. Texte très grand, jaune sur noir, une chose à la fois.' },
  { id: 'standard', icon: 'eye', title: 'Standard', desc: 'Voit bien. La journée en liste, avec des cases à cocher.' },
]

const ROLES: { id: ContactRole; label: string; icon: IconName }[] = [
  { id: 'famille', label: 'Famille', icon: 'heart' },
  { id: 'medecin', label: 'Médecin', icon: 'stethoscope' },
  { id: 'tiers', label: 'Personne de confiance', icon: 'user' },
]

export function SettingsTab() {
  const { state, dispatch } = useStore()
  const { patient, settings, contacts } = state
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<ContactRole>('famille')

  return (
    <section aria-label="Réglages" className="cg-stack cg-settings">
      <h2 className="cg-title">Réglages</h2>

      <div className="group">
        <h3>Son téléphone</h3>
        <label className="field" htmlFor="patient-name">
          <span>Prénom ou surnom affiché</span>
          <input id="patient-name" value={patient.name} onChange={(e) => dispatch({ type: 'patient', patch: { name: e.target.value } })} />
        </label>
        <fieldset className="field">
          <legend>Affichage</legend>
          <div className="mode-cards">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-card mc-${m.id}`}
                aria-pressed={patient.displayMode === m.id}
                onClick={() => dispatch({ type: 'patient', patch: { displayMode: m.id } })}
              >
                <span className="mc-icon">
                  <Icon name={m.icon} size={22} />
                </span>
                <span className="mc-text">
                  <strong>{m.title}</strong>
                  <span>{m.desc}</span>
                </span>
                <span className="mc-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="group">
        <h3>Voix</h3>
        <label className="switch">
          <span>Lire à voix haute à l’heure de la prise</span>
          <input
            type="checkbox"
            role="switch"
            checked={patient.autoRead}
            onChange={(e) => dispatch({ type: 'patient', patch: { autoRead: e.target.checked } })}
          />
        </label>
        <label className="switch">
          <span>
            Tutoyer
            <small>{patient.tutoiement ? '« Tu dois prendre… »' : '« Vous devez prendre… »'}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={patient.tutoiement}
            onChange={(e) => dispatch({ type: 'patient', patch: { tutoiement: e.target.checked } })}
          />
        </label>
        <label className="field" htmlFor="voice-rate">
          <span>
            Vitesse de la voix <em>{patient.voiceRate < 0.85 ? 'lente' : patient.voiceRate > 1.05 ? 'rapide' : 'normale'}</em>
          </span>
          <input
            id="voice-rate"
            type="range"
            min={0.6}
            max={1.3}
            step={0.1}
            value={patient.voiceRate}
            onChange={(e) => dispatch({ type: 'patient', patch: { voiceRate: Number(e.target.value) } })}
          />
        </label>
        {canSpeak() && (
          <button
            className="secondary"
            onClick={() => speak(`Bonjour ${patient.name}. C’est l’heure de ${patient.tutoiement ? 'ton' : 'votre'} médicament.`, patient.voiceRate)}
          >
            <Icon name="play" size={16} />
            Écouter un exemple
          </button>
        )}
      </div>

      <div className="group">
        <h3>Rappels</h3>
        <label className="field" htmlFor="late-after">
          <span>Relancer {patient.name} après</span>
          <select id="late-after" value={settings.lateAfterMin} onChange={(e) => dispatch({ type: 'settings', patch: { lateAfterMin: Number(e.target.value) } })}>
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minutes de retard
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="escalate-after">
          <span>Puis prévenir les proches</span>
          <select
            id="escalate-after"
            value={settings.escalateAfterMin}
            onChange={(e) => dispatch({ type: 'settings', patch: { escalateAfterMin: Number(e.target.value) } })}
          >
            {[0, 15, 30, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'en même temps' : `${m} minutes plus tard`}
              </option>
            ))}
          </select>
        </label>
        <label className="switch">
          <span>
            Heures calmes
            <small>La nuit, les alertes aux proches attendent le matin.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.quietHours}
            onChange={(e) => dispatch({ type: 'settings', patch: { quietHours: e.target.checked } })}
          />
        </label>
        {settings.quietHours && (
          <div className="field-row">
            <label className="field" htmlFor="quiet-from">
              <span>De</span>
              <input
                id="quiet-from"
                type="time"
                value={settings.quietFrom}
                onChange={(e) => e.target.value && dispatch({ type: 'settings', patch: { quietFrom: e.target.value } })}
              />
            </label>
            <label className="field" htmlFor="quiet-to">
              <span>À</span>
              <input
                id="quiet-to"
                type="time"
                value={settings.quietTo}
                onChange={(e) => e.target.value && dispatch({ type: 'settings', patch: { quietTo: e.target.value } })}
              />
            </label>
          </div>
        )}
        <label className="field" htmlFor="refill">
          <span>Prévenir pour racheter quand il reste</span>
          <select id="refill" value={settings.refillDays} onChange={(e) => dispatch({ type: 'settings', patch: { refillDays: Number(e.target.value) } })}>
            {[3, 5, 7, 10, 14].map((d) => (
              <option key={d} value={d}>
                moins de {d} jours
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="snooze">
          <span>« Plus tard » reporte de</span>
          <select id="snooze" value={settings.snoozeMin} onChange={(e) => dispatch({ type: 'settings', patch: { snoozeMin: Number(e.target.value) } })}>
            {[5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.medications.some((m) => m.glucose) && (
        <div className="group">
          <h3>Glycémie</h3>
          <div className="field-row">
            <label className="field" htmlFor="hypo">
              <span>Basse en dessous de</span>
              <select id="hypo" value={settings.hypoBelow} onChange={(e) => dispatch({ type: 'settings', patch: { hypoBelow: Number(e.target.value) } })}>
                {[0.6, 0.7, 0.8].map((v) => (
                  <option key={v} value={v}>
                    {formatGlucose(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="hyper">
              <span>Haute au-dessus de</span>
              <select id="hyper" value={settings.hyperAbove} onChange={(e) => dispatch({ type: 'settings', patch: { hyperAbove: Number(e.target.value) } })}>
                {[2, 2.5, 3].map((v) => (
                  <option key={v} value={v}>
                    {formatGlucose(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="cg-help">Hors de ces seuils, les proches qui ont activé les alertes sont prévenus aussitôt, même la nuit.</p>
        </div>
      )}

      <div className="group">
        <h3>Personnes à prévenir</h3>
        <ul className="contacts">
          {contacts.map((c) => {
            const role = ROLES.find((r) => r.id === c.role) ?? ROLES[2]
            return (
              <li key={c.id}>
                <span className={`ct-icon ct-${c.role}`}>
                  <Icon name={role.icon} size={18} />
                </span>
                <span className="ct-text">
                  <strong>{c.name}</strong>
                  <span>{role.label}</span>
                </span>
                <label className="switch compact" title="Recevoir les alertes">
                  <span className="sr-only">Alertes pour {c.name}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={c.notify}
                    onChange={(e) => dispatch({ type: 'upsertContact', contact: { ...c, notify: e.target.checked } })}
                  />
                </label>
                <button className="icon-btn" aria-label={`Retirer ${c.name}`} onClick={() => dispatch({ type: 'deleteContact', id: c.id })}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            )
          })}
        </ul>
        <form
          className="add-contact"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            dispatch({
              type: 'upsertContact',
              contact: { id: `c-${Date.now().toString(36)}`, name: newName.trim(), role: newRole, notify: true },
            })
            setNewName('')
          }}
        >
          <input id="contact-name" value={newName} placeholder="Nom" aria-label="Nom du contact" onChange={(e) => setNewName(e.target.value)} />
          <select id="contact-role" value={newRole} aria-label="Rôle" onChange={(e) => setNewRole(e.target.value as ContactRole)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button className="primary" type="submit" aria-label="Ajouter le contact">
            <Icon name="plus" size={18} stroke={2.6} />
          </button>
        </form>
      </div>
    </section>
  )
}
