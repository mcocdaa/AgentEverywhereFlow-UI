import { useEffect, type RefObject } from 'react'

/**
 * Roving-tabindex fallback for `focusgroup="toolbar wrap"`.
 * Only activates when native `focusGroup` is unsupported in the current WebView/browser.
 */
export function useToolbarRoving(toolbarRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const bar = toolbarRef.current
    if (!bar) return
    if (typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype) {
      return
    }

    const getItems = (): HTMLButtonElement[] =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))

    const syncInitial = () => {
      const items = getItems()
      if (items.length === 0) return
      const hasZero = items.some((b) => b.tabIndex === 0)
      if (!hasZero) {
        items.forEach((b, i) => {
          b.tabIndex = i === 0 ? 0 : -1
        })
      }
    }

    syncInitial()

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const items = getItems()
      if (!items.includes(target as HTMLButtonElement)) return
      items.forEach((b) => {
        b.tabIndex = b === target ? 0 : -1
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = getItems()
      if (items.length === 0) return
      const currentIndex = items.findIndex((b) => b === document.activeElement)
      if (currentIndex === -1) return

      const vertical = bar.getAttribute('aria-orientation') === 'vertical'
      const rtl = getComputedStyle(bar).direction === 'rtl'
      let nextIndex = -1

      if (!vertical) {
        if (event.key === 'ArrowRight') {
          nextIndex = (currentIndex + (rtl ? -1 : 1) + items.length) % items.length
        } else if (event.key === 'ArrowLeft') {
          nextIndex = (currentIndex + (rtl ? 1 : -1) + items.length) % items.length
        }
      } else if (event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % items.length
      } else if (event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + items.length) % items.length
      }

      if (event.key === 'Home') nextIndex = 0
      if (event.key === 'End') nextIndex = items.length - 1

      if (nextIndex !== -1) {
        event.preventDefault()
        items.forEach((b, i) => {
          b.tabIndex = i === nextIndex ? 0 : -1
        })
        items[nextIndex].focus()
      }
    }

    bar.addEventListener('focusin', handleFocusIn)
    bar.addEventListener('keydown', handleKeyDown)
    return () => {
      bar.removeEventListener('focusin', handleFocusIn)
      bar.removeEventListener('keydown', handleKeyDown)
    }
  }, [toolbarRef])
}
