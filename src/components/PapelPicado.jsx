// Papel picado — rectangular cut-paper flags with a scalloped lower edge, the
// shape real papel picado actually takes.
//
// Drawn as a tiled <pattern> rather than a stretched viewBox so the flags keep
// their proportions at every width, and inline SVG rather than a background
// image so each flag can carry a palette token and follow the theme.
//
// The lace is built by punching background-coloured shapes over each flag: SVG
// has no subtract operator, and this stays readable where a hand-written
// even-odd path would not.

const COLORS = ['var(--chili)', 'var(--marigold)', 'var(--talavera)', 'var(--cactus)', 'var(--rosa)', 'var(--marigold-deep)']

const W = 32 // flag width
const GAP = 4 // space between flags, so the string shows through
const TOP = 3 // string sits here
const BOT = 26 // flat bottom edge, before the scallops hang below it
const H = 34 // band height, leaves room for the scallops
const TILE = (W + GAP) * COLORS.length

let uid = 0

function Flag({ x, fill }) {
  const cut = 'var(--bg)'
  const left = x + GAP / 2
  const mid = left + W / 2
  const dots = [0, 1, 2, 3, 4, 5]
  return (
    <g>
      <rect x={left} y={TOP} width={W} height={BOT - TOP} fill={fill} opacity="0.95" />
      {/* scalloped hem */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={left + 4 + i * 8} cy={BOT} r="4" fill={fill} opacity="0.95" />
      ))}

      {/* punched lace — borders top and bottom, a slot pair, and a centre motif */}
      {dots.map((i) => (
        <circle key={`t${i}`} cx={left + 3.5 + i * 5} cy={TOP + 3} r="1.15" fill={cut} />
      ))}
      <rect x={mid - 8} y={TOP + 6.2} width="16" height="1.5" rx="0.75" fill={cut} />

      <path d={`M${mid} ${TOP + 9.6} l4 4 -4 4 -4 -4 Z`} fill={cut} />
      <circle cx={mid - 8.5} cy={TOP + 13.6} r="1.8" fill={cut} />
      <circle cx={mid + 8.5} cy={TOP + 13.6} r="1.8" fill={cut} />
      <circle cx={mid - 13} cy={TOP + 13.6} r="1.1" fill={cut} />
      <circle cx={mid + 13} cy={TOP + 13.6} r="1.1" fill={cut} />

      <rect x={mid - 8} y={TOP + 18.8} width="16" height="1.5" rx="0.75" fill={cut} />
      {dots.slice(0, 4).map((i) => (
        <circle key={`b${i}`} cx={left + 6.5 + i * 6.5} cy={BOT - 2.2} r="1.15" fill={cut} />
      ))}
    </g>
  )
}

export default function PapelPicado({ variant }) {
  // Two instances on one page must not share a pattern id.
  const id = `papel-${(uid = (uid + 1) % 1000)}`
  return (
    <svg className={variant === 'divider' ? 'papel papel--divider' : 'papel'} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width={TILE} height={H} patternUnits="userSpaceOnUse">
          {COLORS.map((fill, i) => (
            <Flag key={i} x={i * (W + GAP)} fill={fill} />
          ))}
        </pattern>
      </defs>
      <line className="papel__string" x1="0" y1={TOP} x2="100%" y2={TOP} />
      <rect width="100%" height={H} fill={`url(#${id})`} />
    </svg>
  )
}
