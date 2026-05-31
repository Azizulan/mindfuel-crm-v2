
import React, { useState, useEffect, useCallback } from 'react';
import { ExecutivePerformance } from '../types';
import { getExecutivePerformance } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import { StarIcon } from './icons/StarIcon';
import { TrendingUp } from 'lucide-react';
import { UsersIcon } from './icons/UsersIcon';
import { CalendarIcon } from 'lucide-react';

type Preset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today',     label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days',     label: 'Last 7 Days' },
    { id: '30days',    label: 'Last 30 Days' },
    { id: 'custom',    label: 'Custom Range' },
];

function toISO(d: Date) { return d.toISOString(); }
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

function getRange(preset: Preset, customStart: string, customEnd: string): { startDate?: string; endDate?: string } {
    const now = new Date();
    if (preset === 'today')     return { startDate: toISO(startOfDay(now)),  endDate: toISO(endOfDay(now)) };
    if (preset === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return { startDate: toISO(startOfDay(y)), endDate: toISO(endOfDay(y)) };
    }
    if (preset === '7days') {
        const s = new Date(now); s.setDate(s.getDate() - 6);
        return { startDate: toISO(startOfDay(s)), endDate: toISO(endOfDay(now)) };
    }
    if (preset === '30days') {
        const s = new Date(now); s.setDate(s.getDate() - 29);
        return { startDate: toISO(startOfDay(s)), endDate: toISO(endOfDay(now)) };
    }
    // custom
    return {
        startDate: customStart ? toISO(startOfDay(new Date(customStart))) : undefined,
        endDate:   customEnd   ? toISO(endOfDay(new Date(customEnd)))     : undefined,
    };
}

const ExecutivePerformancePage: React.FC = () => {
    const [data, setData]               = useState<ExecutivePerformance[]>([]);
    const [isLoading, setIsLoading]     = useState(false);
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [preset, setPreset]           = useState<Preset>('30days');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd]     = useState('');

    const fetchData = useCallback(async (p: Preset, cs: string, ce: string) => {
        setIsLoading(true);
        try {
            const { startDate, endDate } = getRange(p, cs, ce);
            const result = await getExecutivePerformance(startDate, endDate);
            setData(result);
        } catch (err) {
            console.error('Performance fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (preset !== 'custom') fetchData(preset, customStart, customEnd);
    }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCustomApply = () => {
        if (customStart && customEnd) fetchData('custom', customStart, customEnd);
    };

    const getMonthName = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const totalEarnings = data.reduce((sum, a) => sum + a.history.reduce((h, r) => h + (r.earnings || 0), 0), 0);
    const totalOrders   = data.reduce((sum, a) => sum + a.history.reduce((h, r) => h + (r.orderCount || 0), 0), 0);

    return (
        <div className="space-y-6 pb-12">

            {/* Date range filter */}
            <div className="glass-surface p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest flex-shrink-0">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Period
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setPreset(p.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                preset === p.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {preset === 'custom' && (
                    <div className="flex items-center gap-2 ml-auto">
                        <input
                            type="date"
                            value={customStart}
                            onChange={e => setCustomStart(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={e => setCustomEnd(e.target.value)}
                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                        />
                        <button
                            onClick={handleCustomApply}
                            disabled={!customStart || !customEnd}
                            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>

            {/* Summary + Refresh */}
            <div className="flex items-center justify-between gap-4">
                <div className="grid grid-cols-3 gap-4 flex-1">
                    {[
                        { label: 'Total Earnings',  value: `৳${totalEarnings.toLocaleString()}`, color: 'text-blue-600',   bg: 'bg-blue-50',   icon: <TrendingUp className="w-4 h-4" /> },
                        { label: 'Total Orders',    value: totalOrders.toLocaleString(),          color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <StarIcon className="w-4 h-4" /> },
                        { label: 'Active Execs',    value: data.length.toString(),                color: 'text-violet-600',  bg: 'bg-violet-50',  icon: <UsersIcon className="w-4 h-4" /> },
                    ].map(stat => (
                        <div key={stat.label} className="glass-surface p-4 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center flex-shrink-0`}>{stat.icon}</div>
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => fetchData(preset, customStart, customEnd)}
                    className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-all shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Agent list */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="p-16 text-center text-gray-400 italic bg-white rounded-2xl border border-dashed border-gray-300">
                        Loading…
                    </div>
                ) : data.length > 0 ? data.map((agent, index) => (
                    <motion.div
                        key={agent.agentName}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                        <div
                            className="px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedAgent(expandedAgent === agent.agentName ? null : agent.agentName)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm">
                                    {agent.agentName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">{agent.agentName}</h4>
                                    <p className="text-[10px] text-gray-400">{agent.history.length} month{agent.history.length > 1 ? 's' : ''} on record</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Latest Bonus</p>
                                    <p className="text-lg font-bold text-blue-600">৳{(agent.history[0]?.earnings || 0).toLocaleString()}</p>
                                </div>
                                <motion.svg animate={{ rotate: expandedAgent === agent.agentName ? 180 : 0 }} transition={{ duration: 0.25 }} xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </motion.svg>
                            </div>
                        </div>

                        <AnimatePresence>
                            {expandedAgent === agent.agentName && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-5 pb-5 border-t border-gray-100">
                                        <div className="overflow-x-auto rounded-xl border border-gray-200 mt-4">
                                            <table className="min-w-full divide-y divide-gray-100">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                                                        <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Outreach</th>
                                                        <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                                                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Bonus (৳)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {agent.history.map((record: any, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-5 py-3 text-sm font-medium text-gray-700">{getMonthName(record.month)}</td>
                                                            <td className="px-5 py-3 text-center">
                                                                <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-xs font-semibold">{record.outreachCount || 0}</span>
                                                            </td>
                                                            <td className="px-5 py-3 text-center">
                                                                <span className="bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full text-xs font-semibold">{record.orderCount || 0}</span>
                                                            </td>
                                                            <td className="px-5 py-3 text-right text-sm font-bold text-gray-800">৳{(record.earnings || 0).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-gray-50">
                                                    <tr>
                                                        <td className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Period Totals</td>
                                                        <td className="px-5 py-3 text-center text-xs font-bold text-gray-700">{agent.history.reduce((s: number, r: any) => s + (r.outreachCount || 0), 0)}</td>
                                                        <td className="px-5 py-3 text-center text-xs font-bold text-gray-700">{agent.history.reduce((s: number, r: any) => s + (r.orderCount || 0), 0)}</td>
                                                        <td className="px-5 py-3 text-right text-xs font-bold text-blue-600">৳{agent.history.reduce((s: number, r: any) => s + (r.earnings || 0), 0).toLocaleString()}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )) : (
                    <div className="p-16 text-center text-gray-400 italic bg-white rounded-2xl border border-dashed border-gray-300">
                        No performance data found for this period.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExecutivePerformancePage;
