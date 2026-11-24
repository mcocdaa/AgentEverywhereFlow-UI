import React, { useEffect, useRef } from 'react'

interface ModalDialogProps {
  isOpen: boolean
  onClose: () => void
  labelledBy: string
  className?: string
  children: React.ReactNode
}

/**
 * Accessible native <dialog> modal wrapper.
 * Uses showModal(), declarative closedby="any" with a pointer-bounds fallback
 * for browsers lacking HTMLDialogElement.prototype.closedBy, and resets
 * dialog.returnValue on close.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  labelledBy,
  className = '',
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Sync open/closed state with native showModal() / close() and bind native close listener
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return

    const handleClose = () => {
      dialog.returnValue = ''
      onCloseRef.current()
    }

    dialog.addEventListener('close', handleClose)
    if (!dialog.open) {
      dialog.showModal()
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  // Mandatory light-dismiss fallback for browsers without native dialog closedby support
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return
    if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
      return
    }

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }

    let pressedOutside = false
    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e)
    }
    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close()
      }
      pressedOutside = false
    }

    dialog.addEventListener('pointerdown', handlePointerDown)
    dialog.addEventListener('pointerup', handlePointerUp)
    return () => {
      dialog.removeEventListener('pointerdown', handlePointerDown)
      dialog.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      className={`aef-dialog ${className}`}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      {children}
    </dialog>
  )
}
