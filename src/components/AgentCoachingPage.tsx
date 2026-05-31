import React, { useState, useEffect, useCallback } from 'react';
import { getAgentCoaching, AgentCoachingStat } from '../services/apiService';
import { motion } from 'motion/react';

type Preset = 'today' | '7days' | '30days' | 'all';
const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today',  label: 'Today' },
    { id: '7days',  label: 'Last 7 Days' },
    { id: '30days', label: 'Last 30 Days' },
    { id: 'all',    label: 'All Time' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
function getRange(p: Preset): { startDate?: string; endDate?: string } {
    const now = new Date();
    if (p === 'today')  return { startDate: startOfDay(now).toISOString(), endDate: endOfDay(now).toISOString() };
    if (p === '7days')  { const s = new Date(now); s.setDate(s.getDate() - 6); return { startDate: startOfDay(s).toISOString(), endDate: endOfDay(now).toISOString() }; }
    if (p === '30days') { const s = new Date(now); s.setDate(s.getDate() - 29); return { startDate: startOfDay(s).toISOString(), endDate: endOfDay(now).toISOString() }; }
    return {}; // all time
}

const FLAG_META: Record<string, { label: string; color: string }> = {
    'star-closer':    { label: '⭐ Star Closer',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    'great-rapport':  { label: '😊 Great Rapport',  color: 'bg-teal-100 text-teal-700 border-teal-200' },
    'low-conversion': { label: '⚠ Low Conversion',  color: 'bg-amber-100 text-amber-800 border-amber-200' },
    'high-negative':  { label: '🔻 Sours Customers', color: 'bg-red-100 text-red-700 border-red-200' },
    'low-contact':    { label: '📵 Low Contact Rate', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    'low-sample':     { label: 'Low sample', color: 'bg-gray-100 text-gray-400 border-gray-200' },
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const bdt = (n: number) => `৳${Math.round(n).toLocaleString()}`;

const AgentCoachingPage: React.FC = () => {
    const [data, setData] = useState<{ agents: AgentCoachingStat[]; teamAverages: any } | null>(null);
    const [loading, setLoading] = useState(true);
    const [preset, setPreset] = useState<Preset>('30days');

    const load = useCallback(async (p: Preset) => {
        setLoading(true);
        try {
            const { startDate, endDate } = getRange(p);
            setData(await getAgentCoaching(startDate, endDate));
        } catch (err) {
            console.error('Coaching fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(preset); }, [preset, load]);

    const team = data?.teamAverages;
    const agents = data?.agents ?? [];

    // Colour a metric vs the team average: green if better, red if worse.
    const vsTeam = (val: number, avg: number, higherIsBetter = true) => {
        if (!avg) return 'text-gray-700';
        const better = higherIsBetter ? val >= avg : val <= avg;
        return better ? 'text-emerald-600' : 'text-red-500';
    };

    return (
        <div className="space-y-5 pb-12">
            {/* Period filter */}
            <div className="glass-surface p-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Period</span>
                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map(p => (
                        <button key={p.id} onClick={() => setPreset(p.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${preset === p.id ? 'glass-chip-selected text-foreground' : 'text-foreground/55 hover:text-foreground/85 hover:bg-foreground/5'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Team averages */}
            {team && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Avg Conversion', value: pct(team.conversionRate), sub: 'orders ÷ contacted calls' },
                        { label: 'Avg Positive Rate', value: pct(team.positiveRate), sub: 'happy ÷ contacted' },
                        { label: 'Avg Negative Rate', value: pct(team.negativeRate), sub: 'not-interested+angry ÷ contacted' },
                        { label: 'Avg Revenue / Call', value: bdt(team.revenuePerCall), sub: 'order BDT ÷ total calls' },
                    ].map(s => (
                        <div key={s.label} className="glass-surface p-5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                            <p className="text-2xl font-black text-gray-900 mt-1 font-mono">{s.value}</p>
                            <p className="text-[11px] text-gray-400 mt-1">{s.sub}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Agent table */}
            <div className="glass-surface overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800">Agent Quality — ranked by conversion</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Coaching flags compare each agent to the team average (agents with ≥10 calls).</p>
                </div>
                {loading ? (
                    <div className="py-16 text-center text-gray-400 italic">Loading…</div>
                ) : agents.length === 0 ? (
                    <div className="py-16 text-center text-gray-400 italic">No call data for this period.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[760px]">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Calls</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact%</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Positive%</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Negative%</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Orders</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Conv%</th>
                                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">৳/Call</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Signals</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {agents.map((a, i) => (
                                    <motion.tr
                                        key={a.agent}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                        className="hover:bg-gray-50/50"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                                                    {a.agent.charAt(0)}
                                                </div>
                                                <span className="font-semibold text-gray-800 truncate max-w-[120px]">{a.agent}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono text-gray-700">{a.totalCalls}</td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${a.contactRate < 0.4 ? 'text-red-500' : 'text-gray-700'}`}>{pct(a.contactRate)}</td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${vsTeam(a.positiveRate, team?.positiveRate)}`}>{pct(a.positiveRate)}</td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${vsTeam(a.negativeRate, team?.negativeRate, false)}`}>{pct(a.negativeRate)}</td>
                                        <td className="px-3 py-3 text-right font-mono text-gray-700">{a.orders}</td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${vsTeam(a.conversionRate, team?.conversionRate)}`}>{pct(a.conversionRate)}</td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${vsTeam(a.revenuePerCall, team?.revenuePerCall)}`}>{bdt(a.revenuePerCall)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {a.flags.filter(f => f !== 'low-sample').map(f => (
                                                    <span key={f} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${FLAG_META[f]?.color ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                        {FLAG_META[f]?.label ?? f}
                                                    </span>
                                                ))}
                                                {a.flags.includes('low-sample') && (
                                                    <span className="text-[9px] text-gray-300 italic">too few calls to rate</span>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentCoachingPage;
