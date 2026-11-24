import { AppWindow, CornerDownLeft, Crop, Focus, Globe, Monitor } from 'lucide-react'
import type { TargetType } from '../lib/types'

export function AEFlowMark({ className = 'w-4 h-4' }: { className?: string }) {
  return <Focus className={className} aria-hidden="true" />
}

export function EnterReturnIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <CornerDownLeft className={className} aria-hidden="true" />
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
