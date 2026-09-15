// Stroke icons. They inherit currentColor and share one stroke treatment, so
// each row of them reads as a set rather than as borrowed glyphs.

function Icon({ children, className = 'nav__icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

function UiIcon({ children }) {
  return <Icon className="ui-icon">{children}</Icon>
}

export function CountIcon() {
  return (
    <Icon>
      {/* Folded shell seen side-on: domed back, flat base, lettuce frilling out
          along the fold. A U-shape with filling on top reads as a bowl at 23px. */}
      <path d="M2.9 17.4h18.2a9.1 9.1 0 0 0-18.2 0Z" />
      <path d="M4.6 13.9q1.85-2.75 3.7 0 1.85-2.75 3.7 0 1.85-2.75 3.7 0 1.85-2.75 3.7 0" />
      <path d="M8.6 16.1h.01" />
      <path d="M12.2 16.6h.01" />
    </Icon>
  )
}

export function FeedIcon() {
  return (
    <Icon>
      <path d="M5 4.6h14A1.6 1.6 0 0 1 20.6 6.2v8.4A1.6 1.6 0 0 1 19 16.2H9.6L5.4 19.4v-3.2A1.6 1.6 0 0 1 3.4 14.6V6.2A1.6 1.6 0 0 1 5 4.6Z" />
      <path d="M7.6 8.6h8.8" />
      <path d="M7.6 12h5.6" />
    </Icon>
  )
}

export function RanksIcon() {
  return (
    <Icon>
      <path d="M7.6 4h8.8v5.4a4.4 4.4 0 0 1-8.8 0Z" />
      <path d="M7.6 5.4H5.2A2.4 2.4 0 0 0 7.8 9.9" />
      <path d="M16.4 5.4h2.4a2.4 2.4 0 0 1-2.6 4.5" />
      <path d="M12 13.8v3.4" />
      <path d="M8.6 20h6.8" />
    </Icon>
  )
}

export function ExploreIcon() {
  return (
    <Icon>
      <path d="M3.4 6.8 9 4.6l6 2.2 5.6-2.2v12.6L15 19.4l-6-2.2-5.6 2.2Z" />
      <path d="M9 4.6v12.6" />
      <path d="M15 6.8v12.6" />
    </Icon>
  )
}

// --- header controls -------------------------------------------------

export function InfoIcon() {
  return (
    <UiIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.2v5" />
      <path d="M12 7.6h.01" />
    </UiIcon>
  )
}

export function AdminIcon() {
  return (
    <UiIcon>
      <path d="M3.5 7.5h8.2" />
      <path d="M17.3 7.5h3.2" />
      <circle cx="14.5" cy="7.5" r="2.6" />
      <path d="M3.5 16.5h2.4" />
      <path d="M11.5 16.5h9" />
      <circle cx="8.7" cy="16.5" r="2.6" />
    </UiIcon>
  )
}

export function SystemThemeIcon() {
  return (
    <UiIcon>
      <path d="M4.6 4.8h14.8a1.4 1.4 0 0 1 1.4 1.4v8.4a1.4 1.4 0 0 1-1.4 1.4H4.6a1.4 1.4 0 0 1-1.4-1.4V6.2a1.4 1.4 0 0 1 1.4-1.4Z" />
      <path d="M9 19.6h6" />
      <path d="M12 16v3.6" />
    </UiIcon>
  )
}

export function LightThemeIcon() {
  return (
    <UiIcon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.9v2.2" />
      <path d="M12 18.9v2.2" />
      <path d="M4.6 4.6 6.2 6.2" />
      <path d="m17.8 17.8 1.6 1.6" />
      <path d="M2.9 12h2.2" />
      <path d="M18.9 12h2.2" />
      <path d="m4.6 19.4 1.6-1.6" />
      <path d="m17.8 6.2 1.6-1.6" />
    </UiIcon>
  )
}

export function DarkThemeIcon() {
  return (
    <UiIcon>
      <path d="M20.4 14.4A8.6 8.6 0 0 1 9.6 3.6a8.6 8.6 0 1 0 10.8 10.8Z" />
    </UiIcon>
  )
}
