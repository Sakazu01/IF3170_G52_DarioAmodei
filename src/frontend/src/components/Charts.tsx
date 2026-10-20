import {
  Bar, BarChart as RBarChart, CartesianGrid, ComposedChart, Legend, LabelList, Line, LineChart as RLineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

/** Grafik memakai Recharts. Warna dari token tema (CSS variable). */

const TICK = { fontSize: 11, fill: "var(--text-2)" };
const AXIS = { stroke: "var(--line-2)" };
const TOOLTIP = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12, color: "var(--text)" },
  labelStyle: { color: "var(--text-2)" },
};
const MARGIN = { top: 12, right: 16, bottom: 16, left: 8 };

const grid = <CartesianGrid stroke="var(--line)" vertical={false} />;
const xLabel = (value: string) => ({ value, position: "insideBottom" as const, offset: -10, fill: "var(--text-2)", fontSize: 12 });
const yLabel = (value: string) => ({ value, angle: -90, position: "insideLeft" as const, offset: 4, fill: "var(--text-2)", fontSize: 12, style: { textAnchor: "middle" as const } });

/** xMax: iterasi terakhir seri ini. dash: garis putus-putus. */
export interface Series { name: string; values: number[]; color: string; xMax?: number; dash?: string }

/** xMax: nilai sumbu x di titik terakhir (seri sudah di-downsample). */
export function LineChart({ series, xLabel: xl, yLabel: yl, yMin, xMax }: { series: Series[]; xLabel: string; yLabel: string; yMin?: number; xMax?: number }) {
  const span = xMax ?? Math.max(...series.map((s) => s.xMax ?? s.values.length - 1));
  // indeks titik -> nilai iterasi sebenarnya
  const points = (s: Series) => s.values.map((v, i) => ({ x: s.values.length > 1 ? (i / (s.values.length - 1)) * (s.xMax ?? span) : 0, y: v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RLineChart margin={MARGIN} role="img" aria-label={yl + " terhadap " + xl}>
        {grid}
        <XAxis type="number" dataKey="x" domain={[0, span]} tick={TICK} {...AXIS} label={xLabel(xl)} height={44} />
        <YAxis type="number" dataKey="y" domain={[yMin ?? "auto", "auto"]} tick={TICK} {...AXIS} label={yLabel(yl)} width={64} />
        <Tooltip {...TOOLTIP} formatter={(v: number) => [Number(v.toFixed(3)), ""]} labelFormatter={(x) => `${xl} ${Math.round(Number(x))}`} />
        {series.length > 1 && <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line key={s.name} name={s.name} data={points(s)} dataKey="y" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash}
            dot={false} isAnimationActive={false} />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  );
}

/** Dua batang per truk: state awal dan hasil akhir. */
export function BarChart({ labels, a, b, aName, bName }: { labels: string[]; a: number[]; b: number[]; aName: string; bName: string }) {
  const data = labels.map((name, i) => ({ name, a: a[i], b: b[i] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RBarChart data={data} margin={MARGIN} role="img" aria-label="Value per truk">
        {grid}
        <XAxis dataKey="name" tick={TICK} {...AXIS} />
        <YAxis tick={TICK} {...AXIS} width={56} />
        <Tooltip {...TOOLTIP} cursor={{ fill: "var(--track)" }} />
        <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="a" name={aName} fill="var(--idle)" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        <Bar dataKey="b" name={bName} fill="var(--acc)" radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
          <LabelList dataKey="b" position="top" style={{ fontSize: 11, fill: "var(--text)" }} />
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}

/** Pengaruh satu parameter: batang = rata-rata value, titik = value akhir tiap run. */
export function SweepChart({ labels, means, runs, xLabel: xl }: { labels: string[]; means: number[]; runs: number[][]; xLabel: string }) {
  const nRuns = Math.max(...runs.map((r) => r.length));
  const data = labels.map((name, i) => ({
    name, mean: Math.round(means[i]),
    ...Object.fromEntries(runs[i].map((v, j) => [`r${j}`, v])),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={MARGIN} role="img" aria-label={"Value terhadap " + xl}>
        {grid}
        <XAxis dataKey="name" tick={TICK} {...AXIS} label={xLabel(xl)} height={44} />
        <YAxis tick={TICK} {...AXIS} label={yLabel("Value akhir")} width={64} />
        <Tooltip {...TOOLTIP} cursor={{ fill: "var(--track)" }} />
        <Bar dataKey="mean" name="rata-rata" fill="var(--acc)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          <LabelList dataKey="mean" position="top" offset={14} style={{ fontSize: 11, fill: "var(--text)" }} />
        </Bar>
        {Array.from({ length: nRuns }, (_, j) => (
          <Line key={j} dataKey={`r${j}`} name={`run ${j + 1}`} stroke="none" isAnimationActive={false}
            dot={{ r: 3.5, fill: "var(--surface)", stroke: "var(--text)", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
