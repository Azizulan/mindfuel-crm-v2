
import React, { useState } from 'react';
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

const MetricBlock: React.FC<{ label: string, value: string | number, subValue?: string, colorClass?: string }> = ({ label, value, subValue, colorClass = "text-slate-900" }) => (
    <div className="flex flex-col">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black tracking-tight ${colorClass}`}>{value}</span>
            {subValue && <span className="text-[10px] font-bold text-slate-400">{subValue}</span>}
        </div>
    </div>
);

const CustomerDashboard: React.FC<CustomerDashboardProps> = (props) => {
  if (!props.stats && props.isLoading) {
    return (
        <div className="flex flex-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );
  }

  const stats = props.stats;
  const reachedCount = stats?.totalOutreachCount || 0;
  const orderedCount = stats?.totalOrderCount || 0; 
  const conversionRate = reachedCount > 0 ? ((orderedCount / reachedCount) * 100).toFixed(1) : "0";
  const retentionPool = stats?.followUpCount || 0;
  const rangeText = `${props.outreachRange.end}-${props.outreachRange.start}`;

  return (
    <div className="space-y-6">
      {/* High-Impact Command Center */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Primary KPI */}
            <div className="p-6 bg-slate-900 text-white">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Database</span>
                    <span className="bg-emerald-500 h-2 w-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                </div>
                <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl font-black tracking-tighter">{stats?.totalCustomers || 0}</h2>
                    <span className="text-xs font-bold text-slate-500 uppercase">Records</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] font-bold py-0.5 px-2 bg-slate-800 rounded border border-slate-700 text-slate-300 uppercase tracking-tighter">Sync Active</span>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="p-6 flex flex-col justify-between hover:bg-slate-50 transition-colors">
                <MetricBlock label="Monthly Effort" value={reachedCount} subValue="logs" colorClass="text-blue-600" />
                <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full w-3/4 opacity-50"></div>
                </div>
            </div>

            <div className="p-6 flex flex-col justify-between hover:bg-slate-50 transition-colors">
                <MetricBlock label="Monthly Success" value={orderedCount} subValue="orders" colorClass="text-emerald-600" />
                <div className="mt-4 flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">+{conversionRate}% Velocity</span>
                </div>
            </div>

            <div className="p-6 flex flex-col justify-between hover:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                    <MetricBlock label="Retention Health" value={retentionPool} subValue="at risk" colorClass={retentionPool > 10 ? "text-amber-600" : "text-slate-900"} />
                    <button 
                        onClick={() => window.location.hash = 'followUp'} 
                        className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest"
                    >Action →</button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-2 italic leading-tight">Due for touchpoint based on {rangeText} day window.</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CustomerSegmentationChart trend={stats?.segmentTrend} />
          <ValueRatingChart trend={stats?.valueTrend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <OrdersChart data={stats?.revenueData || []} />
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Team Feed</h4>
                <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded">Realtime</span>
            </div>
            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[300px]">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? stats.recentActivity.map((act, i) => (
                    <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-bold text-slate-800">{act.customerName}</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                act.feedback === 'Happy' || act.feedback === 'Positive' ? 'bg-green-50 text-green-600' :
                                act.feedback === 'Angry' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
                            }`}>{act.feedback}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>{act.agent}</span>
                            <span>{new Date(act.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                )) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic">No interactions detected yet.</div>
                )}
            </div>
            <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
                <button 
                    onClick={props.onViewAuditLog}
                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >View Global Audit Log</button>
            </div>
        </div>
      </div>

      <BestSellingProducts products={stats?.bestSellers || []} />

      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center gap-3 mb-6 mt-4">
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Master Database Directory</h3>
            <span className="bg-slate-800 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Full View</span>
        </div>
        <CustomerTable 
            {...props}
            customers={props.customers} 
            title="All Records" 
        />
      </div>
    </div>
  );
};

export default CustomerDashboard;
