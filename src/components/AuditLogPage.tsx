
import React from 'react';
import { AuditLogEntry } from '../types';
import { PositiveIcon, NotInterestedIcon, CallBackIcon, HappyIcon, NeutralIcon, AngryIcon } from './icons/FeedbackIcons';
import { AnimatePresence, motion } from 'motion/react';

interface AuditLogPageProps {
    data: AuditLogEntry[];
    totalCount: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    onSearchChange: (term: string) => void;
    isLoading: boolean;
}

const feedbackIcons: Record<string, React.ReactNode> = {
    'Positive': <PositiveIcon />,
    'Happy': <HappyIcon />,
    'Neutral': <NeutralIcon />,
    'Angry': <AngryIcon />,
    'Not Interested': <NotInterestedIcon />,
    'Call Back Later': <CallBackIcon />,
};

const feedbackColors: Record<string, string> = {
    'Positive': 'bg-blue-50 text-blue-600 border-blue-100',
    'Happy': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Neutral': 'bg-foreground/[0.08] text-foreground/60 border-foreground/[0.12]',
    'Angry': 'bg-rose-50 text-rose-600 border-rose-100',
    'Not Interested': 'bg-amber-50 text-amber-600 border-amber-100',
    'Call Back Later': 'bg-violet-50 text-violet-600 border-violet-100',
};

const AuditLogPage: React.FC<AuditLogPageProps> = ({ data, totalCount, currentPage, onPageChange, onSearchChange, isLoading }) => {
    return (
        <div className="space-y-6 pb-12">

            {/* Search bar */}
            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-foreground/45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search logs (customer, agent, notes)..."
                        className="w-full pl-9 pr-4 py-2.5 bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl text-sm text-foreground/90 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <div className="ml-auto flex items-center gap-2 bg-foreground/[0.04] px-3 py-1.5 rounded-xl border border-foreground/[0.12]">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{totalCount} interactions</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm overflow-hidden">
                <div className={`overflow-x-auto transition-opacity ${isLoading ? 'opacity-50' : ''}`}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-foreground/[0.04] border-b border-foreground/[0.08]">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">Timeline</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">Agent</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">Sentiment</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <AnimatePresence mode="wait">
                                {data.length > 0 ? data.map((entry, idx) => (
                                    <motion.tr
                                        key={idx}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className="hover:bg-foreground/[0.04] transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-semibold text-foreground/90">{new Date(entry.date).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-foreground/45 mt-0.5">
                                                {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                    {entry.customerName.charAt(0)}
                                                </div>
                                                <span className="text-sm font-semibold text-foreground/90">{entry.customerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/60">{entry.agent}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold uppercase tracking-wide ${feedbackColors[entry.feedback] || 'bg-foreground/[0.08] text-foreground/60 border-foreground/[0.12]'}`}>
                                                <span>{feedbackIcons[entry.feedback]}</span>
                                                {entry.feedback}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-foreground/60 max-w-xs line-clamp-2" title={entry.notes}>{entry.notes}</p>
                                        </td>
                                    </motion.tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center text-foreground/45 italic text-sm">
                                            {isLoading ? 'Loading records…' : 'No activity records found.'}
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-foreground/[0.04] border-t border-foreground/[0.08] flex items-center justify-between">
                    <div className="text-xs text-foreground/45 font-semibold uppercase tracking-widest">
                        Page {currentPage} of {Math.ceil(totalCount / 20) || 1}
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1 || isLoading}
                            onClick={() => onPageChange(currentPage - 1)}
                            className="p-2 bg-card border border-foreground/[0.12] rounded-xl text-foreground/60 disabled:opacity-30 hover:bg-foreground/[0.04] transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                            disabled={currentPage * 20 >= totalCount || isLoading}
                            onClick={() => onPageChange(currentPage + 1)}
                            className="p-2 bg-card border border-foreground/[0.12] rounded-xl text-foreground/60 disabled:opacity-30 hover:bg-foreground/[0.04] transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLogPage;
