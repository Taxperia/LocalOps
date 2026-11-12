import { Area, AreaChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatBytes, type FormatLocale } from '@shared/format'

export interface ChartPoint {
  ts: number
  value: number
}

export const CHART_COLORS = {
  accent: 'var(--accent)',
  green: '#45d483',
  warn: '#e6b450'
} as const

export type ChartColor = keyof typeof CHART_COLORS

interface LiveAreaProps {
  data: ChartPoint[]
  height?: number
  color?: ChartColor
  locale?: FormatLocale
  percent?: boolean
}

export function LiveAreaChart({ data, height = 96, color = 'accent', percent = false }: LiveAreaProps) {
  const stroke = CHART_COLORS[color]
  const id = `g-${color}-${percent ? 'p' : 'v'}`
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="ts" hide />
          <YAxis hide domain={[0, percent ? 100 : 'auto']} />
          <Tooltip
            cursor={{ stroke: '#2a313c', strokeDasharray: '3 3' }}
            content={((props: { active?: boolean; payload?: Array<{ payload?: ChartPoint }> }) => {
              const p = props.payload?.[0]?.payload
              if (!props.active || !p) return null
              const label = new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              return (
                <div className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] shadow-lg">
                  <span className="text-ink-2 tnum">{label}</span>
                  <span className="ml-2 text-ink tnum">{percent ? `${p.value.toFixed(1)}%` : formatBytes(p.value) + '/s'}</span>
                </div>
              )
            }) as never}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.6}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface LiveLinesProps {
  data: Array<{ ts: number; a: number; b: number }>
  height?: number
  colorA?: ChartColor
  colorB?: ChartColor
  percent?: boolean
}

export function LiveLinesChart({ data, height = 110, colorA = 'accent', colorB = 'green', percent = false }: LiveLinesProps) {
  const strokeA = CHART_COLORS[colorA]
  const strokeB = CHART_COLORS[colorB]
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="ts" hide />
          <YAxis hide domain={[0, percent ? 100 : 'auto']} />
          <Tooltip
            cursor={{ stroke: '#2a313c', strokeDasharray: '3 3' }}
            content={((props: { active?: boolean; payload?: Array<{ payload?: { ts: number; a: number; b: number } }> }) => {
              const p = props.payload?.[0]?.payload
              if (!props.active || !p) return null
              const label = new Date(p.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              const fmt = (v: number) => (percent ? `${v.toFixed(1)}%` : formatBytes(v) + '/s')
              return (
                <div className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] shadow-lg">
                  <span className="text-ink-2 tnum">{label}</span>
                  <div className="tnum mt-0.5">
                    <span style={{ color: strokeA }}>{fmt(p.a)}</span>
                    <span className="mx-1.5 text-ink-3">·</span>
                    <span style={{ color: strokeB }}>{fmt(p.b)}</span>
                  </div>
                </div>
              )
            }) as never}
          />
          <Line type="monotone" dataKey="a" stroke={strokeA} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="b" stroke={strokeB} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Compact per-core usage bars. */
export function CoreBars({ values }: { values: number[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          title={`CPU ${i}: ${v.toFixed(0)}%`}
          className="relative h-7 w-[13px] overflow-hidden rounded-[3px] bg-surface-3"
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-[3px] transition-[height] duration-300"
            style={{ height: `${Math.max(2, v)}%`, background: 'var(--accent)', opacity: 0.35 + (v / 100) * 0.65 }}
          />
        </div>
      ))}
    </div>
  )
}

export function UsageBar({ percent, color }: { percent: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color ?? 'var(--accent)' }}
      />
    </div>
  )
}
