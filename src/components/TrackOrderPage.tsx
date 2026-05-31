
import React, { useState } from 'react';
import { getTrackingStatus } from '../services/packzyApiService';
import { TrackingStatusResponse } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Truck } from 'lucide-react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

type IdType = 'consignment_id' | 'invoice' | 'tracking_code';

const TrackOrderPage: React.FC = () => {
    const [idType, setIdType] = useState<IdType>('tracking_code');
    const [idValue, setIdValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<TrackingStatusResponse | null>(null);

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idValue) { setError('Please enter a value to track.'); return; }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const response = await getTrackingStatus(idType, idValue);
            setResult(response);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-3 bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl text-sm text-foreground/90 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all";

    return (
        <div className="space-y-5 pb-12">
            <div className="max-w-2xl mx-auto">
                <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-foreground/[0.08] bg-foreground/[0.04] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <Search className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-foreground/90">Track Delivery</h2>
                            <p className="text-xs text-foreground/45 mt-0.5">Real-time logistics monitoring</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleTrack} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">ID Type</label>
                                    <div className="relative">
                                        <select
                                            value={idType}
                                            onChange={(e) => setIdType(e.target.value as IdType)}
                                            className={inputCls + " appearance-none cursor-pointer"}
                                        >
                                            <option value="tracking_code">Tracking Code</option>
                                            <option value="invoice">Invoice ID</option>
                                            <option value="consignment_id">Consignment ID</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/45">
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Identifier</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={idValue}
                                            onChange={(e) => setIdValue(e.target.value)}
                                            className={inputCls + " pr-28"}
                                            placeholder={`Enter ${idType.replace(/_/g, ' ')}...`}
                                        />
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {isLoading ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Tracking</span>
                                                </div>
                                            ) : 'Track Now'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    className="mt-5 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{error}</p>
                                        <p className="text-xs text-red-400 mt-0.5">Please verify your ID and try again</p>
                                    </div>
                                </motion.div>
                            )}

                            {result ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-5 p-6 bg-foreground/[0.04] border border-foreground/[0.12] rounded-2xl text-center"
                                >
                                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                        <Truck className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest mb-1">Shipment Status</p>
                                    <h3 className="text-xl font-bold text-foreground/90 mb-5 capitalize">
                                        {result.delivery_status.replace(/_/g, ' ')}
                                    </h3>
                                    <div className="flex justify-center gap-4">
                                        <div className="px-4 py-3 bg-card rounded-xl border border-foreground/[0.12]">
                                            <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest mb-1">Tracking ID</p>
                                            <p className="text-xs font-bold text-blue-600">{idValue}</p>
                                        </div>
                                        <div className="px-4 py-3 bg-card rounded-xl border border-foreground/[0.12]">
                                            <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest mb-1">Last Update</p>
                                            <p className="text-xs font-bold text-foreground/70">{new Date().toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : !isLoading && !error && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mt-5 py-12 border-2 border-dashed border-foreground/[0.12] rounded-2xl text-center"
                                >
                                    <div className="w-10 h-10 bg-foreground/[0.08] rounded-xl flex items-center justify-center mx-auto mb-3 text-foreground/30">
                                        <Truck className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest">Enter tracking details above to begin monitoring</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackOrderPage;
