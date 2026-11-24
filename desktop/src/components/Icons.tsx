import { AppWindow, Crop, Globe, Monitor } from 'lucide-react'
import type { TargetType } from '../lib/types'

export function AEFlowMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      <path d="M12 8.2 15.8 12 12 15.8 8.2 12 12 8.2Z" fill="currentColor" fillOpacity="0.22" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function EnterReturnIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15.5 4.5v5a2.5 2.5 0 0 1-2.5 2.5H5" />
      <path d="M8.5 8.5 5 12l3.5 3.5" />
    </svg>
  )
}

export function TargetTypeIcon({
  type,
  className = 'w-3.5 h-3.5',
}: {
  type: TargetType
  className?: string
}) {
  switch (type) {
    case 'display':
      return <Monitor className={className} aria-hidden="true" />
    case 'region':
      return <Crop className={className} aria-hidden="true" />
    case 'cdp':
      return <Globe className={className} aria-hidden="true" />
    case 'window':
    default:
      return <AppWindow className={className} aria-hidden="true" />
  }
}
