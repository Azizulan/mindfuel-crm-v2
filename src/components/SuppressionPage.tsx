
import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/apiService';

interface SuppressedCustomer {
    id: string;
    name: string;
    phone: string;
    suppressedUntil: string;
    suppressionReason: string;
    totalSpending: number;
    purchaseCount: number;
}

const REASON_COLORS: Record<string, string> = {
    'Angry': 'bg-red-100 text-red-700',
    'Not Interested ×2 in 60 days': 'bg-orange-100 text-orange-700',
    'Unreachable — 3× no answer in 14 days': 'bg-rose-100 text-rose-600',
};

const reasonColor = (reason: string) =>
    REASON_COLORS[reason] ?? 'bg-foreground/[0.08] text-foreground/70';

const daysLeft = (until: string): number =>
    Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

const SuppressionPage: React.FC = () => {
    const [data, setData] = useState<SuppressedCustomer[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [lifting, setLifting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (p: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getSuppressedCustomers(p, 20);
            setData(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
            setPage(p);
        } catch (err: any) {
            setError(err.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(1); }, [load]);

    const handleLift = async (customer: SuppressedCustomer) => {
        setLifting(customer.id);
        try {
            await api.liftSuppression(customer.id);
            setData(prev => prev.filter(c => c.id !== customer.id));
            setTotal(prev => prev - 1);
        } catch (err: any) {
            setError(err.message || 'Failed to lift');
        } finally {
            setLifting(null);
        }
    };

    return (
        <div className="space-y-5 pb-12">
            {/* Header */}
            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm px-6 py-5 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Suppressed Customers</h2>
                    <p className="text-xs text-foreground/45 mt-0.5">
                        {total} customer{total !== 1 ? 's' : ''} currently suppressed from the call queue
                    </p>
                </div>
                <button
                    onClick={() => load(1)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">{error}</div>
            )}

            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-sm font-bold text-foreground/85">No suppressed customers</p>
                        <p className="text-xs text-foreground/45 mt-1">All customers are eligible for the call queue.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-foreground/[0.08]">
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-foreground/45 uppercase tracking-widest">Customer</th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-foreground/45 uppercase tracking-widest hidden sm:table-cell">Reason</th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-foreground/45 uppercase tracking-widest hidden md:table-cell">Lifts In</th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-foreground/45 uppercase tracking-widest hidden lg:table-cell">Value</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.map(c => (
                                <tr key={c.id} className="hover:bg-foreground/[0.04] transition-colors">
                                    <td className="px-5 py-3.5">
                                        <p className="font-semibold text-foreground">{c.name}</p>
                                        <p className="text-xs text-foreground/45 font-mono mt-0.5">{c.phone}</p>
                                    </td>
                                    <td className="px-5 py-3.5 hidden sm:table-cell">
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${reasonColor(c.suppressionReason)}`}>
                                            {c.suppressionReason}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 hidden md:table-cell">
                                        <p className="text-xs font-semibold text-foreground/85">{daysLeft(c.suppressedUntil)}d</p>
                                        <p className="text-[10px] text-foreground/45 mt-0.5">
                                            {new Date(c.suppressedUntil).toLocaleDateString()}
                                        </p>
                                    </td>
                                    <td className="px-5 py-3.5 hidden lg:table-cell">
                                        <p className="text-xs font-semibold text-foreground/85">৳{c.totalSpending.toLocaleString()}</p>
                                        <p className="text-[10px] text-foreground/45 mt-0.5">{c.purchaseCount} order{c.purchaseCount !== 1 ? 's' : ''}</p>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <button
                                            onClick={() => handleLift(c)}
                                            disabled={lifting === c.id}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-40 transition-colors whitespace-nowrap"
                                        >
                                            {lifting === c.id ? 'Lifting...' : 'Lift suppression'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-foreground/[0.08] flex items-center justify-between">
                        <span className="text-xs text-foreground/45">{total} total</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => load(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-foreground/[0.12] text-foreground/70 hover:bg-foreground/[0.04] disabled:opacity-40 transition-all"
                            >
                                Prev
                            </button>
                            <span className="text-xs text-foreground/60 font-medium">{page} / {totalPages}</span>
                            <button
                                onClick={() => load(page + 1)}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-foreground/[0.12] text-foreground/70 hover:bg-foreground/[0.04] disabled:opacity-40 transition-all"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SuppressionPage;
