
import React, { useState, useEffect, useCallback } from 'react';
import { User, FollowUpNote } from '../types';
import * as api from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';

interface QueueItem {
    id: string;
    name: string;
    phone: string;
    score: number;
    reason: string;
    lastSentiment: string | null;
    daysSinceLastCall: number | null;
    daysSinceLastOrder: number | null;
    totalSpending: number;
    purchaseCount: number;
    // Tier 1.1: personalised reorder cycle
    predictedReorderDays?: number | null;
    reorderConfidence?: 'none' | 'low' | 'medium' | 'high';
    reorderStatus?: 'early' | 'ripe' | 'overdue' | 'churn-risk' | null;
    daysVsReorder?: number | null;
    // Tier 1.6: RFM segment + recommended action
    rfmSegment?: string | null;
    rfmAction?: string | null;
}

interface QueueResponse {
    queue: QueueItem[];
    suppressed: number;
    totalEligible: number;
    generatedAt: string;
}

const SENTIMENTS: FollowUpNote['feedback'][] = [
    'Happy', 'Positive', 'Neutral', 'Call Back Later', 'Call Not Received', 'Not Interested', 'Angry'
];

const SENTIMENT_COLORS: Record<string, string> = {
    Happy: 'bg-emerald-100 text-emerald-700',
    Positive: 'bg-green-100 text-green-700',
    Neutral: 'bg-gray-100 text-gray-600',
    'Call Back Later': 'bg-blue-100 text-blue-700',
    'Call Not Received': 'bg-rose-100 text-rose-600',
    'Not Interested': 'bg-orange-100 text-orange-600',
    Angry: 'bg-red-100 text-red-700',
};

const scoreColor = (score: number) => {
    if (score >= 180) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 100) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-gray-50 text-gray-500 border-gray-200';
};

const segmentLabel = (purchaseCount: number) => {
    if (purchaseCount >= 5) return { label: 'VIP', color: 'bg-violet-100 text-violet-700' };
    if (purchaseCount >= 3) return { label: 'Loyal', color: 'bg-blue-100 text-blue-700' };
    if (purchaseCount === 2) return { label: 'Repeat', color: 'bg-sky-100 text-sky-700' };
    if (purchaseCount === 1) return { label: '1× Buyer', color: 'bg-gray-100 text-gray-600' };
    return { label: 'Outreach', color: 'bg-gray-100 text-gray-500' };
};

