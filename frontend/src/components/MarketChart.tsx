import { useId } from "react";

export function MarketChart({ seed = 1, positive = true, large = false, period = "1W" }: { seed?: number; positive?: boolean; large?: boolean; period?: string }) {
  const id = useId().replace(/:/g, "");
  const width = large ? 640 : 135, height = large ? 220 : 42;
  const steps = large ? 65 : 28;
  const periodSeed = Array.from(period).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const points = Array.from({ length: steps }, (_, i) => {
    const noise = Math.sin((i + seed) * 2.4 + periodSeed) * 0.13 + Math.cos((i + seed) * 0.9) * 0.09;
    const trend = positive ? 0.75 - i / steps * 0.5 : 0.25 + i / steps * 0.5;
    return `${(i / (steps - 1) * width).toFixed(1)},${(Math.max(0.06, Math.min(0.95, trend + noise)) * height).toFixed(1)}`;
  }).join(" ");
  const color = positive ? "#b5ef62" : "#f18a9d";
  return <svg className={large ? "large-chart" : "sparkline"} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Illustrative demo probability history">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".17"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    {large && [0, 1, 2, 3, 4].map(i => <line key={i} x1="0" x2={width} y1={i * height / 4} y2={i * height / 4} stroke="#ffffff0b" strokeDasharray="4 6"/>)}
    <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${id})`}/><polyline points={points} fill="none" stroke={color} strokeWidth={large ? 2.4 : 1.7} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
  </svg>;
}
