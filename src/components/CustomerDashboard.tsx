import React from 'react';
import { Customer, FollowUpNote, Product, User, DashboardStats } from '../types';
import CustomerTable from './CustomerTable';
import CustomerSegmentationChart from './charts/CustomerSegmentationChart';
import ValueRatingChart from './charts/ValueRatingChart';
import OrdersChart from './charts/OrdersChart';
import BestSellingProducts from './charts/BestSellingProducts';

interface CustomerDashboardProps {
  stats: DashboardStats | null;
  customers: Customer[];
  outreachRange: { start: number, end: number };
  onAddFollowUpNote: (customerId: number | string, newNote: FollowUpNote) => Promise<void>;
  products: Product[];
  currentUser: User;
  onUpdatePurchaseDate: (customerId: string | number, purchaseId: string, newDate: string) => Promise<void>;
  totalCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSearchChange: (term: string) => void;
  isLoading: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  onViewAuditLog?: () => void;
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-card border border-foreground/[0.12] rounded-2xl shadow-sm ${className}`}>{children}</div>
);

const feedbackConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'Positive':          { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  'Happy':             { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'Neutral':           { bg: 'bg-foreground/[0.08]',   text: 'text-foreground/70',   dot: 'bg-gray-400' },
  'Angry':             { bg: 'bg-red-50',     text: 'text-red-600',    dot: 'bg-red-500' },
  'Not Interested':    { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  'Call Back Later':   { bg: 'bg-purple-50',  text: 'text-purple-700', dot: 'bg-purple-500' },
  'Call Not Received': { bg: 'bg-foreground/[0.08]',   text: 'text-foreground/60',   dot: 'bg-gray-400' },
};

const CustomerDashboard: React.FC<CustomerDashboardProps> = (props) => {
  if (!props.stats && props.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  const stats = props.stats;
  const totalCustomers = stats?.totalCustomers || 0;
  const repeatBuyers = stats?.repeatBuyers || 0;
  const reachedCount = stats?.totalOutreachCount || 0;
  const orderedCount = stats?.totalOrderCount || 0;
  const retentionPool = stats?.followUpCount || 0;
  const conversionRate = reachedCount > 0 ? ((orderedCount / reachedCount) * 100).toFixed(1) : '0';
  const repeatPct = totalCustomers > 0 ? ((repeatBuyers / totalCustomers) * 100).toFixed(1) : '0';
  const outreachPct = totalCustomers > 0 ? ((reachedCount / totalCustomers) * 100).toFixed(1) : '0';
  const valueDist = stats?.valueDistribution || { High: 0, Medium: 0, Low: 0 };
  const totalValued = valueDist.High + valueDist.Medium + valueDist.Low || 1;
  const rangeText = `${props.outreachRange.end}–${props.outreachRange.start} days`;

  // Top performing agent from leaderboard
  const topAgent = stats?.leaderboard?.[0];

  // Compute 30-day total from revenueData
  const totalOrdersLast30 = (stats?.revenueData || []).reduce((s, d) => s + d.count, 0);
  const revenueData = stats?.revenueData || [];
  const mid = Math.floor(revenueData.length / 2);
  const firstHalf = revenueData.slice(0, mid).reduce((s, d) => s + d.count, 0);
  const secondHalf = revenueData.slice(mid).reduce((s, d) => s + d.count, 0);
  const trendPct = firstHalf > 0 ? (((secondHalf - firstHalf) / firstHalf) * 100).toFixed(0) : null;
  const trendUp = trendPct !== null && parseInt(trendPct) >= 0;

  const funnel = [
    { label: 'Database',      value: totalCustomers, color: 'bg-blue-500',   pct: 100 },
    { label: 'Retention Pool', value: retentionPool,  color: 'bg-violet-500', pct: totalCustomers > 0 ? (retentionPool / totalCustomers) * 100 : 0 },
    { label: 'Monthly Outreach', value: reachedCount,  color: 'bg-amber-500',  pct: totalCustomers > 0 ? (reachedCount / totalCustomers) * 100 : 0 },
    { label: 'Orders',         value: orderedCount,   color: 'bg-emerald-500', pct: reachedCount > 0 ? (orderedCount / reachedCount) * 100 : 0 },
  ];

  return (
    <div className="space-y-5 pb-12">

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Customers */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0Zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0Z" /></svg>
            </div>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{repeatPct}% repeat</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalCustomers.toLocaleString()}</p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Total Customers</p>
          <p className="text-xs text-foreground/45 mt-2">{repeatBuyers.toLocaleString()} repeat buyers</p>
        </Card>

        {/* Monthly Outreach */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25Z" /></svg>
            </div>
            <span className="text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{outreachPct}% of DB</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{reachedCount.toLocaleString()}</p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Monthly Outreach</p>
          <p className="text-xs text-foreground/45 mt-2">Unique contacts this month</p>
        </Card>

        {/* Conversion */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            {trendPct !== null && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {trendUp ? '▲' : '▼'} {Math.abs(parseInt(trendPct))}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">{orderedCount.toLocaleString()}</p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Monthly Orders</p>
          <p className="text-xs text-foreground/45 mt-2">{conversionRate}% conversion rate</p>
        </Card>

        {/* Retention Pool */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">Action needed</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{retentionPool.toLocaleString()}</p>
          <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest mt-0.5">Retention Pool</p>
          <p className="text-xs text-foreground/45 mt-2">Due touchpoint ({rangeText} ago)</p>
        </Card>
      </div>

      {/* Pipeline Funnel + Quality Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Conversion Pipeline */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-foreground/90">Conversion Pipeline</h3>
              <p className="text-xs text-foreground/45 mt-0.5">How customers flow from database to orders</p>
            </div>
          </div>
          <div className="space-y-3">
            {funnel.map((step, i) => {
              const barPct = i === 0 ? 100 : Math.min((step.value / funnel[0].value) * 100, 100);
              const convPct = i > 0 ? (funnel[i-1].value > 0 ? ((step.value / funnel[i-1].value) * 100).toFixed(1) : '0') : null;
              return (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${step.color}`} />
                      <span className="text-xs font-semibold text-foreground/70">{step.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {convPct !== null && (
                        <span className="text-[10px] text-foreground/45">{convPct}% of prev</span>
                      )}
                      <span className="text-sm font-bold text-foreground/90">{step.value.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
                    <div className={`h-full ${step.color} rounded-full transition-all duration-700`} style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-foreground/[0.08] grid grid-cols-2 gap-3">
            <div className="bg-foreground/[0.04] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Outreach Coverage</p>
              <p className="text-lg font-bold text-foreground/90 mt-0.5">{outreachPct}%</p>
              <p className="text-[10px] text-foreground/45">of total DB reached</p>
            </div>
            <div className="bg-foreground/[0.04] rounded-xl p-3">
              <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Conversion Rate</p>
              <p className="text-lg font-bold text-foreground/90 mt-0.5">{conversionRate}%</p>
              <p className="text-[10px] text-foreground/45">outreach → orders</p>
            </div>
          </div>
        </Card>

        {/* Customer Quality + Top Agent */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-foreground/90">Customer Quality</h3>
              <p className="text-xs text-foreground/45 mt-0.5">Value rating distribution across your base</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: 'High Value',   count: valueDist.High,   color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700', badge: 'bg-emerald-100 text-emerald-600' },
              { label: 'Medium Value', count: valueDist.Medium, color: 'bg-amber-400',   light: 'bg-amber-50 text-amber-700',   badge: 'bg-amber-100 text-amber-600' },
              { label: 'Low Value',    count: valueDist.Low,    color: 'bg-red-400',     light: 'bg-red-50 text-red-700',       badge: 'bg-red-100 text-red-600' },
            ].map(row => {
              const pct = ((row.count / totalValued) * 100);
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground/70">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.badge}`}>{pct.toFixed(1)}%</span>
                      <span className="text-sm font-bold text-foreground/90 w-16 text-right">{row.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-foreground/[0.08] rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {topAgent && (
            <div className="mt-5 pt-4 border-t border-foreground/[0.08]">
              <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest mb-3">Top Performer This Month</p>
              <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white text-sm">
                    {topAgent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground/90">{topAgent.name}</p>
                    <p className="text-[10px] text-foreground/45">Rank #1 — {topAgent.count} orders</p>
                  </div>
                </div>
                <div className="text-xl">🏆</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Orders Chart + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground/90">Order Activity — Last 30 Days</h3>
              <p className="text-xs text-foreground/45 mt-0.5">{totalOrdersLast30} total orders
                {trendPct !== null && (
                  <span className={`ml-2 font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                    {trendUp ? '▲' : '▼'} {Math.abs(parseInt(trendPct))}% vs first half
                  </span>
                )}
              </p>
            </div>
          </div>
          <OrdersChart data={stats?.revenueData || []} />
        </Card>

        {/* Activity Feed */}
        <Card className="flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-foreground/[0.08] flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground/90">Live Team Feed</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Live</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-gray-50">
            {stats?.recentActivity && stats.recentActivity.length > 0
              ? stats.recentActivity.map((act, i) => {
                  const fb = feedbackConfig[act.feedback] || feedbackConfig['Neutral'];
                  return (
                    <div key={i} className="px-4 py-3 hover:bg-foreground/[0.04] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {act.agent?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-foreground/90 truncate">{act.customerName}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1 ${fb.bg} ${fb.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${fb.dot}`} />
                              {act.feedback}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-[10px] text-foreground/45">{act.agent}</p>
                            <p className="text-[10px] text-foreground/30">{new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              : <div className="py-12 text-center text-foreground/45 text-xs">No interactions recorded today.</div>
            }
          </div>
          <div className="px-5 py-3 border-t border-foreground/[0.08]">
            <button onClick={props.onViewAuditLog} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors w-full text-left">
              View full audit log →
            </button>
          </div>
        </Card>
      </div>

      {/* Segmentation + Value Rating */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-6">
          <div className="mb-1">
            <h3 className="text-sm font-bold text-foreground/90">Customer Segmentation</h3>
            <p className="text-xs text-foreground/45 mt-0.5">Repeat vs one-time buyers over time</p>
          </div>
          <CustomerSegmentationChart trend={stats?.segmentTrend} />
        </Card>
        <Card className="p-6">
          <div className="mb-1">
            <h3 className="text-sm font-bold text-foreground/90">Value Rating Trend</h3>
            <p className="text-xs text-foreground/45 mt-0.5">High / Medium / Low over time</p>
          </div>
          <ValueRatingChart trend={stats?.valueTrend} />
        </Card>
      </div>

      {/* Best Sellers */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground/90">Best Selling Products</h3>
          <p className="text-xs text-foreground/45 mt-0.5">Ranked by total order count across all time</p>
        </div>
        <BestSellingProducts products={stats?.bestSellers || []} />
      </Card>

      {/* Customer Table */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-base font-bold text-foreground">Customer Database</h3>
          <span className="text-xs font-semibold bg-foreground/[0.08] text-foreground/60 px-2.5 py-0.5 rounded-full">
            {props.totalCount.toLocaleString()} records
          </span>
        </div>
        <Card className="overflow-hidden">
          <CustomerTable {...props} customers={props.customers} title="All Records" />
        </Card>
      </div>

    </div>
  );
};

export default CustomerDashboard;
