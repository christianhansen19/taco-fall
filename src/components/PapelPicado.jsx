// Papel picado — cut-paper pennants. Inline SVG rather than a background image
// so each flag can reference a palette token and follow the theme.
//
// Drawn as a <pattern> tiled across a full-width rect: the flags keep their
// exact proportions at every viewport width, where a stretched-to-fit viewBox
// would distort them on desktop.

const COLORS = ['var(--chili)', 'var(--marigold)', 'var(--talavera)', 'var(--cactus)', 'var(--rosa)', 'var(--marigold-deep)']

const W = 30 // flag width
const H = 22 // band height
const TILE = W * COLORS.length

let uid = 0

export default function PapelPicado({ variant }) {
  // Two instances on one page must not share a pattern id.
  const id = `papel-${(uid = (uid + 1) % 1000)}`
  return (
    <svg className={variant === 'divider' ? 'papel papel--divider' : 'papel'} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width={TILE} height={H} patternUnits="userSpaceOnUse">
          {COLORS.map((fill, i) => {
            const x = i * W
            const cx = x + W / 2
            return (
              <g key={i}>
                <path d={`M${x + 1} 3 L${x + W - 1} 3 L${cx} ${H - 2} Z`} fill={fill} opacity="0.92" />
                {/* punched cut-outs that give papel picado its lace look */}
                <circle cx={cx} cy={8} r={2.4} fill="var(--bg)" />
                <circle cx={cx - 4.5} cy={12} r={1.3} fill="var(--bg)" />
                <circle cx={cx + 4.5} cy={12} r={1.3} fill="var(--bg)" />
                <circle cx={cx} cy={14} r={1.5} fill="var(--bg)" />
              </g>
            )
          })}
        </pattern>
      </defs>
      <line className="papel__string" x1="0" y1="2" x2="100%" y2="2" />
      <rect width="100%" height={H} fill={`url(#${id})`} />
    </svg>
  )
}
