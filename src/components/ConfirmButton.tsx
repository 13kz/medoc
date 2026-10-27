import { useEffect, useState, type ReactNode } from 'react'

/** Bouton en deux temps : le premier toucher demande confirmation, le second agit. */
export function ConfirmButton({
  onConfirm,
  confirmLabel,
  className,
  children,
}: {
  onConfirm: () => void
  confirmLabel: string
  className?: string
  children: ReactNode
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(id)
  }, [armed])
  return (
    <button
      type="button"
      className={`${className ?? ''} ${armed ? 'armed' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
