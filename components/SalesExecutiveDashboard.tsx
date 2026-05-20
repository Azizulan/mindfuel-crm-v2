
import React, { useState, useMemo } from 'react';
import { Customer, User, FollowUpNote, DashboardStats } from '../types';
import { StarIcon } from './icons/StarIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { ClockIcon } from './icons/ClockIcon';

interface SalesExecutiveDashboardProps {
    currentUser: User;
    stats: DashboardStats | null;
    outreachRange: { start: number, end: number };
    target: number;
    isLoading: boolean;
}

const Tooltip: React.FC<{text: string}> = ({ text }) => {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative inline-block ml-1">
            <button 
                onMouseEnter={() => setVisible(true)} 
                onMouseLeave={() => setVisible(false)}
                className="w-4 h-4 rounded-full bg-white/20 text-white/80 text-[10px] flex items-center justify-center hover:bg-white/30 transition-colors"
            >?</button>
            {visible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl z-50 pointer-events-none leading-relaxed normal-case font-normal border border-slate-600">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
    );
};

const SalesExecutiveDashboard: React.FC<SalesExecutiveDashboardProps> = ({ currentUser, stats, outreachRange, target, isLoading }) => {
    const BONUS_PER_CONVERSION = 7;
    const now = new Date();

    if (isLoading && !stats) {
        return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    }

    const performance = stats?.agentPerformance || { monthlyConversions: 0, outreachToday: 0, outreachThisHour: 0, isCurrentlyLow: false };
    const leaderboard = stats?.leaderboard || [];

    const personalBonus = performance.monthlyConversions * BONUS_PER_CONVERSION;
    const outreachPercentage = Math.min(Math.round((performance.outreachToday / target) * 100), 100);
    const rangeText = `${outreachRange.end}-${outreachRange.start}`;

    return (
        <div className="space-y-6">
            {performance.isCurrentlyLow && (
                <div className="bg-rose-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <p className="text-sm font-black uppercase tracking-widest">Action Required: Low Hourly Activity</p>
                            <p className="text-xs opacity-90">You have made only {performance.outreachThisHour} calls this hour. Minimum required is 10.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.location.hash = 'followUp'} 
                        className="bg-white text-rose-600 text-[10px] font-black uppercase px-4 py-2 rounded shadow-md hover:bg-rose-50 transition-colors"
                    >Start Calling Now</button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                            <StarIcon />
                        </div>
                        <div>
                            <div className="flex items-center">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Conversions</p>
                                <div className="scale-90"><Tooltip text="Number of unique orders you created this month that were approved." /></div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-800">{performance.monthlyConversions}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-xl shadow-lg text-white md:col-span-2 relative overflow-hidden">
                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <div className="flex items-center">
                                <p className="text-xs font-bold text-blue-100 uppercase tracking-widest">Your Estimated Bonus (৳)</p>
                                <Tooltip text="Your current commission. Calculated as (Orders × ৳7). Approved orders only." />
                            </div>
                            <h3 className="text-5xl font-black mt-1">
                                {new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(personalBonus)}
                            </h3>
                            <p className="text-xs text-blue-100 mt-2 opacity-80 font-medium italic">Performance-linked incentive active.</p>
                        </div>
                        <div className="hidden lg:block opacity-20 transform scale-150 -rotate-12">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2.5 rounded-lg ${performance.isCurrentlyLow ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                            <ClockIcon />
                        </div>
                        <div>
                            <div className="flex items-center">
                                <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Unique Reached (Hour)</h4>
                                <div className="scale-75"><Tooltip text="How many different customers you have interacted with in the last 60 minutes." /></div>
                            </div>
                            <p className={`text-3xl font-black ${performance.isCurrentlyLow ? 'text-rose-600' : 'text-slate-800'}`}>{performance.outreachThisHour}</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Active Window: {now.getHours()}:00 - {now.getHours()}:59
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-end mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-amber-100 p-2.5 rounded-lg text-amber-600">
                                <PhoneIcon />
                            </div>
                            <div>
                                <div className="flex items-center">
                                    <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Daily Outreach Progress</h4>
                                    <div className="scale-75"><Tooltip text="Your daily target progress. Multiple logs for the same customer count as 1 outreach for the day." /></div>
                                </div>
                                <p className="text-2xl font-black text-slate-800">{performance.outreachToday} <span className="text-slate-400 text-sm font-bold">/ {target} unique</span></p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-blue-600 uppercase">{outreachPercentage}%</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out ${outreachPercentage >= 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                            style={{ width: `${outreachPercentage}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                        {outreachPercentage >= 100 ? "Daily target achieved! Excellence rewarded." : `${target - performance.outreachToday} more unique customers needed.`}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <UserGroupIcon />
                            <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Team Rankings (Orders)</h4>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">{now.toLocaleString('default', { month: 'long' })}</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {leaderboard.length > 0 ? leaderboard.map((agent, index) => (
                            <div key={agent.name} className={`p-4 flex items-center justify-between transition-colors ${agent.name === currentUser.name ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'}`}>
                                        {index + 1}
                                    </span>
                                    <span className={`text-sm font-bold ${agent.name === currentUser.name ? 'text-blue-600' : 'text-slate-700'}`}>
                                        {agent.name} {agent.name === currentUser.name && "🏆"}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-slate-800">{agent.count}</span>
                                    <span className="text-[10px] text-slate-400 ml-1 font-bold uppercase">Orders</span>
                                </div>
                            </div>
                        )) : (
                            <div className="p-16 text-center text-slate-400 text-sm italic">No ranking data available for {now.toLocaleString('default', { month: 'long' })}.</div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest mb-4 border-b pb-2">Business Rules & Logic</h4>
                    <div className="space-y-5">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-sm font-black">৳7</div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">Approved Commission:</strong> Bonuses are calculated <strong>exclusively</strong> on orders created by you. Logs without an order do not earn commission.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-sm font-black">👤</div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">Unique Outreach:</strong> To maintain data integrity, you are credited for <strong>one outreach per customer per day</strong>, regardless of the number of attempts.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center text-sm font-black">🎯</div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">Retention Goal:</strong> Prioritize customers who ordered {rangeText} days ago. Configured range: <strong>{rangeText} days</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesExecutiveDashboard;
