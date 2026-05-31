
import React from 'react';
import { AgentActivity } from '../types';
import { motion } from 'motion/react';

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
    const windowStart = 10;
    const windowEnd = 21;
    const isShowingToday = selectedDate === todayStr;

    return (
        <div className="space-y-6 pb-12">

            {/* Controls — glass surface, segmented control for date toggle */}
            <div className="glass-surface p-4 flex flex-wrap items-center gap-3">
                <div className="flex glass-pane p-1 rounded-xl gap-1">
                    <button
                        onClick={() => onDateChange(todayStr)}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedDate === todayStr ? 'glass-chip-selected text-foreground' : 'text-foreground/55 hover:text-foreground/85'}`}
                    >Today</button>
                    <button
                        onClick={() => onDateChange(yesterdayStr)}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedDate === yesterdayStr ? 'glass-chip-selected text-foreground' : 'text-foreground/55 hover:text-foreground/85'}`}
                    >Yesterday</button>
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    max={todayStr}
                    className="glass-chip rounded-xl px-3 py-1.5 text-xs font-medium text-foreground/85 outline-none focus:ring-2 focus:ring-foreground/20"
                />
                <button
                    onClick={onRefresh}
                    className="p-2 glass-chip rounded-xl text-foreground/65 hover:text-foreground transition-all"
                    title="Refresh"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
                <div className="ml-auto flex items-center gap-4 text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Healthy (10+)</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Under Target</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-foreground/20"></span> No Activity</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {teamActivity.length > 0 ? teamActivity.map((agent, index) => (
                    <motion.div
                        key={agent.agentName}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="glass-surface overflow-hidden"
                    >
                        <div className="px-5 py-4 border-b border-foreground/[0.08] flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 glass-chip rounded-xl flex items-center justify-center font-semibold text-foreground/85 text-sm">
                                    {agent.agentName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-foreground text-sm">{agent.agentName}</h4>
                                    {agent.isCurrentlyLow && (
                                        <span className="inline-flex items-center gap-1.5 mt-1 text-[10px] font-semibold glass-chip glass-chip-tint-red text-foreground/85 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            Low Activity
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Total Today</p>
                                <p className="text-display text-3xl text-foreground leading-tight">{agent.totalToday}</p>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="flex items-end gap-1.5 h-32">
                                {agent.hourlyBreakdown
                                    .filter(s => s.hour >= windowStart && s.hour <= windowEnd)
                                    .map((stat, idx) => {
                                        const isPastInShift = isShowingToday ? stat.hour <= currentHour : true;
                                        const isInShift = stat.hour >= agent.shiftStart && stat.hour < agent.shiftEnd;
                                        const isLow = isPastInShift && isInShift && stat.count < 10;
                                        const isFuture = isShowingToday && stat.hour > currentHour;
                                        const barH = Math.max(4, Math.min((stat.count / 25) * 100, 100));

                                        return (
                                            <div key={idx} className="flex-1 group relative flex flex-col justify-end items-center h-full">
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${barH}%` }}
                                                    transition={{ duration: 0.4, delay: idx * 0.02 }}
                                                    className={`w-full rounded-t-lg transition-all duration-300 ${
                                                        isFuture ? 'bg-foreground/[0.08]' :
                                                        isLow ? 'bg-rose-400 hover:bg-rose-500' :
                                                        'bg-emerald-400 hover:bg-emerald-500'
                                                    }`}
                                                />
                                                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded-xl shadow-xl z-20 whitespace-nowrap">
                                                    <p className="font-bold border-b border-gray-700 pb-1 mb-1">
                                                        {stat.hour > 12 ? `${stat.hour - 12}:00 PM` : stat.hour === 12 ? '12:00 PM' : `${stat.hour}:00 AM`}
                                                    </p>
                                                    <p>Interactions: <span className="text-emerald-400">{stat.count}</span></p>
                                                    {isLow && <p className="text-rose-400 mt-0.5 font-bold">LOW OUTPUT</p>}
                                                </div>
                                                <span className={`text-[9px] font-semibold mt-1.5 ${isShowingToday && stat.hour === currentHour ? 'text-foreground' : 'text-foreground/40'}`}>
                                                    {stat.hour > 12 ? `${stat.hour - 12}p` : stat.hour === 12 ? '12p' : `${stat.hour}a`}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </motion.div>
                )) : (
                    <div className="p-16 text-center text-foreground/45 italic glass-surface">
                        {isLoading ? 'Loading activity data…' : 'No activity logs for this date.'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamActivityPage;
