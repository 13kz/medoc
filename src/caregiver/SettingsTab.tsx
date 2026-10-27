import { useState } from 'react'
import { canSpeak, speak } from '../lib/platform'
import { useStore } from '../lib/store'
import type { ContactRole, DisplayMode } from '../lib/types'

const MODES: { id: DisplayMode; title: string; desc: string }[] = [
  { id: 'voix', title: '🔊 Voix d’abord', desc: 'Ne voit pas ou presque. Le téléphone parle, deux énormes boutons.' },
  { id: 'malvoyant', title: '🔍 Gros caractères', desc: 'Cataracte, glaucome. Très gros texte, fort contraste, une chose à la fois.' },
  { id: 'standard', title: '👓 Standard', desc: 'Voit bien. Liste de la journée avec cases à cocher.' },
]

const ROLES: { id: ContactRole; label: string }[] = [
  { id: 'famille', label: 'Famille' },
  { id: 'medecin', label: 'Médecin' },
  { id: 'tiers', label: 'Personne de confiance' },
]

export function SettingsTab() {
  const { state, dispatch } = useStore()
  const { patient, settings, contacts } = state
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<ContactRole>('famille')

  return (
    <section aria-label="Réglages" className="cg-settings">
      <h2>Patient</h2>
      <label className="field">
        <span>Prénom ou surnom affiché</span>
        <input value={patient.name} onChange={(e) => dispatch({ type: 'patient', patch: { name: e.target.value } })} />
      </label>

      <fieldset className="field">
        <legend>Affichage sur son téléphone</legend>
        <div className="mode-cards">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="mode-card"
              aria-pressed={patient.displayMode === m.id}
              onClick={() => dispatch({ type: 'patient', patch: { displayMode: m.id } })}
            >
              <strong>{m.title}</strong>
              <span>{m.desc}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="toggle">
        <input
          type="checkbox"
          checked={patient.autoRead}
          onChange={(e) => dispatch({ type: 'patient', patch: { autoRead: e.target.checked } })}
        />
        <span>Lire à voix haute à l’heure de la prise</span>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={patient.tutoiement}
          onChange={(e) => dispatch({ type: 'patient', patch: { tutoiement: e.target.checked } })}
        />
        <span>Tutoyer ({patient.tutoiement ? '« Tu dois prendre… »' : '« Vous devez prendre… »'})</span>
      </label>

      <label className="field">
        <span>Vitesse de la voix : {patient.voiceRate.toFixed(1)}</span>
        <input
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
          className="ghost"
          onClick={() => speak(`Bonjour ${patient.name}. C’est l’heure de ${patient.tutoiement ? 'ton' : 'votre'} médicament.`, patient.voiceRate)}
        >
          ▶︎ Tester la voix
        </button>
      )}

      <h2>Rappels</h2>
      <label className="field">
        <span>Alerter les proches après</span>
        <select value={settings.lateAfterMin} onChange={(e) => dispatch({ type: 'settings', patch: { lateAfterMin: Number(e.target.value) } })}>
          {[15, 30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {m} min de retard
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>« Plus tard » reporte de</span>
        <select value={settings.snoozeMin} onChange={(e) => dispatch({ type: 'settings', patch: { snoozeMin: Number(e.target.value) } })}>
          {[5, 10, 15, 30].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </label>

      <h2>Personnes à prévenir</h2>
      <ul className="cg-list">
        {contacts.map((c) => (
          <li key={c.id} className="cg-contact">
            <span className="cg-dose-text">
              <strong>{c.name}</strong>
              <span className="muted small">{ROLES.find((r) => r.id === c.role)?.label}</span>
            </span>
            <label className="toggle compact">
              <input
                type="checkbox"
                checked={c.notify}
                onChange={(e) => dispatch({ type: 'upsertContact', contact: { ...c, notify: e.target.checked } })}
              />
              <span>Alertes</span>
            </label>
            <button className="ghost small-btn" aria-label={`Retirer ${c.name}`} onClick={() => dispatch({ type: 'deleteContact', id: c.id })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="cg-add-contact"
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
        <input value={newName} placeholder="Nom" aria-label="Nom du contact" onChange={(e) => setNewName(e.target.value)} />
        <select value={newRole} aria-label="Rôle" onChange={(e) => setNewRole(e.target.value as ContactRole)}>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <button className="primary" type="submit">
          Ajouter
        </button>
      </form>
    </section>
  )
}
