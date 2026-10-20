import { Download, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";

import { dataVisualizationPalette, semanticChartColors } from "@/config/dataVisualization";
import type { DashboardChart } from "@/features/dashboard/types";

import styles from "./DashboardView.module.css";

const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumSignificantDigits: 21 });
const axisFormatter = new Intl.NumberFormat("vi-VN", { maximumSignificantDigits: 4 });
const compactFormatter = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumSignificantDigits: 4 });
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumSignificantDigits: 3 });
const number = (value: number) => numberFormatter.format(value);
const axisNumber = (value: number) => Math.abs(value) >= 10_000 ? compactFormatter.format(value) : axisFormatter.format(value);

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  // Horizontal control points keep interpolation within the adjacent real values.
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middle = (previous.x + current.x) / 2;
    path += ` C ${middle} ${previous.y}, ${middle} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

export function ModuleChart({ chart }: { chart: DashboardChart }) {
  const id = useId();
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const series = chart.series.filter((point) => Number.isFinite(point.value));
  const total = series.reduce((sum, point) => sum + point.value, 0);
  const requestedMaximum = chart.maxValue !== undefined && Number.isFinite(chart.maxValue) ? chart.maxValue : 0;
  const dataMaximum = Math.max(0, requestedMaximum, ...series.map((point) => point.value));
  const minimum = Math.min(0, ...series.map((point) => point.value));
  const maximum = dataMaximum === minimum ? 1 : dataMaximum;
  const range = maximum - minimum;
  const position = (value: number) => (value - minimum) / range * 100;
  const smallIntegerScale = Number.isInteger(maximum) && Number.isInteger(minimum) && range <= 4 && series.every((point) => Number.isInteger(point.value));
  const axisValues = smallIntegerScale ? Array.from({ length: range + 1 }, (_, index) => maximum - index) : [4, 3, 2, 1, 0].map((step) => minimum + range * step / 4);
  const isGauge = chart.unit === "%" && series.length === 1 && series[0].value >= 0 && series[0].value <= 100;
  const kind = isGauge ? "gauge" : chart.kind === "donut" && series.some((point) => point.value < 0) ? "bar" : chart.kind ?? "bar";
  const isProgress = kind === "bar" && chart.unit === "%" && series.every((point) => point.value >= 0 && point.value <= 100);
  const x = (index: number) => series.length === 1 ? 332 : 70 + index * 500 / (series.length - 1);
  const y = (value: number) => 183 - (value - minimum) / range * 142;
  const pointColor = (index: number) => series[index].tone ? semanticChartColors[series[index].tone!] : dataVisualizationPalette[index % dataVisualizationPalette.length];
  const areaId = `${id}-area`;
  const points = series.map((point, index) => ({ x: x(index), y: y(point.value) }));
  const path = smoothPath(points);
  const selected = activePoint === null ? undefined : series[activePoint];
  let accumulated = 0;

  function download() {
    const quote = (value: string) => {
      const safeValue = /^[\t\r]|^[\s\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const csv = ["Nhãn,Giá trị,Đơn vị", ...series.map((point) => `${quote(point.label)},${point.value},${quote(chart.unit ?? "")}`)].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${chart.key}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <section aria-labelledby={id} className={styles.chartPanel} data-chart-kind={kind} data-dashboard-panel>
    <header className={styles.chartHeader}>
      <div className={styles.chartIdentity}><h2 id={id}>{chart.title}</h2>{chart.context ? <span className={styles.chartContext}>{chart.context}</span> : null}</div>
      <div className={styles.chartActions}>{chart.unit ? <span>{chart.unit}</span> : null}<button aria-label={`Tải số liệu ${chart.title}`} className={styles.chartExport} disabled={!series.length} onClick={download} type="button"><Download aria-hidden="true" size={18} strokeWidth={1.7} /></button></div>
    </header>
    {!series.length ? <div className={styles.chartEmpty}>{chart.emptyLabel ?? "Chưa có dữ liệu"}</div> : isGauge ? <div className={styles.gaugeContent}>
      <div className={styles.gaugeFigure}>
        <svg aria-label={`${series[0].label}: ${number(series[0].value)}%`} role="img" viewBox="0 0 280 166">
          <title>{`${series[0].label}: ${number(series[0].value)}%`}</title>
          <path className={styles.gaugeTrack} d="M 35 139 A 105 105 0 0 1 245 139" fill="none" pathLength="100" strokeWidth="29" />
          <path d="M 35 139 A 105 105 0 0 1 245 139" fill="none" pathLength="100" stroke={pointColor(0)} strokeDasharray={`${series[0].value} 100`} strokeWidth="29" />
          <text className={styles.axisText} textAnchor="start" x="20" y="164">0%</text><text className={styles.axisText} textAnchor="end" x="260" y="164">100%</text>
        </svg>
        <div className={styles.gaugeValue}><span><TrendingUp aria-hidden="true" size={22} strokeWidth={1.6} /></span><strong>{number(series[0].value)}%</strong></div>
      </div>
      <span className={styles.gaugeLabel}>{series[0].label}</span>
    </div> : kind === "donut" ? <div className={styles.donutContent}>
      <div className={styles.donutFigure}>
        <svg aria-hidden="true" viewBox="0 0 200 200"><circle className={styles.donutTrack} cx="100" cy="100" r="76" fill="none" strokeWidth="25" />
          {total > 0 ? series.map((point, index) => {
            const fraction = point.value / total;
            const offset = accumulated;
            accumulated += fraction;
            if (point.value === 0) return null;
            return <circle key={`${point.label}-${index}`} cx="100" cy="100" r="76" fill="none" stroke={pointColor(index)} strokeWidth="25" pathLength="100" strokeDasharray={`${fraction * 100} ${100 - fraction * 100}`} strokeDashoffset={-offset * 100} transform="rotate(-90 100 100)" />;
          }) : null}
        </svg><div className={styles.donutTotal}><strong aria-label={number(total)} title={number(total)}>{axisNumber(total)}</strong><span>{chart.unit ?? "Tổng cộng"}</span></div>
      </div>
      <ul className={styles.legend}>{series.map((point, index) => <li key={`${point.label}-${index}`}><span aria-hidden="true" className={styles.legendDot} style={{ background: pointColor(index) }} />{point.href ? <Link href={point.href} prefetch={false}>{point.label}</Link> : <span>{point.label}</span>}<strong>{number(point.value)}</strong><small>{percentFormatter.format(total ? point.value / total * 100 : 0)}%</small></li>)}</ul>
    </div> : kind === "line" ? <div className={styles.lineContent}>
      {selected ? <div className={styles.chartTooltip}><strong>{selected.label}</strong><span>{number(selected.value)} {chart.unit}</span></div> : null}
      <svg aria-label={chart.title} role="img" viewBox="0 20 610 204"><title>{chart.title}</title><desc>{series.map((point) => `${point.label}: ${number(point.value)} ${chart.unit ?? ""}`).join("; ")}</desc>
        <defs><linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pointColor(0)} stopOpacity=".18" /><stop offset="100%" stopColor={pointColor(0)} stopOpacity="0" /></linearGradient></defs>
        {axisValues.map((value, index) => <g key={index}><line className={styles.gridLine} x1="70" x2="580" y1={y(value)} y2={y(value)} /><text className={styles.axisText} x="55" y={y(value) + 4} textAnchor="end">{axisNumber(value)}</text></g>)}
        {series.length > 1 ? <path d={`${path} L ${x(series.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={`url(#${areaId})`} /> : null}
        {series.length > 1 ? <path d={path} fill="none" stroke={pointColor(0)} strokeWidth="4.5" strokeLinecap="round" /> : null}
        {series.map((point, index) => <g key={`${point.label}-${index}`}><circle aria-label={`${point.label}: ${number(point.value)} ${chart.unit ?? ""}`} className={styles.linePoint} cx={x(index)} cy={y(point.value)} r={activePoint === index ? 7 : 5} fill={pointColor(0)} onBlur={() => setActivePoint(null)} onFocus={() => setActivePoint(index)} onMouseEnter={() => setActivePoint(index)} onMouseLeave={() => setActivePoint(null)} stroke="var(--surface)" strokeWidth="3" tabIndex={0}><title>{`${point.label}: ${number(point.value)} ${chart.unit ?? ""}`}</title></circle><text className={styles.axisText} x={x(index)} y="215" textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}><title>{point.label}</title>{point.label.length > 16 ? `${point.label.slice(0, 13)}…` : point.label}</text></g>)}
      </svg>
    </div> : isProgress ? <ul className={styles.progressBars}>{series.map((point, index) => <li key={`${point.label}-${index}`}><div><span>{point.label}</span><strong>{number(point.value)}%</strong></div><div className={styles.progressTrack}><span style={{ "--bar-width": `${point.value}%`, "--bar-color": pointColor(index) } as CSSProperties} /></div></li>)}</ul> : <><div className={styles.columnChart} style={{ "--zero-position": `${position(0)}%` } as CSSProperties}>
      <div aria-hidden="true" className={styles.columnAxis}>{axisValues.map((value, index) => <span key={index} style={{ bottom: `${position(value)}%` }}>{axisNumber(value)}</span>)}</div>
      <ul className={styles.columns} style={{ "--bar-count": series.length } as CSSProperties}>{series.map((point, index) => <li key={`${point.label}-${index}`}><div className={styles.columnSlot} data-negative={point.value < 0} style={{ "--bar-start": `${position(Math.min(0, point.value))}%`, "--bar-height": `${Math.abs(point.value) / range * 100}%`, "--value-position": `${position(point.value)}%`, "--bar-color": pointColor(index) } as CSSProperties}><strong>{number(point.value)}</strong><span aria-hidden="true" className={styles.columnBar} /></div>{point.href ? <Link className={styles.columnLabel} href={point.href} prefetch={false}>{point.label}</Link> : <span className={styles.columnLabel}>{point.label}</span>}</li>)}</ul>
    </div><div className={styles.horizontalChart} style={{ "--zero-position": `${position(0)}%` } as CSSProperties}>
      <div aria-hidden="true" className={styles.horizontalAxis}><span>{axisNumber(minimum)}</span><span>{axisNumber(maximum)}</span></div>
      <ul className={styles.horizontalBars}>{series.map((point, index) => <li key={`${point.label}-${index}`}><div className={styles.horizontalLabel}>{point.href ? <Link href={point.href} prefetch={false}>{point.label}</Link> : <span>{point.label}</span>}<strong>{number(point.value)}</strong></div><div aria-hidden="true" className={styles.horizontalTrack}><span className={styles.horizontalBar} style={{ "--bar-start": `${position(Math.min(0, point.value))}%`, "--bar-width": `${Math.abs(point.value) / range * 100}%`, "--bar-color": pointColor(index) } as CSSProperties} /></div></li>)}</ul>
    </div></>}
    {series.length ? <details className={styles.chartData}><summary>Xem số liệu</summary><table><caption>{chart.title}{chart.context ? ` · ${chart.context}` : ""}{chart.unit ? ` (${chart.unit})` : ""}</caption><thead><tr><th scope="col">Nhãn</th><th scope="col">Giá trị</th></tr></thead><tbody>{series.map((point, index) => <tr key={`${point.label}-${index}`}><th scope="row">{point.href ? <Link href={point.href} prefetch={false}>{point.label}</Link> : point.label}</th><td>{number(point.value)}</td></tr>)}</tbody></table></details> : null}
  </section>;
}
