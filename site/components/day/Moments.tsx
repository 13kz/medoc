'use client'

import { AnimatePresence, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { speak } from '@/lib/util'

/** Ajoute `data-in` quand l'élément entre dans l'écran : le CSS se charge du reste. */
export function InView({ children, className, as = 'div', amount = 0.3 }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article'; amount?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount })
  const Tag = as as 'div'
  return (
    <Tag ref={ref} className={className} data-in={seen}>
      {children}
    </Tag>
  )
}

const LINES = ['Bonjour Maman.', 'Il est 7 h 55.', 'Dans cinq minutes :', 'Metformine et Ramipril,', 'pendant le petit déjeuner.']

/** Le téléphone parle : des sous-titres qui arrivent au rythme d'une voix calme. */
export function Voice() {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (n >= LINES.length) return
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : 1100)
    return () => clearTimeout(t)
  }, [n])
  return (
    <div className="voice">
      <button className="voice-wave" onClick={() => speak(LINES.join(' '))} aria-label="Écouter la phrase à voix haute" data-on={n < LINES.length}>
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${(i % 5) * 0.11}s` }} />
        ))}
      </button>
      <p className="voice-lines" aria-live="polite">
        {LINES.map((l, i) => (
          <span key={l} data-on={i < n} data-last={i === n - 1}>
            {l}{' '}
          </span>
        ))}
      </p>
    </div>
  )
}

/**
 * Le geste de Mireille : appuyer longtemps sur « J'ai pris ».
 * L'appui long remplace la double confirmation de l'appli : impossible de valider par erreur.
 */
export function HoldToTake() {
  const [p, setP] = useState(0)
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    if (!done) setP(0)
  }
  const start = () => {
    if (done) return
    stop()
    const t0 = Date.now()
    timer.current = setInterval(() => {
      const v = Math.min(1, (Date.now() - t0) / 900)
      setP(v)
      if (v >= 1) {
        if (timer.current) clearInterval(timer.current)
        timer.current = null
        setDone(true)
        speak('C’est noté. Bravo, Maman.')
      }
    }, 16)
  }
  return (
    <div className="hold">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="ok" className="hold-done" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} role="status">
            <span className="hold-check">✓</span>
            <p>C’est noté. Bravo, Maman.</p>
            <p className="hold-small">Naz le voit déjà sur son téléphone. Personne n’a eu besoin d’appeler.</p>
            <button className="hold-again" onClick={() => { setDone(false); setP(0) }}>
              Recommencer
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="btn"
            className="hold-btn"
            style={{ ['--p' as string]: p }}
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={stop}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start()}
            onKeyUp={stop}
            exit={{ opacity: 0, y: 20 }}
          >
            <span className="hold-fill" aria-hidden="true" />
            <span className="hold-label">J’ai pris</span>
            <span className="hold-hint">{p > 0 ? 'Gardez le doigt…' : 'Appuyez longtemps'}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

/** L'écran verrouillé de Naz : les notifications arrivent, puis la première se ferme d'elle-même. */
export function LockScreen() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (step >= 3) return
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 500 : 1800)
    return () => clearTimeout(t)
  }, [inView, step])

  return (
    <div className="lock" ref={ref}>
      <div className="lock-top">
        <span className="lock-date">jeudi 6 novembre</span>
        <span className="lock-time">{step >= 2 ? '9:10' : '9:00'}</span>
      </div>
      <div className="lock-stack">
        <AnimatePresence initial={false}>
          {step >= 2 && (
            <motion.div key="ok" layout className="lock-notif is-ok" initial={{ opacity: 0, y: -30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
              <span className="lock-app" />
              <div>
                <p className="lock-head">
                  Medoc <small>maintenant</small>
                </p>
                <p>Maman a pris Ramipril à 9 h 10.</p>
              </div>
            </motion.div>
          )}
          {step >= 1 && (
            <motion.div key="alert" layout className="lock-notif" data-closed={step >= 2} initial={{ opacity: 0, y: -30, scale: 0.96 }} animate={{ opacity: step >= 2 ? 0.45 : 1, y: 0, scale: step >= 2 ? 0.94 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
              <span className="lock-app" />
              <div>
                <p className="lock-head">
                  Medoc <small>{step >= 2 ? 'il y a 10 min' : 'maintenant'}</small>
                </p>
                <p>Maman n’a pas encore pris Ramipril (prévu à 8 h). Elle a été relancée.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {step >= 3 && (
          <motion.p className="lock-quiet" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Aucune autre notification aujourd’hui.
          </motion.p>
        )}
      </div>
      <button className="lock-replay" onClick={() => setStep(0)}>
        Rejouer
      </button>
    </div>
  )
}
