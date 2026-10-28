import { useState } from 'react'
import { Icon } from '../components/Icon'
import { formatGlucose, parseGlucose } from '../lib/glucose'
import { canListen, listenOnce } from '../lib/platform'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']

/**
 * Saisie de la glycémie avant une prise : un pavé géant en g/L, ou la voix.
 * En mode voix, seul le bouton « Dire ma glycémie » est affiché.
 */
export function GlucoseEntry({
  voiceFirst,
  onValue,
  onSkip,
  say,
}: {
  voiceFirst: boolean
  onValue: (value: number) => void
  onSkip: () => void
  say: (text: string) => void
}) {
  const [typed, setTyped] = useState('')
  const [listening, setListening] = useState(false)
  const value = parseGlucose(typed)

  const press = (k: string) => {
    if (k === '⌫') return setTyped((t) => t.slice(0, -1))
    if (k === ',' && (typed.includes(',') || typed === '')) return
    if (typed.replace(',', '').length >= 3) return
    setTyped((t) => t + k)
  }

  const dictate = () => {
    if (listening) return
    setListening(true)
    listenOnce((text) => {
      setListening(false)
      const v = text ? parseGlucose(text.split(' | ')[0]) : null
      if (v === null) return say('Je n’ai pas compris. Dites par exemple : 1 gramme 20.')
      onValue(v)
    })
  }

  return (
    <div className="p-glu">
      <p className="p-glu-title">
        <Icon name="water" size="1.2em" stroke={2.4} />
        D’abord, la glycémie
      </p>
      {!voiceFirst && (
        <>
          <output className={`p-glu-display ${typed ? '' : 'empty'}`} aria-live="polite">
            {typed ? `${typed} g/L` : 'ex. 1,25 g/L'}
          </output>
          <div className="p-keypad" role="group" aria-label="Pavé numérique">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => press(k)} aria-label={k === '⌫' ? 'Effacer' : k === ',' ? 'Virgule' : k}>
                {k}
              </button>
            ))}
          </div>
          <button className="p-btn p-take" disabled={value === null} onClick={() => value !== null && onValue(value)}>
            <Icon name="check" size="1.3em" stroke={3.2} />
            {value === null ? 'Valider' : `Valider ${formatGlucose(value)}`}
          </button>
        </>
      )}
      {canListen() && (
        <button className={`p-btn ${voiceFirst ? 'p-take' : 'p-ghost'} ${listening ? 'on' : ''}`} onClick={dictate} aria-pressed={listening}>
          <Icon name="mic" size="1.2em" />
          {listening ? 'J’écoute…' : 'Dire ma glycémie'}
        </button>
      )}
      <button className="p-btn p-ghost" onClick={onSkip}>
        Je ne peux pas la mesurer
      </button>
    </div>
  )
}
