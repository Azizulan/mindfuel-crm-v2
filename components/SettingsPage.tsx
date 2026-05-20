
import React, { useState, useEffect } from 'react';
import { getApiCredentials, saveApiCredentials } from '../services/packzyApiService';
import { 
    getOutreachTarget, setOutreachTarget, 
    getOutreachRange, setOutreachRange, 
    getRepeatOnlyMode, setRepeatOnlyMode, 
    getValueOnlyMode, setValueOnlyMode,
    getMinOrderValue, setMinOrderValue,
    clearDatabase, getGmtOffset, setGmtOffset 
} from '../services/apiService';
import { CogIcon } from './icons/CogIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { TrashIcon } from './icons/TrashIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ClockIcon } from './icons/ClockIcon';
import { User } from '../types';

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
        if (parseInt(answer) !== expected) {
            alert("Security challenge failed. Please verify the multiplication.");
            return;
        }
        setIsProcessing(true);
        try {
            await onConfirm(password);
            onClose();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-100">
                <div className="p-6 bg-rose-50 border-b border-rose-100 flex justify-between items-center text-rose-800">
                    <h3 className="font-black uppercase tracking-tighter text-xl">Purge Master Database</h3>
                    <button onClick={onClose} className="hover:rotate-90 transition-transform"><XMarkIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="bg-rose-100/50 p-4 rounded-lg text-rose-700 text-xs font-bold leading-relaxed border border-rose-200">
                        ⚠️ WARNING: This action will delete ALL purchase histories and customers without existing outreach logs. Outreach notes will be kept, but attached to cleaned records.
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Administrator Password</label>
                        <input 
                            type="password"
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:border-rose-300 outline-none transition-colors text-slate-900" 
                            placeholder="••••••••"
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verify you are human: {challenge.n1} × {challenge.n2} = ?</label>
                        <input 
                            type="number"
                            value={answer} 
                            onChange={e => setAnswer(e.target.value)} 
                            className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:border-rose-300 outline-none transition-colors text-slate-900" 
                            placeholder="Result..."
                            required 
                        />
                    </div>
                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                        <button type="submit" disabled={isProcessing} className="flex-[2] py-3 bg-rose-600 text-white text-xs font-black uppercase rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-200 disabled:opacity-50 transition-all">
                            {isProcessing ? 'Wiping...' : 'Destroy Data'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SettingsPage: React.FC<SettingsPageProps> = ({ currentTarget, onTargetUpdate, currentUser }) => {
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [outreachGoal, setOutreachGoal] = useState(currentTarget.toString());
    const [rangeStart, setRangeStart] = useState('32');
    const [rangeEnd, setRangeEnd] = useState('28');
    const [gmtOffset, setGmtOffsetVal] = useState('6');
    const [repeatOnly, setRepeatOnly] = useState(false);
    const [valueOnly, setValueOnly] = useState(false);
    const [minOrderVal, setMinOrderValInput] = useState('0');
    
    const [showDangerZone, setShowDangerZone] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);
    
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [goalStatus, setGoalStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [rangeStatus, setRangeStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [modeStatus, setModeStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [valueStatus, setValueStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [gmtStatus, setGmtStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const creds = getApiCredentials();
        if (creds) {
            setApiKey(creds.apiKey);
            setSecretKey(creds.secretKey);
        }
        setOutreachGoal(currentTarget.toString());
        
        const fetchData = async () => {
            try {
                const [resRange, resMode, resValMode, resMinVal, resGmt] = await Promise.all([
                    getOutreachRange(),
                    getRepeatOnlyMode(),
                    getValueOnlyMode(),
                    getMinOrderValue(),
                    getGmtOffset()
                ]);
                setRangeStart(resRange.start.toString());
                setRangeEnd(resRange.end.toString());
                setRepeatOnly(resMode.value);
                setValueOnly(resValMode.value);
                setMinOrderValInput(resMinVal.value.toString());
                setGmtOffsetVal(resGmt.value.toString());
            } catch (err) { console.error(err); }
        };
        fetchData();
    }, [currentTarget]);

    const handleCredentialsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            saveApiCredentials({ apiKey, secretKey });
            setSaveStatus('success');
        } catch {
            setSaveStatus('error');
        } finally {
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const handleGoalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const val = parseInt(outreachGoal, 10);
            if (isNaN(val) || val < 0) throw new Error("Invalid number");
            await setOutreachTarget(val);
            onTargetUpdate(val);
            setGoalStatus('success');
        } catch {
            setGoalStatus('error');
        } finally {
            setTimeout(() => setGoalStatus('idle'), 3000);
        }
    };

    const handleRangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const start = parseInt(rangeStart, 10);
            const end = parseInt(rangeEnd, 10);
            if (isNaN(start) || isNaN(end)) throw new Error("Invalid number");
            await setOutreachRange(start, end);
            setRangeStatus('success');
        } catch {
            setRangeStatus('error');
        } finally {
            setTimeout(() => setRangeStatus('idle'), 3000);
        }
    }

    const handleGmtSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const val = parseFloat(gmtOffset);
            if (isNaN(val)) throw new Error("Invalid number");
            await setGmtOffset(val);
            setGmtStatus('success');
        } catch {
            setGmtStatus('error');
        } finally {
            setTimeout(() => setGmtStatus('idle'), 3000);
        }
    };

    const handleRepeatModeToggle = async () => {
        const newVal = !repeatOnly;
        try {
            await setRepeatOnlyMode(newVal);
            setRepeatOnly(newVal);
            setModeStatus('success');
        } catch {
            setModeStatus('error');
        } finally {
            setTimeout(() => setModeStatus('idle'), 2000);
        }
    };

    const handleValueModeToggle = async () => {
        const newVal = !valueOnly;
        try {
            await setValueOnlyMode(newVal);
            setValueOnly(newVal);
            setValueStatus('success');
        } catch {
            setValueStatus('error');
        } finally {
            setTimeout(() => setValueStatus('idle'), 2000);
        }
    };

    const handleMinValSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const val = parseInt(minOrderVal, 10);
            if (isNaN(val)) throw new Error("Invalid number");
            await setMinOrderValue(val);
            setValueStatus('success');
        } catch {
            setValueStatus('error');
        } finally {
            setTimeout(() => setValueStatus('idle'), 2000);
        }
    };

    const handleClearDatabase = async (password: string) => {
        const res = await clearDatabase(password, currentUser.email);
        alert(res.message);
    }

    return (
        <div className="space-y-8 pb-32">
            {/* System Timezone */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 max-w-2xl">
                <div className="flex items-start space-x-4">
                    <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                        <ClockIcon />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">System Clock</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Adjust global GMT offset for hourly activity tracking.
                        </p>
                    </div>
                </div>
                
                <form onSubmit={handleGmtSubmit} className="space-y-6 mt-6">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">GMT Offset (Hours)</label>
                        <input
                            type="number"
                            step="0.5"
                            value={gmtOffset}
                            onChange={(e) => setGmtOffsetVal(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm sm:text-sm font-bold text-slate-900"
                            placeholder="6"
                            required
                        />
                    </div>
                    <div className="flex items-center justify-end space-x-4">
                         {gmtStatus === 'success' && <p className="text-xs font-bold text-green-600">Timezone updated!</p>}
                        <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-xs font-black uppercase tracking-widest rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                        >
                            Update Timezone
                        </button>
                    </div>
                </form>
            </div>

            {/* Outreach Focus Mode */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 max-w-2xl">
                <div className="flex items-start space-x-4">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                        <SparklesIcon />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">Outreach Focus</h3>
                            {(modeStatus === 'success' || valueStatus === 'success') && <span className="text-[10px] font-black text-green-600 uppercase animate-pulse">Setting Saved</span>}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            Restrict the outreach pool to specific customer segments.
                        </p>
                    </div>
                </div>
                
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <p className="text-sm font-bold text-slate-700">Repeat Customer Only Mode</p>
                            <p className="text-xs text-slate-500 mt-1">If enabled, Sales Executives will only see customers with 2+ purchases in follow-up tabs.</p>
                        </div>
                        <button 
                            onClick={handleRepeatModeToggle}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${repeatOnly ? 'bg-indigo-600' : 'bg-slate-200'}`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${repeatOnly ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-700">Value Customers Only Mode</p>
                                <p className="text-xs text-slate-500 mt-1">Target customers who have spent above a specific threshold.</p>
                            </div>
                            <button 
                                onClick={handleValueModeToggle}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${valueOnly ? 'bg-indigo-600' : 'bg-slate-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${valueOnly ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleMinValSubmit} className="flex items-end gap-3 pt-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Minimum Order Value (BDT)</label>
                                <input 
                                    type="number" 
                                    value={minOrderVal}
                                    onChange={e => setMinOrderValInput(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold bg-white"
                                    placeholder="500"
                                />
                            </div>
                            <button 
                                type="submit"
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors h-[38px]"
                            >
                                Update Value
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Outreach Target Configuration */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 max-w-2xl">
                <div className="flex items-start space-x-4">
                    <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                        <PhoneIcon />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">Follow-up Goal</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Daily Outreach Target for Sales Executives (Log entries per day).
                        </p>
                    </div>
                </div>
                
                <form onSubmit={handleGoalSubmit} className="space-y-6 mt-6">
                    <div>
                        <label htmlFor="outreach-goal" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Target Calls / Logs</label>
                        <input
                            type="number"
                            id="outreach-goal"
                            value={outreachGoal}
                            onChange={(e) => setOutreachGoal(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm font-bold text-slate-900"
                            placeholder="100"
                            required
                        />
                    </div>
                    <div className="flex items-center justify-end space-x-4">
                         {goalStatus === 'success' && <p className="text-xs font-bold text-green-600">Goal updated!</p>}
                        <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-xs font-black uppercase tracking-widest rounded-md text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                        >
                            Update Target
                        </button>
                    </div>
                </form>
            </div>

            {/* Outreach Range Configuration */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 max-w-2xl">
                <div className="flex items-start space-x-4">
                    <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                        <CalendarIcon />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">Retention Window</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Set the days range from last purchase to appear in the "Follow-up" list.
                        </p>
                    </div>
                </div>
                
                <form onSubmit={handleRangeSubmit} className="space-y-6 mt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Start (Days Ago)</label>
                            <input
                                type="number"
                                value={rangeStart}
                                onChange={(e) => setRangeStart(e.target.value)}
                                className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm font-bold text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">End (Days Ago)</label>
                            <input
                                type="number"
                                value={rangeEnd}
                                onChange={(e) => setRangeEnd(e.target.value)}
                                className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm font-bold text-slate-900"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Example: 32 and 28 will show customers who bought between 28 and 32 days ago.</p>
                    <div className="flex items-center justify-end space-x-4">
                         {rangeStatus === 'success' && <p className="text-xs font-bold text-green-600">Range updated!</p>}
                        <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-xs font-black uppercase tracking-widest rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors"
                        >
                            Update Range
                        </button>
                    </div>
                </form>
            </div>

            {/* Packzy API Configuration */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 max-w-2xl">
                <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                        <CogIcon />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tighter">Courier Integration</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Keys from your Packzy Courier dashboard for official consignments.
                        </p>
                    </div>
                </div>
                
                <form onSubmit={handleCredentialsSubmit} className="space-y-6 mt-6">
                    <div>
                        <label htmlFor="api-key" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Api-Key</label>
                        <input
                            type="password"
                            id="api-key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm sm:text-sm font-bold text-slate-900"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="secret-key" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Secret-Key</label>
                        <input
                            type="password"
                            id="secret-key"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md shadow-sm sm:text-sm font-bold text-slate-900"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <div className="flex items-center justify-end space-x-4">
                         {saveStatus === 'success' && <p className="text-xs font-bold text-green-600">Saved!</p>}
                        <button
                            type="submit"
                            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-xs font-black uppercase tracking-widest rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                            Save Credentials
                        </button>
                    </div>
                </form>
            </div>

            {/* Danger Zone - Hidden destructive actions */}
            <div className="border-t border-slate-200 pt-8 mt-12 max-w-2xl">
                {!showDangerZone ? (
                    <button 
                        onClick={() => setShowDangerZone(true)}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-rose-500 transition-colors"
                    >
                        Reveal System Maintenance Zone
                    </button>
                ) : (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-sm font-black text-rose-800 uppercase tracking-widest">Master Danger Zone</h3>
                                <p className="text-xs text-rose-600 mt-1">Destructive actions that cannot be reversed.</p>
                            </div>
                            <button onClick={() => setShowDangerZone(false)} className="text-rose-400 hover:text-rose-600"><XMarkIcon /></button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-rose-200">
                            <div>
                                <p className="text-xs font-bold text-slate-800">Clear Global Database</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Wipe all purchase records and non-outreach profiles.</p>
                            </div>
                            <button 
                                onClick={() => setShowClearModal(true)}
                                className="bg-rose-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-sm"
                            >
                                Remove Total Database
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showClearModal && (
                <ClearDatabaseModal 
                    onClose={() => setShowClearModal(false)}
                    onConfirm={handleClearDatabase}
                />
            )}
        </div>
    );
};

export default SettingsPage;
