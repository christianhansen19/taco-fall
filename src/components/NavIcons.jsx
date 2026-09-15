// Stroke icons for the bottom nav. They inherit currentColor and share one
// stroke treatment, so the row reads as a set rather than four borrowed glyphs.

function Icon({ children }) {
  return (
    <svg className="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export function CountIcon() {
  return (
    <Icon>
      {/* One closed path: filling scallops across the top, shell curving below.
          A straight rim line here reads as a bowl at 23px. */}
      <path d="M3.3 12.4Q6.2 7.7 9.1 12.4Q12 7.7 14.9 12.4Q17.8 7.7 20.7 12.4a8.7 8.7 0 0 1-17.4 0Z" />
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
