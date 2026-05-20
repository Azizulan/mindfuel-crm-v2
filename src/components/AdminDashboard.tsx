
import React, { useState, useEffect, useCallback } from 'react';
import { View } from '../App';
import * as api from '../services/apiService';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const formatBDT = (n: number): string => {
    if (n >= 10000000) return `৳${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000)   return `৳${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)     return `৳${n.toLocaleString('en-IN')}`;
    return `৳${n}`;
};

const pct = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

const timeAgo = (ts: string | null): string => {
    if (!ts) return '—';
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
};
const activeRecently = (ts: string | null) =>
    !!ts && (Date.now() - new Date(ts).getTime()) < 300000;

// ─── Shared primitives ────────────────────────────────────────────────────────

const Sk = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm p-5 ${className}`}>{children}</div>
);

const CardHeader = ({ title, right }: { title: string; right?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
        {right}
    </div>
);

const EmptyState = ({ message, cta, onCta }: { message: string; cta?: string; onCta?: () => void }) => (
    <div className="py-10 text-center space-y-2">
        <p className="text-sm font-bold text-gray-600">{message}</p>
        {cta && onCta && (
            <button onClick={onCta} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">{cta}</button>
        )}
    </div>
);

// ─── Sparkline ────────────────────────────────────────────────────────────────

const Sparkline = ({ data, color = '#6366f1' }: { data: number[]; color?: string }) => {
    const W = 72, H = 30;
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const pts = data.map((v, i) => [
        (i / (data.length - 1)) * W,
        H - (v / max) * (H - 6) - 2,
    ]);
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${W},${H} L0,${H} Z`;
    const last = pts[pts.length - 1];
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible flex-shrink-0">
            <path d={area} fill={color} fillOpacity={0.12} />
            <path d={line} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
        </svg>
    );
};

// ─── Delta ────────────────────────────────────────────────────────────────────

const Delta = ({ delta }: { delta: number }) => {
    if (delta === 0) return <span className="text-[11px] text-gray-400">No change vs yesterday</span>;
    return (
        <span className={`text-[11px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {delta > 0 ? '+' : ''}{delta}% vs yesterday
        </span>
    );
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiProps {
    label: string; value: string | number; delta?: number; sub?: string;
    sparkData?: number[]; sparkColor?: string;
    badge?: string; badgeColor?: string; loading: boolean; onClick?: () => void;
}
const KpiCard = ({ label, value, delta, sub, sparkData, sparkColor = '#6366f1', badge, badgeColor = 'bg-blue-50 text-blue-600', loading, onClick }: KpiProps) => (
    <Card className={onClick ? 'cursor-pointer hover:border-blue-300 hover:shadow-md transition-all' : ''} >
        <div onClick={onClick} className="flex flex-col gap-3 h-full">
            <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{label}</span>
                {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${badgeColor}`}>{badge}</span>}
            </div>
            {loading ? (
                <div className="space-y-2"><Sk className="h-10 w-24" /><Sk className="h-3 w-20" /></div>
            ) : (
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[2rem] font-black text-gray-900 leading-none font-mono tracking-tight truncate">{value}</div>
                        <div className="mt-1.5 space-y-0.5">
                            {delta !== undefined && <Delta delta={delta} />}
                            {sub && <p className="text-[11px] text-gray-400 leading-tight">{sub}</p>}
                        </div>
                    </div>
                    {sparkData && sparkData.some(v => v > 0) && <Sparkline data={sparkData} color={sparkColor} />}
                </div>
            )}
        </div>
    </Card>
);

// ─── Sentiment bar ────────────────────────────────────────────────────────────

const SENT_COLORS: Record<string, string> = { Happy: '#10b981', Positive: '#22c55e', Neutral: '#94a3b8', 'Call Back Later': '#3b82f6', 'Call Not Received': '#fca5a5', 'Not Interested': '#f97316', Angry: '#ef4444' };

