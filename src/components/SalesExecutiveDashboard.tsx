import React from 'react';
import { User, DashboardStats } from '../types';

interface SalesExecutiveDashboardProps {
  currentUser: User;
  stats: DashboardStats | null;
  outreachRange: { start: number, end: number };
  target: number;
  isLoading: boolean;
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-card border border-foreground/[0.12] rounded-2xl shadow-sm ${className}`}>{children}</div>
);

const SalesExecutiveDashboard: React.FC<SalesExecutiveDashboardProps> = ({ currentUser, stats, outreachRange, target, isLoading }) => {
  const BONUS_PER_CONVERSION = 7;
  const now = new Date();
  const hour = now.getHours();

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  const performance = stats?.agentPerformance || { monthlyConversions: 0, outreachToday: 0, outreachThisHour: 0, isCurrentlyLow: false };
  const leaderboard = stats?.leaderboard || [];
  const personalBonus = performance.monthlyConversions * BONUS_PER_CONVERSION;
  const outreachPct = Math.min(Math.round((performance.outreachToday / target) * 100), 100);
  const rangeText = `${outreachRange.end}–${outreachRange.start} days`;
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const dayName = now.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'short' });

  // Personal rank in leaderboard
  const myRank = leaderboard.findIndex(a => a.name === currentUser.name) + 1;
  const myLeaderboardEntry = leaderboard.find(a => a.name === currentUser.name);

  // Greeting
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Motivational message
  const motivationalMsg = performance.isCurrentlyLow
    ? 'Your activity is below pace — time to pick it up!'
    : outreachPct >= 100
    ? 'Daily target achieved — keep pushing for more!'
    : outreachPct >= 75
    ? "Almost there — you're on the home stretch."
    : outreachPct >= 50
    ? "Halfway through — solid pace, keep it up."
    : "Fresh start — every call brings you closer to your goal.";

  // Shift status
  const shiftStart = currentUser.shiftStart ?? 10;
  const shiftEnd = currentUser.shiftEnd ?? 19;
  const shiftActive = hour >= shiftStart && hour < shiftEnd;
  const shiftProgress = shiftActive ? Math.min(((hour - shiftStart) / (shiftEnd - shiftStart)) * 100, 100) : hour < shiftStart ? 0 : 100;
  const hoursLeft = shiftEnd - hour;
  const shiftStatusText = !shiftActive && hour < shiftStart ? `Starts at ${shiftStart}:00` : !shiftActive ? 'Shift ended' : hoursLeft <= 1 ? 'Last hour!' : `${hoursLeft}h remaining`;

  // Bonus milestones
  const nextMilestone100 = Math.ceil((personalBonus + 1) / 100) * 100;
  const ordersToMilestone = Math.ceil((nextMilestone100 - personalBonus) / BONUS_PER_CONVERSION);
  const milestonePct = personalBonus > 0 ? Math.min((personalBonus / nextMilestone100) * 100, 100) : 0;

  // Required hourly rate
  const totalShiftHours = shiftEnd - shiftStart;
  const elapsedHours = Math.max(hour - shiftStart, 0);
  const requiredPerHour = totalShiftHours > 0 ? (target / totalShiftHours) : target;
  const expectedByNow = Math.round(elapsedHours * requiredPerHour);
  const aheadBehind = performance.outreachToday - expectedByNow;

  const rankColors = ['from-amber-400 to-orange-500', 'from-gray-300 to-gray-400', 'from-orange-300 to-amber-400'];
  const rankIcons = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-5 pb-12">

      {/* Low activity alert */}
      {performance.isCurrentlyLow && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-rose-700">Low Activity Detected</p>
              <p className="text-xs text-rose-500">{performance.outreachThisHour} calls logged this hour — minimum is 10 per hour.</p>
            </div>
          </div>
          <div className="text-2xl flex-shrink-0">⚡</div>
        </div>
      )}

      {/* Greeting Banner */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest">{dayName}</p>
            <h2 className="text-2xl font-bold text-white mt-1">{greeting}, {currentUser.name.split(' ')[0]}! 👋</h2>
            <p className="text-blue-200 text-sm mt-1">{motivationalMsg}</p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${shiftActive ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' : 'bg-white/10 text-blue-200 border border-white/20'}`}>
              <span className={`w-2 h-2 rounded-full ${shiftActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
              {shiftStatusText}
            </div>
            {shiftActive && (
              <div className="mt-2">
                <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${shiftProgress}%` }} />
                </div>
                <p className="text-[10px] text-blue-300 mt-1 text-right">Shift progress</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Monthly Conversions */}
        <Card className="p-5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-2xl font-bold text-foreground">{performance.monthlyConversions}</p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Conversions</p>
          <p className="text-xs text-foreground/45 mt-1.5">Approved orders · {monthName}</p>
        </Card>

        {/* Today's Outreach */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25Z" /></svg>
            </div>
            {shiftActive && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${aheadBehind >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {aheadBehind >= 0 ? `+${aheadBehind}` : aheadBehind} vs pace
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">{performance.outreachToday}<span className="text-sm font-normal text-foreground/45">/{target}</span></p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Today's Outreach</p>
          <p className="text-xs text-foreground/45 mt-1.5">{outreachPct}% of daily target</p>
        </Card>

        {/* Hourly Velocity */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${performance.outreachThisHour >= Math.ceil(requiredPerHour) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {performance.outreachThisHour >= Math.ceil(requiredPerHour) ? '✓ On pace' : 'Below pace'}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{performance.outreachThisHour}</p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">This Hour</p>
          <p className="text-xs text-foreground/45 mt-1.5">Target: {Math.ceil(requiredPerHour)}/hr</p>
        </Card>

        {/* Leaderboard Rank */}
        <Card className="p-5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3 text-base">
            {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '📊'}
          </div>
          <p className="text-2xl font-bold text-foreground">
            {myRank > 0 ? `#${myRank}` : '—'}
          </p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Your Rank</p>
          <p className="text-xs text-foreground/45 mt-1.5">
            {myRank > 0 ? `Top ${Math.round((myRank / Math.max(leaderboard.length, 1)) * 100)}% of team` : 'Not yet ranked'}
          </p>
        </Card>
      </div>

      {/* Bonus + Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Enhanced Bonus Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6">
            <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest">Estimated Bonus · {monthName}</p>
            <p className="text-5xl font-black text-white mt-2 tracking-tighter">৳{personalBonus.toLocaleString()}</p>
            <p className="text-blue-200 text-sm mt-2">{performance.monthlyConversions} orders × ৳{BONUS_PER_CONVERSION}</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground/60">Next milestone: <span className="text-foreground/85 font-bold">৳{nextMilestone100}</span></p>
                <p className="text-xs text-foreground/45">{ordersToMilestone} more orders needed</p>
              </div>
              <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700" style={{ width: `${milestonePct}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-foreground/30">৳{Math.floor(personalBonus / 100) * 100}</span>
                <span className="text-[10px] text-foreground/30">৳{nextMilestone100}</span>
              </div>
            </div>
            <div className="bg-foreground/[0.04] rounded-xl p-3 flex items-center gap-2">
              <span className="text-base">💡</span>
              <p className="text-xs text-foreground/60">
                {ordersToMilestone <= 3
                  ? `Just ${ordersToMilestone} more orders and you'll hit ৳${nextMilestone100}!`
                  : `Convert ${ordersToMilestone} more customers to reach the ৳${nextMilestone100} milestone.`}
              </p>
            </div>
          </div>
        </Card>

        {/* Daily Goal */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-foreground/90">Daily Goal Progress</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${outreachPct >= 100 ? 'bg-emerald-50 text-emerald-600' : outreachPct >= 75 ? 'bg-blue-50 text-blue-600' : 'bg-foreground/[0.08] text-foreground/60'}`}>
                {outreachPct}% complete
              </span>
            </div>

            {/* Big progress ring alternative — circular display */}
            <div className="flex items-center gap-5 mb-5">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={outreachPct >= 100 ? '#10b981' : '#3b82f6'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - outreachPct / 100)}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-foreground/90">{outreachPct}%</span>
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-foreground">{performance.outreachToday}<span className="text-lg text-foreground/30 font-normal">/{target}</span></p>
                <p className="text-xs text-foreground/45 mt-1">customers reached today</p>
                {outreachPct < 100 && (
                  <p className="text-xs font-semibold text-blue-600 mt-1">{target - performance.outreachToday} more to go</p>
                )}
                {outreachPct >= 100 && (
                  <p className="text-xs font-semibold text-emerald-600 mt-1">🎉 Target achieved!</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-foreground/[0.04] rounded-xl p-3">
                <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Required/hr</p>
                <p className="text-lg font-bold text-foreground/90 mt-0.5">{Math.ceil(requiredPerHour)}</p>
              </div>
              <div className="bg-foreground/[0.04] rounded-xl p-3">
                <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">This Hour</p>
                <p className={`text-lg font-bold mt-0.5 ${performance.outreachThisHour >= Math.ceil(requiredPerHour) ? 'text-emerald-600' : 'text-amber-600'}`}>{performance.outreachThisHour}</p>
              </div>
            </div>
            <div className={`rounded-xl p-3 flex items-center gap-2 ${aheadBehind >= 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <span className="text-base">{aheadBehind >= 0 ? '🟢' : '🟡'}</span>
              <p className={`text-xs font-semibold ${aheadBehind >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {aheadBehind >= 0
                  ? `You're ${aheadBehind} ahead of pace — great work!`
                  : `You're ${Math.abs(aheadBehind)} behind pace — push harder.`}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Leaderboard + Business Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Leaderboard */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-foreground/[0.08] flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground/90">Team Leaderboard</h3>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full uppercase">{monthName}</span>
          </div>
          {leaderboard.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {leaderboard.slice(0, 7).map((agent, i) => {
                const isMe = agent.name === currentUser.name;
                const topThree = i < 3;
                return (
                  <div key={agent.name} className={`px-5 py-3.5 flex items-center justify-between transition-colors ${isMe ? 'bg-blue-50/70' : 'hover:bg-foreground/[0.04]'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' :
                        i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                        i === 2 ? 'bg-gradient-to-br from-orange-300 to-amber-400 text-white' :
                        'bg-foreground/[0.08] text-foreground/60'
                      }`}>
                        {topThree ? rankIcons[i] : i + 1}
                      </div>
                      <div>
                        <span className={`text-sm font-semibold ${isMe ? 'text-blue-700' : 'text-foreground/85'}`}>
                          {agent.name}{isMe && <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">you</span>}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-foreground/[0.08] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : isMe ? 'bg-blue-500' : 'bg-gray-300'}`}
                          style={{ width: `${leaderboard[0]?.count > 0 ? (agent.count / leaderboard[0].count) * 100 : 0}%` }}
                        />
                      </div>
                      <span className={`text-sm font-black w-8 text-right ${isMe ? 'text-blue-700' : 'text-foreground/90'}`}>{agent.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-foreground/45 text-xs">No ranking data yet this month.</div>
          )}
        </Card>

        {/* Business Rules + Insights */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-foreground/90 mb-4">Performance Rules & Tips</h3>
          <div className="space-y-3">
            {[
              {
                icon: '৳7',
                color: 'bg-blue-50 text-blue-600',
                title: 'Bonus Rate',
                desc: `You earn ৳7 per approved order. ${performance.monthlyConversions} this month = ৳${personalBonus}.`,
              },
              {
                icon: '👤',
                color: 'bg-emerald-50 text-emerald-600',
                title: 'Unique Count',
                desc: 'Each customer counts once per day. Calling the same customer twice does not help your number.',
              },
              {
                icon: '🎯',
                color: 'bg-amber-50 text-amber-600',
                title: 'Who to Call',
                desc: `Focus on customers ${rangeText} since their last purchase — they are in the active retention window.`,
              },
              {
                icon: '⏱',
                color: 'bg-violet-50 text-violet-600',
                title: 'Pace',
                desc: `You need ~${Math.ceil(requiredPerHour)} customers/hour to hit your daily target of ${target}.`,
              },
            ].map((rule) => (
              <div key={rule.title} className="flex items-start gap-3 p-3 bg-foreground/[0.04] rounded-xl">
                <div className={`w-8 h-8 rounded-lg ${rule.color} flex items-center justify-center text-sm flex-shrink-0 font-bold`}>{rule.icon}</div>
                <div>
                  <p className="text-xs font-bold text-foreground/85">{rule.title}</p>
                  <p className="text-xs text-foreground/45 mt-0.5 leading-relaxed">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
};

export default SalesExecutiveDashboard;
