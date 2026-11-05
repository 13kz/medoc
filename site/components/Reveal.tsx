'use client'

import { motion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Reveal({ children, delay = 0, className, y = 28 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-12% 0px' }} transition={{ duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

/** Le pilulier du haut de page s'éloigne et bascule doucement quand on descend. */
export function HeroParallax({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 160])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.86])
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.2])
  return (
    <motion.div ref={ref} className={className} style={{ y, scale, opacity }}>
      {children}
    </motion.div>
  )
}

export function Nav() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`nav ${solid ? 'is-solid' : ''}`}>
      <a href="#top" className="nav-logo" aria-label="Medoc, accueil">
        <Logo />
        <span>medoc</span>
      </a>
      <nav aria-label="Sections">
        <a href="#regards">Trois regards</a>
        <a href="#prototype">Prototype</a>
        <a href="#journee">Une journée</a>
        <a href="#vision">Basse vision</a>
      </nav>
      <a href="#prototype" className="nav-cta">
        Essayer
      </a>
    </header>
  )
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#f4f1ea" />
      <rect x="5" y="5" width="10" height="10" rx="3.2" fill="#ffd43b" />
      <rect x="17" y="5" width="10" height="10" rx="3.2" fill="#ff9f43" />
      <rect x="5" y="17" width="10" height="10" rx="3.2" fill="#6cb4ff" />
      <rect x="17" y="17" width="10" height="10" rx="3.2" fill="#b69cff" />
    </svg>
  )
}
