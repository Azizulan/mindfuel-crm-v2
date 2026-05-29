import React, { useState, useEffect, useCallback } from 'react';
import { User, FollowUpNote } from '../types';
import { getWinBackQueue, WinBackCustomer, addFollowUpNote } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';

const bdt = (n: number) => `৳${Math.round(n).toLocaleString()}`;

const SENTIMENTS: FollowUpNote['feedback'][] = [
    'Happy', 'Positive', 'Neutral', 'Call Back Later', 'Call Not Received', 'Not Interested', 'Angry',
];

const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
    </svg>
);

const WinBackPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [data, setData] = useState<{ customers: WinBackCustomer[]; count: number; cantLoseCount: number; totalValueAtRisk: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [forms, setForms] = useState<Record<string, { feedback: FollowUpNote['feedback']; notes: string; submitting: boolean }>>({});

    const load = useCallback(async () => {
        setLoading(true);
        setDismissed(new Set());
        try { setData(await getWinBackQueue(100)); }
        catch (err) { console.error('Win-back fetch failed:', err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const visible = (data?.customers ?? []).filter(c => !dismissed.has(c.id));

    const submitLog = async (c: WinBackCustomer) => {
        const form = forms[c.id];
        if (!form || form.submitting) return;
        setForms(p => ({ ...p, [c.id]: { ...form, submitting: true } }));
        try {
            await addFollowUpNote(c.id, {
                date: new Date(), feedback: form.feedback,
                notes: form.notes.trim() || undefined, agent: currentUser.name,
            } as FollowUpNote);
            setDismissed(p => new Set([...p, c.id]));
            setExpandedId(null);
        } catch {
            setForms(p => ({ ...p, [c.id]: { ...form, submitting: false } }));
        }
    };

    return (
        <div className="space-y-5 pb-12">
            {/* Header / value at risk */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 shadow-sm text-white">
                <p className="text-xs font-semibold text-amber-100 uppercase tracking-widest">Revenue at Risk — Save Squad</p>
                <p className="text-4xl font-black mt-2 tracking-tight">{data ? bdt(data.totalValueAtRisk) : '—'}</p>
                <p className="text-amber-100 text-sm mt-1">
                    {data?.count ?? 0} lapsing customers · {data?.cantLoseCount ?? 0} are high-value "Can't Lose"
                </p>
            </div>

            <div className="flex justify-end">
                <button onClick={load} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all">
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="py-16 text-center text-gray-400 italic">Building win-back list…</div>
            ) : visible.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-16 text-center">
                    <p className="text-sm font-bold text-gray-700">No customers at risk right now 🎉</p>
                    <p className="text-xs text-gray-400 mt-1">Your retention is healthy — nobody valuable is lapsing.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {visible.map(c => {
                            const form = forms[c.id] || { feedback: 'Neutral', notes: '', submitting: false };
                            const expanded = expandedId === c.id;
                            const waUrl = `https://wa.me/88${c.phone}`;
                            return (
                                <motion.div
                                    key={c.id} layout
                                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: 40, height: 0 }} transition={{ duration: 0.2 }}
                                    className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
                                >
                                    <div className="flex items-start gap-4 px-5 py-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className="text-sm font-bold text-gray-900">{c.name}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.rfmSegment === "Can't Lose" ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                                    {c.rfmSegment}
                                                </span>
                                                {c.lastSentiment && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{c.lastSentiment}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 font-mono">{c.phone}</p>
                                            <p className="text-xs text-gray-600 mt-1">{c.rfmAction}</p>
                                            {c.recommendedProduct && (
                                                <p className="text-xs text-emerald-700 mt-1 font-medium" title={c.recommendedProductReason ?? ''}>
                                                    🎯 Recommend: <span className="font-bold">{c.recommendedProduct}</span>
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                                                <span className="text-amber-600">{bdt(c.valueAtRisk)} at risk</span>
                                                <span>{c.purchaseCount} orders</span>
                                                {c.daysSinceLastOrder !== null && <span>{c.daysSinceLastOrder}d since order</span>}
                                                {c.daysOverCycle !== null && c.daysOverCycle > 0 && <span className="text-red-500">{c.daysOverCycle}d past cycle</span>}
                                                {c.bestCallSummary && <span className="text-emerald-600 normal-case">{c.bestCallSummary}</span>}
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="WhatsApp">
                                                <WhatsAppIcon />
                                            </a>
                                            <button
                                                onClick={() => {
                                                    setExpandedId(expanded ? null : c.id);
                                                    if (!forms[c.id]) setForms(p => ({ ...p, [c.id]: { feedback: 'Neutral', notes: '', submitting: false } }));
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${expanded ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                            >
                                                Log Call
                                            </button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {expanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                                <div className="px-5 pb-5 border-t border-gray-100 pt-4 bg-gray-50/50 space-y-3">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {SENTIMENTS.map(s => (
                                                            <button key={s}
                                                                onClick={() => setForms(p => ({ ...p, [c.id]: { ...form, feedback: s } }))}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${form.feedback === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                                                            >{s}</button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                        rows={2} value={form.notes}
                                                        onChange={e => setForms(p => ({ ...p, [c.id]: { ...form, notes: e.target.value } }))}
                                                        placeholder="Win-back call notes…"
                                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                                                    />
                                                    <button onClick={() => submitLog(c)} disabled={form.submitting}
                                                        className="w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
                                                        {form.submitting ? 'Saving…' : 'Save & Next'}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default WinBackPage;
