
import React, { useState, useEffect } from 'react';
import { getCredentialStatus, saveApiCredentials } from '../services/packzyApiService';
import {
    getOutreachTarget, setOutreachTarget,
    getOutreachRange, setOutreachRange,
    getRepeatOnlyMode, setRepeatOnlyMode,
    getValueOnlyMode, setValueOnlyMode,
    getMinOrderValue, setMinOrderValue,
    clearDatabase, getGmtOffset, setGmtOffset,
    getSegmentDistribution, getQueueFocusSegments, setQueueFocusSegments,
    recomputeCustomerStats, normalizePhones,
} from '../services/apiService';
import { CogIcon } from './icons/CogIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { TrashIcon } from './icons/TrashIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ClockIcon } from './icons/ClockIcon';
import { User } from '../types';
import { motion } from 'motion/react';

interface SettingsPageProps {
    currentTarget: number;
    onTargetUpdate: (target: number) => void;
    currentUser: User;
}

const ClearDatabaseModal: React.FC<{onClose: () => void, onConfirm: (pass: string) => Promise<void>}> = ({ onClose, onConfirm }) => {
    const [password, setPassword] = useState('');
    const [answer, setAnswer] = useState('');
    const [challenge] = useState(() => ({
        n1: Math.floor(Math.random() * 25) + 5,
        n2: Math.floor(Math.random() * 12) + 3
    }));
    const [isProcessing, setIsProcessing] = useState(false);
    const expected = challenge.n1 * challenge.n2;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (parseInt(answer) !== expected) { alert("Security challenge failed."); return; }
        setIsProcessing(true);
        try { await onConfirm(password); onClose(); }
        catch (err: any) { alert(err.message); }
        finally { setIsProcessing(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white border border-red-200 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                    <h3 className="font-bold text-red-700 text-base">Purge Database</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl leading-relaxed">
                        ⚠️ This will delete ALL purchase histories and customers without outreach logs. This cannot be undone.
                    </p>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Administrator Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all" placeholder="••••••••" required />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Human check: {challenge.n1} × {challenge.n2} = ?</label>
                        <input type="number" value={answer} onChange={e => setAnswer(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all" placeholder="Answer..." required />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                        <button type="submit" disabled={isProcessing} className="flex-[2] py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all">
                            {isProcessing ? 'Wiping…' : 'Destroy Data'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

const Toggle: React.FC<{checked: boolean, onChange: () => void}> = ({ checked, onChange }) => (
    <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

const Card: React.FC<{icon: any, title: string, description: string, status?: string, statusText?: string, children: React.ReactNode}> = ({ icon: Icon, title, description, status, statusText, children }) => (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
                <div className="bg-gray-50 p-2.5 rounded-xl text-blue-600 border border-gray-200">
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
                </div>
            </div>
            {status === 'success' && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-xl uppercase tracking-wide">
                    {statusText || 'Saved'}
                </span>
            )}
        </div>
        {children}
    </div>
);

const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all";
const btnClass = (color: string) => `px-6 py-2.5 bg-${color}-600 text-white text-xs font-semibold uppercase rounded-xl hover:bg-${color}-700 transition-all`;

const SettingsPage: React.FC<SettingsPageProps> = ({ currentTarget, onTargetUpdate, currentUser }) => {
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [credStatus, setCredStatus] = useState<{ configured: boolean; apiKeyPreview: string; secretKeyPreview: string } | null>(null);
    const [outreachGoal, setOutreachGoal] = useState(currentTarget.toString());
    const [rangeStart, setRangeStart] = useState('32');
    const [rangeEnd, setRangeEnd] = useState('28');
    const [gmtOffset, setGmtOffsetVal] = useState('6');
    const [repeatOnly, setRepeatOnly] = useState(false);
    const [valueOnly, setValueOnly] = useState(false);
    const [minOrderVal, setMinOrderValInput] = useState('0');
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);

    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
    const [goalStatus, setGoalStatus] = useState<'idle' | 'success'>('idle');
    const [rangeStatus, setRangeStatus] = useState<'idle' | 'success'>('idle');
    const [modeStatus, setModeStatus] = useState<'idle' | 'success'>('idle');
    const [valueStatus, setValueStatus] = useState<'idle' | 'success'>('idle');
    const [gmtStatus, setGmtStatus] = useState<'idle' | 'success'>('idle');

    // Tier 1.6: RFM segment focus
    const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
    const [focusSegments, setFocusSegments] = useState<string[]>([]);
    const [focusStatus, setFocusStatus] = useState<'idle' | 'saving' | 'success'>('idle');

    // Manual maintenance buttons
    const [recomputeStatus, setRecomputeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [recomputeResult, setRecomputeResult] = useState<string>('');
    const [normalizeStatus, setNormalizeStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [normalizeResult, setNormalizeResult] = useState<string>('');

    // Ordered display list of RFM segments — most urgent first so checkboxes
    // appear in the order the admin most likely cares about.
    const ALL_SEGMENTS = [
        "Can't Lose", 'At Risk', 'Champion', 'Loyal', 'Potential Loyalist',
        'New', 'Hibernating', 'Lost', 'Outreach Only',
    ];
    const SEGMENT_DESC: Record<string, string> = {
        "Can't Lose":          'URGENT high-value lapsing',
        'At Risk':             'Used to be loyal — win-back',
        'Champion':            'Recent + frequent + high spend',
        'Loyal':               'Frequent buyers',
        'Potential Loyalist':  'Recent + 1-2 orders, push to 3rd',
        'New':                 'Just made first purchase',
        'Hibernating':         'Moderate value, gone silent',
        'Lost':                '6+ months silent',
        'Outreach Only':       'Never purchased',
    };

    useEffect(() => {
        getCredentialStatus().then(setCredStatus).catch(() => setCredStatus({ configured: false, apiKeyPreview: '', secretKeyPreview: '' }));
        setOutreachGoal(currentTarget.toString());
        const fetchData = async () => {
            try {
                const [resRange, resMode, resValMode, resMinVal, resGmt, resSegCounts, resFocus] = await Promise.all([
                    getOutreachRange(), getRepeatOnlyMode(), getValueOnlyMode(), getMinOrderValue(), getGmtOffset(),
                    getSegmentDistribution(), getQueueFocusSegments(),
                ]);
                setRangeStart(resRange.start.toString()); setRangeEnd(resRange.end.toString());
                setRepeatOnly(resMode.value); setValueOnly(resValMode.value);
                setMinOrderValInput(resMinVal.value.toString()); setGmtOffsetVal(resGmt.value.toString());
                setSegmentCounts(resSegCounts || {});
                setFocusSegments(resFocus.value || []);
            } catch (err) { console.error(err); }
        };
        fetchData();
    }, [currentTarget]);

    const toggleSegment = (seg: string) => {
        setFocusSegments(prev => prev.includes(seg) ? prev.filter(s => s !== seg) : [...prev, seg]);
        setFocusStatus('idle');
    };

    const saveFocusSegments = async () => {
        setFocusStatus('saving');
        try {
            await setQueueFocusSegments(focusSegments);
            setFocusStatus('success');
            setTimeout(() => setFocusStatus('idle'), 3000);
        } catch {
            setFocusStatus('idle');
        }
    };

    const runRecompute = async () => {
        setRecomputeStatus('running');
        setRecomputeResult('');
        try {
            const res = await recomputeCustomerStats();
            setRecomputeStatus('done');
            setRecomputeResult(res.message);
            // Refresh segment counts so the focus card reflects the new data.
            const fresh = await getSegmentDistribution();
            setSegmentCounts(fresh || {});
        } catch (err: any) {
            setRecomputeStatus('error');
            setRecomputeResult(err.message || 'Failed');
        }
    };

    const runNormalize = async () => {
        setNormalizeStatus('running');
        setNormalizeResult('');
        try {
            const res = await normalizePhones();
            setNormalizeStatus('done');
            setNormalizeResult(`${res.message}${res.duplicateGroupCount > 0 ? ` — see browser console for the duplicate list.` : ''}`);
            if (res.duplicateGroupCount > 0) {
                console.log('Duplicate customer groups (same normalised phone):', res.duplicates);
            }
        } catch (err: any) {
            setNormalizeStatus('error');
            setNormalizeResult(err.message || 'Failed');
        }
    };

    const autoReset = (setter: (v: any) => void) => { setter('success'); setTimeout(() => setter('idle'), 3000); };

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveApiCredentials({ apiKey, secretKey });
            autoReset(setSaveStatus);
            setApiKey(''); setSecretKey('');
            const status = await getCredentialStatus();
            setCredStatus(status);
        } catch { }
    };

    const handleGoalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try { const val = parseInt(outreachGoal, 10); await setOutreachTarget(val); onTargetUpdate(val); autoReset(setGoalStatus); } catch { }
    };

    const handleRangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try { await setOutreachRange(parseInt(rangeStart), parseInt(rangeEnd)); autoReset(setRangeStatus); } catch { }
    };

    const handleGmtSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try { await setGmtOffset(parseFloat(gmtOffset)); autoReset(setGmtStatus); } catch { }
    };

    const handleRepeatToggle = async () => {
        const v = !repeatOnly;
        try { await setRepeatOnlyMode(v); setRepeatOnly(v); autoReset(setModeStatus); } catch { }
    };

    const handleValueToggle = async () => {
        const v = !valueOnly;
        try { await setValueOnlyMode(v); setValueOnly(v); autoReset(setValueStatus); } catch { }
    };

    const handleMinValSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try { await setMinOrderValue(parseInt(minOrderVal, 10)); autoReset(setValueStatus); } catch { }
    };

    const handleClearDatabase = async (password: string) => {
        const res = await clearDatabase(password, currentUser.email);
        alert(res.message);
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Tier 1.6 — RFM segment focus. Drives Today's Queue. */}
                <Card
                    icon={SparklesIcon}
                    title="Queue Focus Segments"
                    description="Which RFM segments to build Today's Queue from. Leave all unchecked = everyone eligible. Use this to run targeted campaigns (e.g. only Can't Lose + At Risk for a win-back week)."
                    status={focusStatus === 'success' ? 'success' : 'idle'}
                    statusText="Saved"
                >
                    <div className="space-y-2">
                        {ALL_SEGMENTS.map(seg => {
                            const checked = focusSegments.includes(seg);
                            const count = segmentCounts[seg] ?? 0;
                            return (
                                <label
                                    key={seg}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSegment(seg)}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800">{seg}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{SEGMENT_DESC[seg]}</p>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 flex-shrink-0">{count.toLocaleString()}</span>
                                </label>
                            );
                        })}
                        {(segmentCounts['Unclassified'] ?? 0) > 0 && (
                            <p className="text-[11px] text-amber-600 px-1">
                                ⚠ {segmentCounts['Unclassified']} customers have no RFM segment yet — run "Recompute customer stats" below.
                            </p>
                        )}
                        <div className="flex justify-between items-center pt-2">
                            <p className="text-[11px] text-gray-400">
                                {focusSegments.length === 0
                                    ? 'No filter — using all eligible customers.'
                                    : `Filtering to ${focusSegments.length} segment${focusSegments.length === 1 ? '' : 's'} (${focusSegments.reduce((s, seg) => s + (segmentCounts[seg] ?? 0), 0).toLocaleString()} customers).`}
                            </p>
                            <button
                                onClick={saveFocusSegments}
                                disabled={focusStatus === 'saving'}
                                className="px-6 py-2.5 bg-blue-600 text-white text-xs font-semibold uppercase rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
                            >
                                {focusStatus === 'saving' ? 'Saving…' : 'Save Focus'}
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Manual data maintenance (Tier 1.1 / 1.4 / 1.6 / 3.12 backfills). */}
                <Card
                    icon={CogIcon}
                    title="Data Maintenance"
                    description="Recompute derived customer fields (reorder cycle, RFM segment, call-time prediction) and normalise phone numbers. Idempotent — safe to re-run."
                    status={(recomputeStatus === 'done' || normalizeStatus === 'done') ? 'success' : 'idle'}
                    statusText="Done"
                >
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">Recompute customer stats</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Reorder cycle + RFM segment + best call time</p>
                                {recomputeResult && (
                                    <p className={`text-[11px] mt-1.5 ${recomputeStatus === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {recomputeResult}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={runRecompute}
                                disabled={recomputeStatus === 'running'}
                                className="flex-shrink-0 px-5 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
                            >
                                {recomputeStatus === 'running' ? 'Running…' : 'Recompute Now'}
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800">Normalise phone numbers</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Backfill last-10-digits index + duplicate report</p>
                                {normalizeResult && (
                                    <p className={`text-[11px] mt-1.5 ${normalizeStatus === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                                        {normalizeResult}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={runNormalize}
                                disabled={normalizeStatus === 'running'}
                                className="flex-shrink-0 px-5 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-all"
                            >
                                {normalizeStatus === 'running' ? 'Running…' : 'Normalise Now'}
                            </button>
                        </div>
                    </div>
                </Card>

                <Card icon={ClockIcon} title="System Clock" description="Adjust global GMT offset for hourly activity tracking." status={gmtStatus} statusText="Updated">
                    <form onSubmit={handleGmtSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">GMT Offset (Hours)</label>
                            <input type="number" step="0.5" value={gmtOffset} onChange={e => setGmtOffsetVal(e.target.value)} className={inputClass} placeholder="6" required />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-semibold uppercase rounded-xl hover:bg-emerald-700 transition-all">Update Timezone</button>
                        </div>
                    </form>
                </Card>

                <Card icon={SparklesIcon} title="Outreach Focus (Legacy)" description="Applies to the Follow-up list only. For Today's Queue, use the Queue Focus Segments card above." status={modeStatus === 'success' || valueStatus === 'success' ? 'success' : 'idle'}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Repeat Customers Only</p>
                                <p className="text-xs text-gray-400 mt-0.5">Target 2+ purchase profiles</p>
                            </div>
                            <Toggle checked={repeatOnly} onChange={handleRepeatToggle} />
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Value Customers Only</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Target high-spending segments</p>
                                </div>
                                <Toggle checked={valueOnly} onChange={handleValueToggle} />
                            </div>
                            <form onSubmit={handleMinValSubmit} className="flex items-end gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Min Order Value (BDT)</label>
                                    <input type="number" value={minOrderVal} onChange={e => setMinOrderValInput(e.target.value)} className={inputClass} placeholder="500" />
                                </div>
                                <button type="submit" className="px-4 py-2.5 bg-gray-800 text-white text-xs font-semibold rounded-xl hover:bg-gray-900 transition-all">Update</button>
                            </form>
                        </div>
                    </div>
                </Card>

                <Card icon={PhoneIcon} title="Daily Target" description="Target log entries per day for Sales Executives." status={goalStatus} statusText="Updated">
                    <form onSubmit={handleGoalSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Target Calls / Logs</label>
                            <input type="number" value={outreachGoal} onChange={e => setOutreachGoal(e.target.value)} className={inputClass} placeholder="100" required />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="px-6 py-2.5 bg-amber-600 text-white text-xs font-semibold uppercase rounded-xl hover:bg-amber-700 transition-all">Update Target</button>
                        </div>
                    </form>
                </Card>

                <Card icon={CalendarIcon} title="Retention Window (Fallback)" description="Used for the Follow-up list, and for the Queue when a customer doesn't have enough purchase history for a personal reorder cycle. Customers with confident cycles override this." status={rangeStatus} statusText="Updated">
                    <form onSubmit={handleRangeSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Start (Days Ago)</label>
                                <input type="number" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">End (Days Ago)</label>
                                <input type="number" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-400 italic">Example: 32 and 28 will show customers who bought between 28 and 32 days ago.</p>
                        <div className="flex justify-end">
                            <button type="submit" className="px-6 py-2.5 bg-violet-600 text-white text-xs font-semibold uppercase rounded-xl hover:bg-violet-700 transition-all">Update Range</button>
                        </div>
                    </form>
                </Card>

                <Card icon={CogIcon} title="Courier Integration" description="Packzy/Steadfast API keys. Stored encrypted server-side — never exposed to the browser." status={saveStatus}>
                    <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                        {credStatus?.configured && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                <p className="text-[11px] text-emerald-700 font-medium">
                                    Configured · Key {credStatus.apiKeyPreview} · Secret {credStatus.secretKeyPreview}. Enter new values below to replace.
                                </p>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">API Key</label>
                            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={inputClass} placeholder={credStatus?.configured ? 'Enter to replace' : '••••••••'} required={!credStatus?.configured} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Secret Key</label>
                            <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} className={inputClass} placeholder={credStatus?.configured ? 'Enter to replace' : '••••••••'} required={!credStatus?.configured} />
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" disabled={!apiKey || !secretKey} className="px-6 py-2.5 bg-blue-600 text-white text-xs font-semibold uppercase rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">Save Credentials</button>
                        </div>
                    </form>
                </Card>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-gray-200">
                {!showDangerZone ? (
                    <button onClick={() => setShowDangerZone(true)} className="text-xs font-semibold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors">
                        Reveal Danger Zone
                    </button>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 rounded-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
                                <p className="text-xs text-red-500 mt-0.5">Destructive actions that cannot be reversed.</p>
                            </div>
                            <button onClick={() => setShowDangerZone(false)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-red-200">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Clear Global Database</p>
                                <p className="text-xs text-gray-400 mt-0.5">Delete all purchase records and profiles.</p>
                            </div>
                            <button
                                onClick={() => setShowClearModal(true)}
                                className="flex-shrink-0 flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-red-700 transition-all"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Remove Database
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>

            {showClearModal && (
                <ClearDatabaseModal onClose={() => setShowClearModal(false)} onConfirm={handleClearDatabase} />
            )}
        </div>
    );
};

export default SettingsPage;
