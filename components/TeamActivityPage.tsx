
import React from 'react';
import { AgentActivity } from '../types';

interface TeamActivityPageProps {
    teamActivity: AgentActivity[];
    isLoading: boolean;
    onRefresh: () => void;
    selectedDate: string;
    onDateChange: (date: string) => void;
}

const TeamActivityPage: React.FC<TeamActivityPageProps> = ({ teamActivity, isLoading, onRefresh, selectedDate, onDateChange }) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentHour = now.getHours();
    
    // WORKING WINDOW: 10 AM to 9 PM (Hour 10 to 21)
    const windowStart = 10;
    const windowEnd = 21;

    const isShowingToday = selectedDate === todayStr;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Team Hourly Pulse</h3>
                    <p className="text-xs text-slate-400 font-medium italic">Working Hours: 10:00 AM - 9:00 PM &middot; Target: 10+ interactions/hr</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => onDateChange(todayStr)}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${selectedDate === todayStr ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >Today</button>
                        <button 
                            onClick={() => onDateChange(yesterdayStr)}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${selectedDate === yesterdayStr ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >Yesterday</button>
                    </div>
                    <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => onDateChange(e.target.value)}
                        max={todayStr}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button 
                        onClick={onRefresh}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"
                        title="Refresh Data"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {teamActivity.length > 0 ? teamActivity.map(agent => (
                    <div key={agent.agentName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h4 className="font-black text-slate-800 uppercase tracking-widest">{agent.agentName}</h4>
                                {agent.isCurrentlyLow && (
                                    <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded animate-pulse border border-rose-200 uppercase">
                                        Low Activity Warning
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Total Outreach:</span>
                                <span className="text-sm font-black text-slate-800">{agent.totalToday}</span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="flex items-end gap-1.5 h-32 pt-4">
                                {agent.hourlyBreakdown
                                    .filter(stat => stat.hour >= windowStart && stat.hour <= windowEnd)
                                    .map((stat, idx) => {
                                        // For historical dates, we check against their full shift.
                                        // For today, we only check up to the current hour.
                                        const isPastInShift = isShowingToday ? stat.hour <= currentHour : true;
                                        const isWithinAgentShift = stat.hour >= agent.shiftStart && stat.hour < agent.shiftEnd;
                                        const isUnderperforming = isPastInShift && isWithinAgentShift && stat.count < 10;
                                        
                                        const isFuture = isShowingToday && stat.hour > currentHour;
                                        const barHeight = Math.min((stat.count / 25) * 100, 100);

                                        return (
                                            <div key={idx} className="flex-1 group relative flex flex-col justify-end items-center h-full">
                                                <div 
                                                    style={{ height: `${barHeight}%` }}
                                                    className={`w-full rounded-t-sm transition-all duration-300 min-h-[4px] ${
                                                        isFuture ? 'bg-slate-100' : 
                                                        isUnderperforming ? 'bg-rose-500 hover:bg-rose-600' : 
                                                        'bg-emerald-500 hover:bg-emerald-600'
                                                    }`}
                                                ></div>
                                                
                                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] p-2 rounded shadow-xl z-10 whitespace-nowrap">
                                                    <p className="font-bold">{stat.hour}:00 - {stat.hour}:59</p>
                                                    <p>Feedbacks: {stat.count}</p>
                                                    {isUnderperforming && <p className="text-rose-400 font-black">WARNING: Low Output</p>}
                                                </div>

                                                <span className={`text-[8px] font-bold mt-2 ${isShowingToday && stat.hour === currentHour ? 'text-blue-600 font-black' : 'text-slate-400'}`}>
                                                    {stat.hour > 12 ? `${stat.hour - 12}P` : (stat.hour === 12 ? '12P' : `${stat.hour}A`)}
                                                </span>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50/50 border-t flex gap-4 text-[10px] font-bold uppercase tracking-tighter text-slate-400 overflow-x-auto scrollbar-hide">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Healthy (10+)
                            </div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Under Target (&lt;10)
                            </div>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-slate-200"></span> {isShowingToday ? 'Pending / Inactive' : 'No Activity'}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="p-20 text-center text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-300">
                        {isLoading ? 'Scanning activity streams...' : 'No sales executives have activity logs for this date.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamActivityPage;
