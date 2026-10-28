import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * Garde le focus clavier dans une feuille modale tant qu'elle est ouverte, ferme avec Échap,
 * et rend le focus à l'élément qui l'a ouverte.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const opener = document.activeElement as HTMLElement | null
    const items = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[hidden]'))
    if (!root.contains(document.activeElement)) (items().find((el) => el.autofocus) ?? items()[0] ?? root).focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = items()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
    // onClose change à chaque rendu ; le piège ne dépend que de l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}
