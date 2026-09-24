import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type Row = Record<string, unknown>;

const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((item): item is Row => item !== null && typeof item === "object") : [];

const amount = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const rupees = (value: number): string =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);

const shortRupees = (value: number): string =>
  `Rs ${new Intl.NumberFormat("en-PK", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-5 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RevenueTrend({ data, from, to }: { data: Row[]; from: unknown; to: unknown }) {
  const sales = data
    .filter((row) => typeof row.day === "string")
    .map((row) => ({ day: String(row.day), revenue: amount(row.revenue) }));
  if (!sales.length) return <EmptyChart message="No completed sales in this date range." />;

  const start = Date.parse(`${String(from)}T00:00:00Z`);
  const end = Date.parse(`${String(to)}T00:00:00Z`);
  const span = Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.floor((end - start) / 86_400_000) + 1
    : 0;
  const monthly = span > 92;
  let points = sales;
  if (span > 0 && span <= 36_600) {
    const totals = new Map<string, number>();
    for (const sale of sales) {
      const key = monthly ? sale.day.slice(0, 7) : sale.day;
      totals.set(key, (totals.get(key) ?? 0) + sale.revenue);
    }
    if (monthly) {
      const startMonth = new Date(Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), 1));
      const endMonth = new Date(Date.UTC(new Date(end).getUTCFullYear(), new Date(end).getUTCMonth(), 1));
      points = [];
      for (let date = startMonth; date <= endMonth; date.setUTCMonth(date.getUTCMonth() + 1)) {
        const day = date.toISOString().slice(0, 7);
        points.push({ day, revenue: totals.get(day) ?? 0 });
      }
    } else {
      points = Array.from({ length: span }, (_, index) => {
        const day = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
        return { day, revenue: totals.get(day) ?? 0 };
      });
    }
  }

  const width = Math.max(560, points.length * 36);
  const height = 220;
  const left = 58;
  const right = 18;
  const top = 12;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(1, ...points.map((point) => point.revenue));
  const x = (index: number) => left + (points.length === 1 ? plotWidth / 2 : (index * plotWidth) / (points.length - 1));
  const y = (value: number) => top + plotHeight - (Math.max(0, value) / max) * plotHeight;
  const line = points.map((point, index) => `${x(index)},${y(point.revenue)}`).join(" ");
  const fill = `M ${x(0)} ${top + plotHeight} L ${points.map((point, index) => `${x(index)} ${y(point.revenue)}`).join(" L ")} L ${x(points.length - 1)} ${top + plotHeight} Z`;
  const tickStep = Math.max(1, Math.ceil(points.length / 9));

  return (
    <div className="overflow-x-auto pb-1">
      <svg
        role="img"
        aria-label={`Sales revenue trend from ${String(from || points[0].day)} to ${String(to || points[points.length - 1].day)}`}
        className="h-[220px] min-w-full text-muted-foreground"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.5, 1].map((fraction) => {
          const gridY = y(max * fraction);
          return (
            <g key={fraction}>
              <line x1={left} x2={width - right} y1={gridY} y2={gridY} stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 4" />
              <text x={left - 8} y={gridY + 4} textAnchor="end" fill="currentColor" fontSize="10">
                {shortRupees(max * fraction)}
              </text>
            </g>
          );
        })}
        <path d={fill} fill="#10b981" fillOpacity="0.13" />
        <polyline points={line} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={`${point.day}-${index}`}>
            <circle cx={x(index)} cy={y(point.revenue)} r="4" fill="#059669" stroke="white" strokeWidth="1.5">
              <title>{`${point.day}: ${rupees(point.revenue)}`}</title>
            </circle>
            {(index % tickStep === 0 || index === points.length - 1) && (
              <text x={x(index)} y={height - 10} textAnchor="middle" fill="currentColor" fontSize="10">
                {monthly ? point.day : point.day.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function RankedBars({
  data,
  labelKey,
  valueKey,
  currency = false,
  empty,
}: {
  data: Row[];
  labelKey: string;
  valueKey: string;
  currency?: boolean;
  empty: string;
}) {
  const ranked = data
    .map((row) => ({ label: String(row[labelKey] ?? "Unknown"), value: amount(row[valueKey]) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  if (!ranked.length) return <EmptyChart message={empty} />;
  const max = ranked[0].value;
  return (
    <div role="img" aria-label={`${currency ? "Revenue" : "Units"} comparison chart`} className="space-y-3">
      {ranked.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium" title={item.label}>{item.label.replaceAll("_", " ")}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{currency ? rupees(item.value) : item.value.toLocaleString("en-PK")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="chart-bar h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportCharts({ data }: { data: Row }) {
  return (
    <section aria-label="Report charts" className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle>Sales revenue trend</CardTitle>
          <p className="text-xs text-muted-foreground">Completed sales across the selected date range; longer ranges are grouped by month</p>
        </CardHeader>
        <CardContent><RevenueTrend data={rows(data.sales)} from={data.from} to={data.to} /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle>Revenue by category</CardTitle></CardHeader>
        <CardContent><RankedBars data={rows(data.categories)} labelKey="category" valueKey="revenue" currency empty="No category sales in this date range." /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle>Fast selling products</CardTitle></CardHeader>
        <CardContent><RankedBars data={rows(data.fast)} labelKey="name" valueKey="units_sold" empty="No products sold in this date range." /></CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3"><CardTitle>Staff revenue</CardTitle></CardHeader>
        <CardContent><RankedBars data={rows(data.staff)} labelKey="name" valueKey="revenue" currency empty="No staff sales in this date range." /></CardContent>
      </Card>
    </section>
  );
}