const SentimentBar = ({ data }: { data: { sentiment: string; count: number }[] }) => {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (!total) return null;
    const active = data.filter(d => d.count > 0);
    return (
        <div className="space-y-3">
            <div className="flex h-8 rounded-xl overflow-hidden gap-px">
                {active.map(d => <div key={d.sentiment} style={{ width: `${(d.count / total) * 100}%`, backgroundColor: SENT_COLORS[d.sentiment] ?? '#94a3b8' }} title={`${d.sentiment}: ${d.count}`} className="flex-shrink-0" />)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {active.map(d => (
                    <span key={d.sentiment} className="flex items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SENT_COLORS[d.sentiment] ?? '#94a3b8' }} />
                        {d.sentiment} <span className="text-gray-400">{d.count}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400">{((d.count / total) * 100).toFixed(0)}%</span>
                    </span>
                ))}
            </div>
        </div>
    );
};

// ─── Action item config ───────────────────────────────────────────────────────

const SEV = {
    critical: { dot: 'bg-red-500',   bg: 'bg-red-50',   border: 'border-red-100',   text: 'text-red-800',   btn: 'bg-red-600 hover:bg-red-700 text-white' },
    warning:  { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', btn: 'bg-amber-500 hover:bg-amber-600 text-white' },
    info:     { dot: 'bg-blue-500',  bg: 'bg-blue-50',  border: 'border-blue-100',  text: 'text-blue-800',  btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
} as const;

// ─── Bar chart (CSS, for daily data) ─────────────────────────────────────────

const DailyBarChart = ({ data, targetPerDay, valueKey, color = '#6366f1cc' }: {
    data: { day: number; isToday: boolean; [key: string]: any }[];
    targetPerDay?: number; valueKey: string; color?: string;
}) => {
    const vals = data.map(d => d[valueKey] as number);
    const max = Math.max(...vals, targetPerDay || 0, 1);
    const targetPct = targetPerDay ? Math.min((targetPerDay / max) * 100, 100) : null;
    return (
        <div className="space-y-1.5">
            <div className="relative flex items-end gap-px h-28">
                {targetPct !== null && (
                    <div className="absolute inset-x-0 border-t-2 border-dashed border-amber-400 pointer-events-none z-10" style={{ bottom: `${targetPct}%` }} />
                )}
                {data.map(d => {
                    const v = d[valueKey] as number;
                    const hPct = v > 0 ? Math.max((v / max) * 100, 1.5) : 0;
                    return (
                        <div key={d.day} className="flex-1 rounded-sm relative group cursor-default transition-opacity hover:opacity-80" style={{ height: hPct > 0 ? `${hPct}%` : '2px', backgroundColor: d.isToday ? '#3b82f6' : hPct > 0 ? color : '#e2e8f0', minHeight: '2px' }}>
                            {v > 0 && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 pointer-events-none">
                                    Day {d.day}: {valueKey === 'revenue' ? formatBDT(v) : v}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
                <span>1</span>
                {targetPct !== null && <span className="text-amber-500">— daily target</span>}
                <span>{data.length}</span>
            </div>
        </div>
    );
};

// ─── SVG dual-line chart ──────────────────────────────────────────────────────

const DualLineChart = ({ data }: { data: { day: number; calls: number; orders: number }[] }) => {
    if (data.length < 2) return null;
    const W = 500, H = 130, PL = 28, PR = 28, PT = 8, PB = 20;
    const iW = W - PL - PR, iH = H - PT - PB;
    const maxC = Math.max(...data.map(d => d.calls), 1);
    const maxO = Math.max(...data.map(d => d.orders), 1);
    const xOf = (i: number) => PL + (i / (data.length - 1)) * iW;
    const yC = (v: number) => PT + iH - (v / maxC) * iH;
    const yO = (v: number) => PT + iH - (v / maxO) * iH;
    const callsPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yC(d.calls).toFixed(1)}`).join(' ');
    const ordsPath  = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yO(d.orders).toFixed(1)}`).join(' ');
    const yTicks = [0, 0.5, 1];
    const xLabels = data.filter((_, i) => i === 0 || (i + 1) % 7 === 0 || i === data.length - 1);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
            {yTicks.map(t => <line key={t} x1={PL} y1={PT + (1 - t) * iH} x2={W - PR} y2={PT + (1 - t) * iH} stroke="#f1f5f9" strokeWidth={1} />)}
            {[[0, maxC], [Math.round(maxC / 2), Math.round(maxC / 2)], [maxC, 0]].map(([v, _], i) => (
                <text key={i} x={PL - 4} y={PT + (1 - i * 0.5) * iH + 3} fontSize={8} fill="#94a3b8" textAnchor="end">{v}</text>
            ))}
            {[[0, maxO], [Math.round(maxO / 2), Math.round(maxO / 2)], [maxO, 0]].map(([v, _], i) => (
                <text key={i} x={W - PR + 4} y={PT + (1 - i * 0.5) * iH + 3} fontSize={8} fill="#10b981" textAnchor="start">{v}</text>
            ))}
            <path d={callsPath} stroke="#6366f1" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={ordsPath} stroke="#10b981" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {xLabels.map(d => {
                const i = data.indexOf(d);
                return <text key={d.day} x={xOf(i)} y={H - 4} fontSize={8} fill="#94a3b8" textAnchor="middle">{d.day}</text>;
            })}
        </svg>
    );
};

// ─── Goal KPI card (with progress bar) ───────────────────────────────────────

const GoalCard = ({ label, value, numericValue, target, formattedTarget, dayOfMonth, daysInMonth, loading }: {
    label: string; value: string; numericValue: number; target: number;
    formattedTarget: string; dayOfMonth: number; daysInMonth: number; loading: boolean;
}) => {
    const fillPct  = target > 0 ? Math.min((numericValue / target) * 100, 100) : 0;
    const pacerPct = Math.min((dayOfMonth / daysInMonth) * 100, 100);
    const pace     = target > 0 ? numericValue / (target * dayOfMonth / daysInMonth) : null;
    const isAhead  = pace !== null && pace >= 1.0;
    const onTrack  = pace !== null && pace >= 0.85;
    const projected = dayOfMonth > 0 ? Math.round((numericValue / dayOfMonth) * daysInMonth) : 0;
    const barColor = isAhead ? 'bg-emerald-500' : onTrack ? 'bg-emerald-400' : 'bg-amber-400';
    let statusText = target === 0 ? 'No target set' : isAhead ? `On track — projecting ${formatBDT(projected)}` : onTrack ? `On track — projecting ${formatBDT(projected)}` : `Behind — projecting ${formatBDT(projected)}`;
    const statusColor = target === 0 ? 'text-gray-400' : (isAhead || onTrack) ? 'text-emerald-600' : 'text-amber-600';
    return (
        <Card>
            <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                {loading ? (
                    <div className="space-y-2"><Sk className="h-10 w-24" /><Sk className="h-2 w-full" /><Sk className="h-3 w-32" /></div>
                ) : (
                    <>
                        <div>
                            <div className="text-[2rem] font-black text-gray-900 leading-none font-mono tracking-tight">{value}</div>
                            {target > 0 && <p className="text-[11px] text-gray-400 mt-1">of {formattedTarget} target · day {dayOfMonth}/{daysInMonth}</p>}
                        </div>
                        {target > 0 && (
                            <div className="space-y-1.5">
                                <div className="relative h-1.5 bg-gray-100 rounded-full overflow-visible">
                                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fillPct}%` }} />
                                    <div className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-gray-500/60 rounded" style={{ left: `min(${pacerPct}%, calc(100% - 1px))` }} title="Expected by today" />
                                </div>
                                <p className={`text-[10px] font-bold ${statusColor}`}>{statusText}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
};

// ─── Sentiment funnel visual ──────────────────────────────────────────────────

const FunnelVis = ({ label, totalCalls, positiveCalls, ordersPlaced, convRate }: {
    label: string; totalCalls: number; positiveCalls: number; ordersPlaced?: number; convRate: number;
}) => {
    if (!totalCalls) return <div className="text-xs text-gray-400 italic py-4">No data</div>;
    const stages = [
        { label: 'Total Calls', count: totalCalls, color: 'bg-blue-500', width: 100 },
        { label: 'Happy / Positive', count: positiveCalls, color: 'bg-emerald-500', width: totalCalls > 0 ? (positiveCalls / totalCalls) * 100 : 0 },
        ...(ordersPlaced !== undefined ? [{ label: 'Order Placed', count: ordersPlaced, color: 'bg-violet-500', width: totalCalls > 0 ? (ordersPlaced / totalCalls) * 100 : 0 }] : []),
    ];
    return (
        <div className="space-y-2">
            <p className="text-[11px] font-bold text-gray-500 mb-3">{label}</p>
            {stages.map((s, i) => (
                <div key={s.label} className="space-y-0.5">
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{s.label}</span>
                        <span className="font-bold text-gray-700">{s.count.toLocaleString()}
                            {i > 0 && stages[i - 1].count > 0 && (
                                <span className="text-gray-400 font-normal"> ({((s.count / stages[i - 1].count) * 100).toFixed(1)}%)</span>
                            )}
                        </span>
                    </div>
                    <div className="h-5 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full rounded ${s.color} transition-all`} style={{ width: `${Math.max(s.width, s.count > 0 ? 1 : 0)}%` }} />
                    </div>
                </div>
            ))}
            <p className="text-[10px] text-gray-400 pt-1">Positive rate: <span className="font-bold text-gray-600">{convRate}%</span></p>
        </div>
    );
};

// ─── SVG line chart (monthly trend) ──────────────────────────────────────────

const MonthlyLineChart = ({ data, dataKey, color = '#6366f1', formatY }: {
    data: { month: string; [key: string]: any }[]; dataKey: string; color?: string; formatY?: (v: number) => string;
}) => {
    if (!data.length) return <EmptyState message="No historical data yet" />;
    const W = 600, H = 150, PL = 40, PR = 16, PT = 10, PB = 24;
    const iW = W - PL - PR, iH = H - PT - PB;
    const vals = data.map(d => d[dataKey] as number);
    const max = Math.max(...vals, 1);
    const xOf = (i: number) => PL + (data.length > 1 ? (i / (data.length - 1)) * iW : iW / 2);
    const yOf = (v: number) => PT + iH - (v / max) * iH;
    const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d[dataKey]).toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${xOf(data.length - 1)},${PT + iH} L${xOf(0)},${PT + iH} Z`;
    const yTicks = [0, 0.5, 1];
    const xStep = Math.ceil(data.length / 8);
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
            {yTicks.map(t => (
                <g key={t}>
                    <line x1={PL} y1={PT + (1 - t) * iH} x2={W - PR} y2={PT + (1 - t) * iH} stroke="#f1f5f9" strokeWidth={1} />
                    <text x={PL - 4} y={PT + (1 - t) * iH + 3} fontSize={8} fill="#94a3b8" textAnchor="end">
                        {formatY ? formatY(Math.round(max * t)) : Math.round(max * t)}
                    </text>
                </g>
            ))}
            <path d={areaPath} fill={color} fillOpacity={0.1} />
            <path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {data.filter((_, i) => i % xStep === 0 || i === data.length - 1).map(d => {
                const i = data.indexOf(d);
                return <text key={d.month} x={xOf(i)} y={H - 4} fontSize={8} fill="#94a3b8" textAnchor="middle">{d.month.slice(5)}</text>;
            })}
            {data.map((d, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(d[dataKey])} r={2} fill={color} className="opacity-0 hover:opacity-100 transition-opacity" />
            ))}
        </svg>
    );
};

// ─── Revenue concentration bars ───────────────────────────────────────────────

const ConcentrationBars = ({ data }: { data: { pct: number; customerCount: number; revenueShare: number }[] }) => (
    <div className="space-y-3">
        {data.map(d => (
            <div key={d.pct} className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-gray-600 font-medium">Top {d.pct}% ({d.customerCount.toLocaleString()} customers)</span>
                    <span className="font-bold text-gray-900">{d.revenueShare}% of revenue</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${d.revenueShare}%` }} />
                </div>
            </div>
        ))}
    </div>
);

