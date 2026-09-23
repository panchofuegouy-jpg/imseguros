import { SectionCard } from "@/components/brand/section-card"
import { formatNumber } from "@/lib/format"

interface CompanyShareChartProps {
  data: { name: string; value: number }[]
}

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
]

/**
 * Pólizas vigentes por aseguradora como barras con el número escrito al lado.
 * Reemplaza a la torta: comparar largos es más fácil que comparar ángulos.
 */
export function CompanyShareChart({ data }: CompanyShareChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const max = Math.max(1, ...data.map((item) => item.value))

  return (
    <SectionCard title="Pólizas vigentes por aseguradora" description={`${formatNumber(total)} pólizas en total`}>
      {data.length === 0 ? (
        <p className="py-6 text-base text-muted-foreground">Todavía no hay pólizas vigentes.</p>
      ) : (
        <ul className="space-y-4 py-1">
          {data.map((item, index) => {
            const percent = total ? Math.round((item.value / total) * 100) : 0
            return (
              <li key={item.name} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-base font-semibold">{item.name}</span>
                  <span className="shrink-0 text-base tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatNumber(item.value)}</span> · {percent}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (item.value / max) * 100)}%`,
                      background: BAR_COLORS[index % BAR_COLORS.length],
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
