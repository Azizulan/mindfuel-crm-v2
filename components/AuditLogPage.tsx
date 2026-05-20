
import React from 'react';
import { AuditLogEntry } from '../types';
import { PositiveIcon, NotInterestedIcon, CallBackIcon, HappyIcon, NeutralIcon, AngryIcon } from './icons/FeedbackIcons';

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
    'Positive': 'bg-blue-100 text-blue-800',
    'Happy': 'bg-green-100 text-green-800',
    'Neutral': 'bg-slate-100 text-slate-800',
    'Angry': 'bg-red-100 text-red-800',
    'Not Interested': 'bg-yellow-100 text-yellow-800',
    'Call Back Later': 'bg-purple-100 text-purple-800',
};

const AuditLogPage: React.FC<AuditLogPageProps> = ({ data, totalCount, currentPage, onPageChange, onSearchChange, isLoading }) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="relative w-full sm:w-80">
                    <input 
                        type="text" 
                        placeholder="Search logs (customer, agent, notes)..." 
                        className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    {totalCount} Global interactions found
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-slate-200">
                <div className={`overflow-x-auto ${isLoading ? 'opacity-50' : ''}`}>
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Timeline</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Agent</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Sentiment</th>
                                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Observations</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {data.length > 0 ? data.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                        {new Date(entry.date).toLocaleDateString()} <br/>
                                        <span className="text-[10px] opacity-60">{new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                        {entry.customerName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {entry.agent}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${feedbackColors[entry.feedback] || 'bg-slate-100'}`}>
                                            {feedbackIcons[entry.feedback]}
                                            {entry.feedback}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={entry.notes}>
                                        {entry.notes}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                                        {isLoading ? 'Fetching history...' : 'No activity records found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                        Page {currentPage} of {Math.ceil(totalCount / 20) || 1}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            disabled={currentPage === 1 || isLoading} 
                            onClick={() => onPageChange(currentPage - 1)}
                            className="p-2 border border-slate-300 rounded bg-white disabled:opacity-30 hover:bg-slate-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button 
                            disabled={currentPage * 20 >= totalCount || isLoading} 
                            onClick={() => onPageChange(currentPage + 1)}
                            className="p-2 border border-slate-300 rounded bg-white disabled:opacity-30 hover:bg-slate-50"
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