// Tier 1.1 — reorder-cycle badge. Tells the agent at a glance whether this
// customer is in their personal buying window. "Ripe" = highest conversion EV.
const reorderBadge = (status: QueueItem['reorderStatus'], daysVs: number | null | undefined, predicted: number | null | undefined) => {
    if (!status || predicted == null) return null;
    if (status === 'ripe')        return { label: `Ripe now · ~${predicted}d cycle`, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (status === 'early')       return { label: `${Math.abs(daysVs ?? 0)}d early · ~${predicted}d cycle`, color: 'bg-sky-50 text-sky-700 border-sky-200' };
    if (status === 'overdue')     return { label: `${daysVs}d overdue · ~${predicted}d cycle`, color: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (status === 'churn-risk')  return { label: `${daysVs}d past cycle · churn risk`, color: 'bg-red-100 text-red-700 border-red-200' };
    return null;
};

// Tier 1.6 — RFM segment badge. Tells the agent what KIND of customer this
// is so they pick the right approach (upsell vs. win-back vs. nurture).
const RFM_BADGE_COLORS: Record<string, string> = {
    "Champion":            'bg-violet-100 text-violet-700 border-violet-200',
    "Loyal":               'bg-blue-100 text-blue-700 border-blue-200',
    "Potential Loyalist":  'bg-sky-100 text-sky-700 border-sky-200',
    "New":                 'bg-teal-100 text-teal-700 border-teal-200',
    "At Risk":             'bg-orange-100 text-orange-700 border-orange-200',
    "Can't Lose":          'bg-red-100 text-red-700 border-red-200',
    "Hibernating":         'bg-gray-100 text-gray-600 border-gray-200',
    "Lost":                'bg-gray-100 text-gray-400 border-gray-200',
    "Outreach Only":       'bg-gray-100 text-gray-500 border-gray-200',
};

const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
);

const WhatsAppIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

interface LogFormState {
    feedback: FollowUpNote['feedback'];
    notes: string;
    reminderDate: string;
    submitting: boolean;
}

const CallQueuePage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [data, setData] = useState<QueueResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [logForms, setLogForms] = useState<Record<string, LogFormState>>({});

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        setDismissed(new Set());
        setExpandedId(null);
        try {
            const res = await api.getCallQueue(currentUser.name, 50);
            setData(res);
        } catch (err: any) {
            setError(err.message || 'Failed to load queue');
        } finally {
            setLoading(false);
        }
    }, [currentUser.name]);

    useEffect(() => { fetch(); }, [fetch]);

    const visibleQueue = (data?.queue ?? []).filter(item => !dismissed.has(item.id));

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
        if (!logForms[id]) {
            setLogForms(prev => ({
                ...prev,
                [id]: { feedback: 'Neutral', notes: '', reminderDate: '', submitting: false }
            }));
        }
    };

    const updateForm = (id: string, patch: Partial<LogFormState>) => {
        setLogForms(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const submitLog = async (item: QueueItem) => {
        const form = logForms[item.id];
        if (!form || form.submitting) return;
        updateForm(item.id, { submitting: true });
        try {
            const note: FollowUpNote = {
                date: new Date(),
                feedback: form.feedback,
                notes: form.notes.trim() || undefined,
                agent: currentUser.name,
                reminderDate: form.reminderDate ? new Date(form.reminderDate) : undefined,
                reminderStatus: form.reminderDate ? 'pending' : undefined,
            };
            await api.addFollowUpNote(item.id, note);
            setDismissed(prev => new Set([...prev, item.id]));
            setExpandedId(null);
        } catch (err: any) {
            updateForm(item.id, { submitting: false });
            setError(err.message || 'Failed to save');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400 font-medium">Building your call queue...</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-12">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Today's Call Queue</h2>
                    {data && (
                        <p className="text-xs text-gray-400 mt-0.5">
                            {visibleQueue.length} remaining · {data.suppressed} suppressed · {data.totalEligible} eligible total
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {data && (
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                            Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={fetch}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all"
                    >
                        <RefreshIcon />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">{error}</div>
            )}

            {/* Queue list */}
            {visibleQueue.length === 0 && !loading && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-16 text-center">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-700">Queue complete!</p>
                    <p className="text-xs text-gray-400 mt-1">All assigned calls have been logged. Refresh for a new batch.</p>
                </div>
            )}

            <div className="space-y-2">
                <AnimatePresence>
                    {visibleQueue.map((item, idx) => {
                        const form = logForms[item.id];
                        const isExpanded = expandedId === item.id;
                        const seg = segmentLabel(item.purchaseCount);
                        const waUrl = `https://wa.me/88${item.phone}`;

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
                            >
                                {/* Main row */}
                                <div className="flex items-start gap-4 px-5 py-4">
                                    {/* Rank */}
                                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                                        <span className="text-[11px] font-bold text-gray-400">{idx + 1}</span>
                                    </div>

                                    {/* Customer info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-gray-900">{item.name}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${seg.color}`}>{seg.label}</span>
                                            {item.rfmSegment && item.rfmSegment !== 'Outreach Only' && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RFM_BADGE_COLORS[item.rfmSegment] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                    {item.rfmSegment}
                                                </span>
                                            )}
                                            {item.lastSentiment && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SENTIMENT_COLORS[item.lastSentiment] ?? 'bg-gray-100 text-gray-500'}`}>
                                                    {item.lastSentiment}
                                                </span>
                                            )}
                                            {(() => {
                                                const rb = reorderBadge(item.reorderStatus, item.daysVsReorder, item.predictedReorderDays);
                                                return rb ? (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rb.color}`}>
                                                        {rb.label}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>
                                        <p className="text-xs text-gray-400 font-mono">{item.phone}</p>
                                        <p className="text-xs text-gray-500 mt-1">{item.reason}</p>
                                        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                                            <span>৳{item.totalSpending.toLocaleString()}</span>
                                            {item.daysSinceLastOrder !== null && <span>{item.daysSinceLastOrder}d since order</span>}
                                            {item.daysSinceLastCall !== null
                                                ? <span>{item.daysSinceLastCall}d since last call</span>
                                                : <span>Never called</span>}
                                        </div>
                                    </div>

                                    {/* Score + actions */}
                                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${scoreColor(item.score)}`}>
                                            {item.score}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={waUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                                title="Open in WhatsApp"
                                            >
                                                <WhatsAppIcon />
                                            </a>
                                            <button
                                                onClick={() => toggleExpand(item.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                                    isExpanded
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                                }`}
                                            >
                                                <PhoneIcon />
                                                Log Call
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Inline log form */}
                                <AnimatePresence>
                                    {isExpanded && form && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-5 border-t border-gray-100 pt-4 bg-gray-50/50">
                                                {item.rfmAction && (
                                                    <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
                                                        <span className="text-base flex-shrink-0">💡</span>
                                                        <p className="text-xs text-blue-900 font-medium leading-relaxed">{item.rfmAction}</p>
                                                    </div>
                                                )}
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <div className="flex-1 space-y-3">
                                                        {/* Sentiment */}
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Outcome</label>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {SENTIMENTS.map(s => (
                                                                    <button
                                                                        key={s}
                                                                        onClick={() => updateForm(item.id, { feedback: s })}
                                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                                                            form.feedback === s
                                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                                                                        }`}
                                                                    >
                                                                        {s}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {/* Notes */}
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notes</label>
                                                            <textarea
                                                                rows={2}
                                                                value={form.notes}
                                                                onChange={e => updateForm(item.id, { notes: e.target.value })}
                                                                placeholder="Optional call notes..."
                                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none resize-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="sm:w-44 space-y-3">
                                                        {/* Reminder */}
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Callback Date</label>
                                                            <input
                                                                type="date"
                                                                value={form.reminderDate}
                                                                onChange={e => updateForm(item.id, { reminderDate: e.target.value })}
                                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                                                            />
                                                        </div>
                                                        {/* Submit */}
                                                        <button
                                                            onClick={() => submitLog(item)}
                                                            disabled={form.submitting}
                                                            className="w-full bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            {form.submitting ? 'Saving...' : 'Save & Next'}
                                                        </button>
                                                        <button
                                                            onClick={() => setExpandedId(null)}
                                                            className="w-full text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors py-1"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default CallQueuePage;