// ─── Lifecycle pyramid ────────────────────────────────────────────────────────

const LifecyclePyramid = ({ data }: { data: { label: string; count: number; color: string; bg: string }[] }) => {
    const total = data[0]?.count || 1;
    return (
        <div className="space-y-2">
            {data.map((d, i) => {
                const pctOfTotal = ((d.count / total) * 100).toFixed(1);
                const widthPct = Math.max((d.count / total) * 100, d.count > 0 ? 5 : 0);
                const dropoff = i > 0 && data[i - 1].count > 0
                    ? ((1 - d.count / data[i - 1].count) * 100).toFixed(0)
                    : null;
                return (
                    <div key={d.label} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-gray-700">{d.label}</span>
                            <span className="font-mono text-gray-900">{d.count.toLocaleString()}
                                {dropoff && <span className="text-red-400 font-normal ml-1">↓{dropoff}%</span>}
                            </span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded overflow-hidden flex items-center">
                            <div className={`h-full ${d.bg} flex items-center justify-end pr-2 transition-all`} style={{ width: `${widthPct}%` }}>
                                {d.count > 0 && <span className={`text-[9px] font-bold ${d.color}`}>{pctOfTotal}%</span>}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── TODAY TAB ────────────────────────────────────────────────────────────────

const TodayTab = ({ setView }: { setView: (v: View) => void }) => {
    const [data, setData]         = useState<any>(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    const load = useCallback(async () => {
        try { const res = await api.getDashboardToday(); setData(res); setUpdatedAt(new Date()); setError(null); }
        catch (err: any) { setError(err.message || 'Failed to load'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
    const sk = loading && !data;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · auto-refreshes every 60s` : 'Loading…'}</span>
                <button onClick={load} className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">Refresh now</button>
            </div>
            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">{error}</div>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Calls Today" value={data?.callsToday ?? 0} delta={data ? pct(data.callsToday, data.callsYesterday) : undefined} sparkData={data?.callsLast7Days.map((d: any) => d.count)} sparkColor="#6366f1" loading={sk} />
                <KpiCard label="Orders Today" value={data ? formatBDT(data.ordersTodayBDT) : '৳0'} delta={data ? pct(data.ordersTodayBDT, data.ordersYesterdayBDT) : undefined} sub={data?.ordersTodayBDT === 0 ? 'No CRM orders yet' : undefined} loading={sk} />
                <KpiCard label="Hot Leads" value={data?.hotLeadsCount ?? 0} sub={data?.hotLeadsCount ? 'Happy/Positive, last call >3 days ago, no order since' : 'No warm leads waiting'} badge={data?.hotLeadsCount ? 'Call now →' : undefined} badgeColor="bg-emerald-50 text-emerald-600" loading={sk} onClick={data?.hotLeadsCount ? () => setView('callQueue') : undefined} />
                <KpiCard label="Reminders Due" value={data?.remindersDueToday ?? 0} sub={data?.remindersDueToday ? 'Pending, due today or earlier' : 'All clear'} badge={data?.remindersDueToday ? 'View →' : undefined} badgeColor="bg-violet-50 text-violet-600" loading={sk} onClick={data?.remindersDueToday ? () => setView('followUp') : undefined} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader title="Live Agent Activity" />
                    {sk ? <div className="space-y-3">{[1,2,3].map(i => <Sk key={i} className="h-8" />)}</div>
                    : !data?.agentActivity.length ? <EmptyState message="No activity yet today" cta="Start the queue →" onCta={() => setView('callQueue')} />
                    : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-xs min-w-[300px]">
                                <thead><tr className="border-b border-gray-100">
                                    <th className="text-left pb-2 pr-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent</th>
                                    <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today</th>
                                    <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:table-cell">Last Hr</th>
                                    <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Happy%</th>
                                    <th className="text-right pb-2 pl-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Active</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.agentActivity.map((a: any) => (
                                        <tr key={a.name} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-2.5 pr-3"><div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeRecently(a.lastActivityAt) ? 'bg-emerald-500' : 'bg-gray-300'}`} /><span className="font-semibold text-gray-800 truncate max-w-[100px]">{a.name}</span></div></td>
                                            <td className="py-2.5 px-2 text-right font-mono font-bold text-gray-900">{a.callsToday}</td>
                                            <td className="py-2.5 px-2 text-right text-gray-500 hidden sm:table-cell">{a.callsLastHour}</td>
                                            <td className="py-2.5 px-2 text-right"><span className={`font-bold ${a.happyRateToday >= 20 ? 'text-emerald-600' : a.happyRateToday >= 10 ? 'text-amber-600' : 'text-gray-400'}`}>{a.happyRateToday}%</span></td>
                                            <td className="py-2.5 pl-2 text-right text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(a.lastActivityAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
                <Card>
                    <CardHeader title="Today's Call Outcomes" right={data?.callsToday ? <span className="text-[11px] text-gray-400">{data.callsToday} calls</span> : undefined} />
                    {sk ? <div className="space-y-3"><Sk className="h-8 rounded-xl" /><div className="flex gap-3"><Sk className="h-3 w-16" /><Sk className="h-3 w-20" /></div></div>
                    : !data?.callsToday ? <EmptyState message="No calls yet today" cta="Start the queue →" onCta={() => setView('callQueue')} />
                    : <SentimentBar data={data.sentimentToday} />}
                </Card>
            </div>

            <Card>
                <CardHeader title="Founder Action Items" />
                {sk ? <div className="space-y-3">{[1,2].map(i => <Sk key={i} className="h-14" />)}</div>
                : !data?.actionItems.length ? (
                    <div className="py-8 text-center">
                        <div className="w-9 h-9 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </div>
                        <p className="text-sm font-bold text-gray-700">All clear — no action items</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {data.actionItems.map((item: any) => {
                            const cfg = SEV[item.severity as keyof typeof SEV];
                            return (
                                <div key={item.id} className={`flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                        <p className={`text-sm font-semibold leading-snug ${cfg.text}`}>{item.message}</p>
                                    </div>
                                    <button onClick={() => setView(item.ctaView as View)} className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${cfg.btn}`}>{item.cta}</button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

// ─── THIS MONTH TAB ───────────────────────────────────────────────────────────

const MonthTab = ({ setView }: { setView: (v: View) => void }) => {
    const [data, setData]       = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    const load = useCallback(async () => {
        try { const res = await api.getDashboardMonth(); setData(res); setError(null); }
        catch (err: any) { setError(err.message || 'Failed to load'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    const sk = loading && !data;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500 font-medium">{data?.monthLabel ?? '...'}</span>
                <button onClick={load} className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">Refresh</button>
            </div>
            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">{error}</div>}

            {/* Row 1 — Goal KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <GoalCard label="Revenue MTD" value={data ? formatBDT(data.revenueMTD) : '৳0'} numericValue={data?.revenueMTD ?? 0} target={data?.revenueTarget ?? 0} formattedTarget={data ? formatBDT(data.revenueTarget) : '—'} dayOfMonth={data?.dayOfMonth ?? 1} daysInMonth={data?.daysInMonth ?? 30} loading={sk} />
                <GoalCard label="Orders MTD" value={String(data?.ordersMTD ?? 0)} numericValue={data?.ordersMTD ?? 0} target={data?.ordersTarget ?? 0} formattedTarget={String(data?.ordersTarget ?? '—')} dayOfMonth={data?.dayOfMonth ?? 1} daysInMonth={data?.daysInMonth ?? 30} loading={sk} />
                <Card>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Customers MTD</span>
                    {sk ? <div className="mt-3 space-y-2"><Sk className="h-10 w-16" /><Sk className="h-3 w-24" /></div> : (
                        <div className="mt-3">
                            <div className="text-[2rem] font-black text-gray-900 leading-none font-mono">{data?.newCustomersMTD ?? 0}</div>
                            <p className="text-[11px] text-gray-400 mt-1">First-time buyers this month</p>
                        </div>
                    )}
                </Card>
                <Card>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Repeat Buyers MTD</span>
                    {sk ? <div className="mt-3 space-y-2"><Sk className="h-10 w-16" /><Sk className="h-3 w-24" /></div> : (
                        <div className="mt-3">
                            <div className="text-[2rem] font-black text-gray-900 leading-none font-mono">{data?.repeatCustomersMTD ?? 0}</div>
                            <p className="text-[11px] text-gray-400 mt-1">Returning buyers this month</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Row 2 — Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader title="Daily Revenue This Month" right={data?.revenueTarget > 0 ? <span className="text-[10px] text-amber-500 font-semibold">— daily target</span> : undefined} />
                    {sk ? <Sk className="h-36" /> : !data?.dailyData?.length ? <EmptyState message="No purchases recorded this month" /> : (
                        <DailyBarChart
                            data={data.dailyData}
                            targetPerDay={data.revenueTarget > 0 ? data.revenueTarget / data.daysInMonth : undefined}
                            valueKey="revenue"
                            color="#6366f1cc"
                        />
                    )}
                </Card>
                <Card>
                    <CardHeader title="Calls vs Orders This Month" right={
                        <div className="flex items-center gap-3 text-[10px] font-semibold">
                            <span className="flex items-center gap-1"><span className="w-3 h-px bg-indigo-500 inline-block" /> Calls</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-px bg-emerald-500 inline-block" /> Orders</span>
                        </div>
                    } />
                    {sk ? <Sk className="h-36" /> : !data?.dailyData?.length ? <EmptyState message="No data this month" /> : (
                        <DualLineChart data={data.dailyData} />
                    )}
                </Card>
            </div>

            {/* Row 3 — Cohort intelligence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader title="Sentiment Funnel" />
                    {sk ? <div className="space-y-3">{[1,2,3].map(i => <Sk key={i} className="h-10" />)}</div> : (
                        <div className="grid grid-cols-2 gap-6">
                            <FunnelVis label={data?.sentimentFunnel?.current?.label ?? 'This month'} totalCalls={data?.sentimentFunnel?.current?.totalCalls ?? 0} positiveCalls={data?.sentimentFunnel?.current?.positiveCalls ?? 0} ordersPlaced={data?.ordersMTD} convRate={data?.sentimentFunnel?.current?.convRate ?? 0} />
                            <FunnelVis label={data?.sentimentFunnel?.previous?.label ?? 'Last month'} totalCalls={data?.sentimentFunnel?.previous?.totalCalls ?? 0} positiveCalls={data?.sentimentFunnel?.previous?.positiveCalls ?? 0} convRate={data?.sentimentFunnel?.previous?.convRate ?? 0} />
                        </div>
                    )}
                </Card>
                <Card>
                    <CardHeader title="Segment Performance" />
                    {sk ? <Sk className="h-40" /> : !data?.segmentPerformance?.length ? <EmptyState message="No calls logged this month" cta="Open queue →" onCta={() => setView('callQueue')} /> : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-xs min-w-[320px]">
                                <thead><tr className="border-b border-gray-100">
                                    <th className="text-left pb-2 pr-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Segment</th>
                                    <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Called</th>
                                    <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Happy%</th>
                                    <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order%</th>
                                    <th className="text-right pb-2 pl-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Revenue</th>
                                </tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.segmentPerformance.map((s: any) => (
                                        <tr key={s.segment} className="hover:bg-gray-50/50">
                                            <td className="py-2.5 pr-3 font-semibold text-gray-800">{s.segment}</td>
                                            <td className="py-2.5 px-2 text-right text-gray-600">{s.customersCalled}</td>
                                            <td className="py-2.5 px-2 text-right"><span className={`font-bold ${s.happyRate >= 20 ? 'text-emerald-600' : s.happyRate >= 10 ? 'text-amber-600' : 'text-gray-500'}`}>{s.happyRate}%</span></td>
                                            <td className="py-2.5 px-2 text-right"><span className={`font-bold ${s.orderRate >= 5 ? 'text-emerald-600' : s.orderRate >= 2 ? 'text-amber-600' : 'text-gray-500'}`}>{s.orderRate}%</span></td>
                                            <td className="py-2.5 pl-2 text-right font-mono text-gray-700">{s.revenue > 0 ? formatBDT(s.revenue) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            {/* Row 4 — Anomalies */}
            <Card>
                <CardHeader title="Anomalies & Signals" />
                {sk ? <Sk className="h-14" /> : !data?.anomalies?.length ? (
                    <div className="py-4 text-center">
                        <p className="text-sm font-bold text-gray-600">No anomalies detected</p>
                        <p className="text-xs text-gray-400 mt-1">Signals appear once ≥7 days of data exist and a ≥25% deviation is detected.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {data.anomalies.map((item: any) => {
                            const cfg = SEV[item.severity as keyof typeof SEV] ?? SEV.info;
                            return (
                                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                    <p className={`text-sm font-semibold ${cfg.text}`}>{item.message}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
};

// ─── ALL-TIME TAB ─────────────────────────────────────────────────────────────

const AllTimeTab = () => {
    const [data, setData]       = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [trendMetric, setTrendMetric] = useState<'revenue' | 'orders' | 'newCustomers' | 'repeatCustomers'>('revenue');

    const load = useCallback(async () => {
        try { const res = await api.getDashboardAllTime(); setData(res); setError(null); }
        catch (err: any) { setError(err.message || 'Failed to load'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    const sk = loading && !data;

    const LIFECYCLE_CONFIG = [
        { key: 'vip',     label: 'VIP (5+ orders)',    bg: 'bg-violet-100', color: 'text-violet-700' },
        { key: 'loyal',   label: 'Loyal (3-4 orders)', bg: 'bg-blue-100',   color: 'text-blue-700' },
        { key: 'repeat',  label: 'Repeat (2 orders)',  bg: 'bg-sky-100',    color: 'text-sky-700' },
        { key: 'oneTime', label: 'One-time buyer',     bg: 'bg-gray-100',   color: 'text-gray-600' },
        { key: 'outreach',label: 'Outreach only',      bg: 'bg-gray-50',    color: 'text-gray-400' },
    ];

    const VARIANT_COLORS: Record<string, string> = { Chocolate: '#b45309', Natural: '#15803d', Mixed: '#7c3aed', Other: '#94a3b8' };

    const trendOptions = [
        { key: 'revenue',        label: 'Revenue',       color: '#6366f1', fmt: (v: number) => formatBDT(v) },
        { key: 'orders',         label: 'Orders',        color: '#10b981', fmt: (v: number) => String(v) },
        { key: 'newCustomers',   label: 'New Customers', color: '#f59e0b', fmt: (v: number) => String(v) },
        { key: 'repeatCustomers',label: 'Repeat',        color: '#ec4899', fmt: (v: number) => String(v) },
    ] as const;
    const activeTrendOption = trendOptions.find(t => t.key === trendMetric) ?? trendOptions[0];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-end text-[11px]">
                <button onClick={load} className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">Refresh</button>
            </div>
            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">{error}</div>}

            {/* Row 1 — KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total Customers" value={(data?.totalCustomers ?? 0).toLocaleString()} sub={data?.avgLTV ? `Avg LTV ${formatBDT(data.avgLTV)}` : undefined} loading={sk} />
                <KpiCard label="Total Revenue" value={data ? formatBDT(data.totalRevenue) : '—'} sub="All-time" loading={sk} />
                <KpiCard label="Repeat Purchase Rate" value={`${data?.repeatPurchaseRate ?? 0}%`} sub="Customers with 2+ orders" loading={sk} sparkColor="#10b981" />
                <KpiCard label="Avg Reorder Cycle" value={data?.avgReorderCycle ? `${data.avgReorderCycle}d` : '—'} sub="Avg days between orders" loading={sk} />
            </div>

            {/* Row 2 — Distribution cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Lifecycle pyramid */}
                <Card>
                    <CardHeader title="Customer Lifecycle" />
                    {sk ? <div className="space-y-3">{[1,2,3,4,5].map(i => <Sk key={i} className="h-8" />)}</div> : (
                        <LifecyclePyramid data={LIFECYCLE_CONFIG.map(c => ({
                            label: c.label,
                            count: data?.lifecycle?.[c.key] ?? 0,
                            color: c.color,
                            bg: c.bg,
                        }))} />
                    )}
                </Card>

                {/* Revenue concentration */}
                <Card>
                    <CardHeader title="Revenue Concentration" />
                    {sk ? <div className="space-y-3">{[1,2,3,4,5].map(i => <Sk key={i} className="h-8" />)}</div> : !data?.revenueConcentration?.length ? <EmptyState message="No revenue data" /> : (
                        <ConcentrationBars data={data.revenueConcentration} />
                    )}
                </Card>

                {/* Variant preference */}
                <Card>
                    <CardHeader title="Variant Preference" />
                    {sk ? <div className="space-y-3">{[1,2,3,4].map(i => <Sk key={i} className="h-8" />)}</div> : !data?.variantBuckets ? <EmptyState message="No product data" /> : (() => {
                        const buckets = data.variantBuckets as Record<string, number>;
                        const total = Object.values(buckets).reduce((s, v) => s + v, 0) || 1;
                        const entries = Object.entries(buckets).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
                        if (!entries.length) return <EmptyState message="No variant data" />;
                        return (
                            <div className="space-y-3">
                                <div className="flex h-6 rounded-lg overflow-hidden gap-px">
                                    {entries.map(([k, v]) => <div key={k} style={{ width: `${(v / total) * 100}%`, backgroundColor: VARIANT_COLORS[k] ?? '#94a3b8' }} title={`${k}: ${v}`} className="flex-shrink-0" />)}
                                </div>
                                <div className="space-y-2">
                                    {entries.map(([k, v]) => (
                                        <div key={k} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: VARIANT_COLORS[k] ?? '#94a3b8' }} />
                                                <span className="text-gray-700 font-medium">{k}</span>
                                            </div>
                                            <span className="font-mono text-gray-900">{v.toLocaleString()} <span className="text-gray-400 font-normal">({((v / total) * 100).toFixed(0)}%)</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </Card>
            </div>

            {/* Row 3 — Monthly trend */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Trend</h3>
                    <div className="flex gap-1">
                        {trendOptions.map(opt => (
                            <button key={opt.key} onClick={() => setTrendMetric(opt.key)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${trendMetric === opt.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{opt.label}</button>
                        ))}
                    </div>
                </div>
                {sk ? <Sk className="h-36" /> : !data?.monthlyTrend?.length ? <EmptyState message="No historical data" /> : (
                    <MonthlyLineChart data={data.monthlyTrend} dataKey={trendMetric} color={activeTrendOption.color} formatY={trendMetric === 'revenue' ? formatBDT : undefined} />
                )}
            </Card>

            {/* Row 4 — Top products */}
            <Card>
                <CardHeader title="Top Products by Revenue" />
                {sk ? <Sk className="h-40" /> : !data?.topProducts?.length ? <EmptyState message="No product purchase data" /> : (
                    <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-xs min-w-[360px]">
                            <thead><tr className="border-b border-gray-100">
                                <th className="text-left pb-2 pr-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">#</th>
                                <th className="text-left pb-2 pr-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product</th>
                                <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customers</th>
                                <th className="text-right pb-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Orders</th>
                                <th className="text-right pb-2 pl-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Revenue</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.topProducts.map((p: any, i: number) => (
                                    <tr key={p.name} className="hover:bg-gray-50/50">
                                        <td className="py-2.5 pr-3 text-gray-400 font-medium">{i + 1}</td>
                                        <td className="py-2.5 pr-3 font-semibold text-gray-800 max-w-[180px] truncate">{p.name}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-600">{p.customers.toLocaleString()}</td>
                                        <td className="py-2.5 px-2 text-right text-gray-600">{p.orders.toLocaleString()}</td>
                                        <td className="py-2.5 pl-2 text-right font-mono font-bold text-gray-900">{formatBDT(p.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

// ─── Tab bar + main export ────────────────────────────────────────────────────

const TABS = [
    { id: 'today'   as const, label: 'Today',      sub: 'Operational cockpit' },
    { id: 'month'   as const, label: 'This Month',  sub: 'Goal tracking' },
    { id: 'alltime' as const, label: 'All-Time',    sub: 'Business shape' },
];
type Tab = 'today' | 'month' | 'alltime';

const AdminDashboard: React.FC<{ setView: (v: View) => void }> = ({ setView }) => {
    const [tab, setTab] = useState<Tab>('today');
    return (
        <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-1.5 flex gap-1">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex flex-col items-center py-2.5 px-2 rounded-xl transition-all ${tab === t.id ? 'bg-blue-600 shadow-sm' : 'hover:bg-gray-50'}`}>
                        <span className={`text-sm font-bold ${tab === t.id ? 'text-white' : 'text-gray-700'}`}>{t.label}</span>
                        <span className={`text-[10px] hidden sm:block mt-0.5 ${tab === t.id ? 'text-blue-200' : 'text-gray-400'}`}>{t.sub}</span>
                    </button>
                ))}
            </div>
            {tab === 'today'   && <TodayTab setView={setView} />}
            {tab === 'month'   && <MonthTab setView={setView} />}
            {tab === 'alltime' && <AllTimeTab />}
        </div>
    );
};

export default AdminDashboard;
