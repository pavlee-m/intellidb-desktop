import { CircleQuestionMark } from 'lucide-react'
import type { CliProvider } from '@/lib/cliCommand'
import { cn } from '@/lib/utils'
import cursorLogo from '@/assets/cursor.svg'
import opencodeLogo from '@/assets/opencode.svg'

const PROVIDER_ICONS: Record<CliProvider, { src: string; alt: string; className: string }> = {
  cursor: {
    src: cursorLogo,
    alt: 'Cursor provider',
    // Cursor's SVG fill is #edecec, so it vanishes on the light sidebar without a dark chip.
    className: 'rounded-sm bg-neutral-900 p-px',
  },
  opencode: { src: opencodeLogo, alt: 'OpenCode provider', className: '' },
}

function lookupProviderIcon(provider: string) {
  if (provider === 'cursor' || provider === 'opencode') {
    return PROVIDER_ICONS[provider]
  }
  return null
}

interface ProviderIconProps {
  provider: string
  className?: string
}

export default function ProviderIcon({ provider, className }: ProviderIconProps) {
  const icon = lookupProviderIcon(provider)

  if (icon) {
    return (
      <img
        src={icon.src}
        alt={icon.alt}
        className={cn(className, icon.className)}
      />
    )
  }

  return (
    <CircleQuestionMark
      aria-label="No provider selected"
      className={cn(className, 'text-muted-foreground')}
    />
  )
}
