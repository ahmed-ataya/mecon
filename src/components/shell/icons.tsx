/**
 * Minimal 16x16 stroke icons for the sidebar — generic geometric shapes
 * (a rectangle, a circle-and-arc for a person), not brand or third-party
 * iconography, so there's nothing to license here.
 */

type IconProps = { className?: string }

/** Opacity is set by the caller (Sidebar knows whether the item is
 * active) rather than a CSS group-selector — simpler to reason about
 * than relying on `aria-current` munging through Tailwind's group
 * variants for a one-off opacity bump. */
const base = 'h-[15px] w-[15px] shrink-0 stroke-current fill-none stroke-[1.6]'

export function IconContract({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3" />
    </svg>
  )
}

export function IconLpo({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M3 3h10v10H3z" />
      <path d="M6 7h4M6 10h4" />
    </svg>
  )
}

export function IconTimesheet({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1" />
    </svg>
  )
}

export function IconInvoice({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M3 2h10v12l-2.5-1.5L8 14l-2.5-1.5L3 14z" />
      <path d="M6 6h4" />
    </svg>
  )
}

export function IconEmployee({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
    </svg>
  )
}

export function IconLeave({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M3 4h10v10H3z" />
      <path d="M3 7h10M6 2v3M10 2v3" />
    </svg>
  )
}

export function IconPayroll({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M2 5h12v7H2z" />
      <circle cx="8" cy="8.5" r="1.8" />
    </svg>
  )
}

export function IconEquipment({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M2 11h9V7l3 1v3" />
      <circle cx="4.5" cy="12.5" r="1.5" />
      <circle cx="11.5" cy="12.5" r="1.5" />
      <path d="M4 7V4h4v3" />
    </svg>
  )
}

export function IconCustomer({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M2 13V6l6-4 6 4v7z" />
      <path d="M6 13V9h4v4" />
    </svg>
  )
}

export function IconUsers({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <circle cx="6" cy="6" r="2.2" />
      <path d="M2 13c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" />
      <path d="M11 5h3M11 8h3" />
    </svg>
  )
}

export function IconAudit({ className = base }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16">
      <path d="M3 2h10v12H3z" />
      <path d="M5.5 6h5M5.5 9h5M5.5 11.5h3" />
    </svg>
  )
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg className={className ?? 'h-4 w-4'} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  )
}
