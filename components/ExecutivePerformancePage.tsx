
import React, { useState } from 'react';
import { ExecutivePerformance } from '../types';

interface ExecutivePerformancePageProps {
    data: ExecutivePerformance[];
    isLoading: boolean;
    onRefresh: () => void;
}

const ExecutivePerformancePage: React.FC<ExecutivePerformancePageProps> = ({ data, isLoading, onRefresh }) => {
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

    const getMonthName = (monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Team Sales Performance</h3>
                    <p className="text-xs text-slate-400 font-medium italic">Monthly conversion records and agent earnings (৳7/order).</p>
                </div>
                <button 
                    onClick={onRefresh}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {data.length > 0 ? data.map(agent => (
                    <div key={agent.agentName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div 
                            className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => setExpandedAgent(expandedAgent === agent.agentName ? null : agent.agentName)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 uppercase">
                                    {agent.agentName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 uppercase tracking-widest">{agent.agentName}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                        Performance History ({agent.history.length} Month{agent.history.length > 1 ? 's' : ''})
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Latest Earnings</p>
                                    <p className="text-lg font-black text-blue-600">৳{(agent.history[0]?.earnings || 0).toLocaleString()}</p>
                                </div>
                                <div className="text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${expandedAgent === agent.agentName ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        {expandedAgent === agent.agentName && (
                            <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="min-w-full divide-y divide-slate-100">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                                                <th className="px-4 py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Outreach Logs</th>
                                                <th className="px-4 py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</th>
                                                <th className="px-4 py-2 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Bonus (৳)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {agent.history.map((record: any, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{getMonthName(record.month)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-black">
                                                            {record.outreachCount || 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-black">
                                                            {record.orderCount || 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-sm font-black text-slate-800">
                                                        ৳{(record.earnings || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 font-black">
                                            <tr>
                                                <td className="px-4 py-2 text-xs uppercase text-slate-500">Career Totals</td>
                                                <td className="px-4 py-2 text-center text-xs text-slate-800">
                                                    {agent.history.reduce((sum: number, r: any) => sum + (r.outreachCount || 0), 0)}
                                                </td>
                                                <td className="px-4 py-2 text-center text-xs text-slate-800">
                                                    {agent.history.reduce((sum: number, r: any) => sum + (r.orderCount || 0), 0)}
                                                </td>
                                                <td className="px-4 py-2 text-right text-xs text-blue-600">
                                                    ৳{agent.history.reduce((sum: number, r: any) => sum + (r.earnings || 0), 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="p-20 text-center text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-300">
                        {isLoading ? 'Crunching sales data...' : 'No historical performance data found. Check that agents have recorded outreach logs or created orders.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExecutivePerformancePage;
