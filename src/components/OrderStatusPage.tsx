
import React, { useState, useEffect } from 'react';
import { getOrders, createOrder } from '../services/packzyApiService';
import { getLocalOrders, deleteLocalOrder, markLocalOrderAsSent } from '../services/apiService';
import { Order, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { Truck } from 'lucide-react';
import { ClockIcon } from './icons/ClockIcon';

interface OrderStatusPageProps {
    currentUser: User;
}

const ConfirmModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'primary';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'primary' }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-card border border-foreground/[0.12] rounded-2xl p-6 max-w-md w-full shadow-xl"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${variant === 'danger' ? "bg-red-50 border-red-100 text-red-500" : "bg-blue-50 border-blue-100 text-blue-500"}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-base font-bold text-foreground/90">{title}</h3>
                </div>
                <p className="text-sm text-foreground/60 leading-relaxed mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-foreground/[0.08] text-foreground/70 text-sm font-semibold rounded-xl hover:bg-foreground/[0.12] transition-colors">Cancel</button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors ${variant === 'danger' ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const OrderStatusPage: React.FC<OrderStatusPageProps> = ({ currentUser }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [localOrders, setLocalOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'approvals' | 'courier'>('approvals');
    const [activeStatus, setActiveStatus] = useState<string>('all');
    const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'danger' | 'primary';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'primary' });

    const isAdmin = currentUser.role === 'Administrator';
    const statuses = ['all', 'in_review', 'pending', 'delivered', 'cancelled', 'returned'];

    useEffect(() => { fetchData(); }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (activeTab === 'approvals') {
                const response = await getLocalOrders();
                setLocalOrders(response);
            } else {
                const response = await getOrders();
                setOrders(response.data);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch data.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendToCourier = (localOrder: any) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Approve Order',
            message: `Are you sure you want to send invoice ${localOrder.invoice} to Packzy Courier?`,
            variant: 'primary',
            onConfirm: async () => {
                setProcessingOrderId(localOrder._id);
                try {
                    await createOrder({
                        invoice: localOrder.invoice,
                        recipient_name: localOrder.recipient_name,
                        recipient_phone: localOrder.recipient_phone,
                        recipient_address: localOrder.recipient_address,
                        cod_amount: localOrder.cod_amount,
                        note: localOrder.note || ''
                    });
                    await markLocalOrderAsSent(localOrder._id);
                    fetchData();
                } catch (err: any) {
                    setError(`Courier Error: ${err.message}`);
                } finally {
                    setProcessingOrderId(null);
                }
            }
        });
    };

    const handleDeleteLocal = (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Delete Draft',
            message: 'Are you sure you want to permanently delete this order draft?',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    await deleteLocalOrder(id);
                    fetchData();
                } catch (err: any) {
                    setError(err.message);
                }
            }
        });
    };

    const statusColors: Record<string, string> = {
        delivered: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        pending: 'bg-amber-50 text-amber-600 border-amber-100',
        in_review: 'bg-blue-50 text-blue-600 border-blue-100',
        cancelled: 'bg-red-50 text-red-500 border-red-100',
        returned: 'bg-violet-50 text-violet-600 border-violet-100',
    };

    const filteredCourierOrders = activeStatus === 'all' ? orders : orders.filter(o => o.status === activeStatus);

    return (
        <div className="space-y-5 pb-12">
            {/* Tabs card */}
            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm overflow-hidden">
                <div className="flex border-b border-foreground/[0.08] bg-foreground/[0.04] p-1.5 gap-1.5">
                    <button
                        onClick={() => setActiveTab('approvals')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${activeTab === 'approvals' ? "bg-card shadow-sm text-foreground/90 border border-foreground/[0.12]" : "text-foreground/45 hover:text-foreground/70"}`}
                    >
                        <ClockIcon className={`w-4 h-4 ${activeTab === 'approvals' ? "text-amber-500" : "text-foreground/30"}`} />
                        Pending Approvals
                        <span className="ml-1 px-2 py-0.5 bg-foreground/[0.08] rounded-lg text-foreground/60 text-[10px]">{localOrders.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('courier')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${activeTab === 'courier' ? "bg-card shadow-sm text-foreground/90 border border-foreground/[0.12]" : "text-foreground/45 hover:text-foreground/70"}`}
                    >
                        <Truck className={`w-4 h-4 ${activeTab === 'courier' ? "text-blue-500" : "text-foreground/30"}`} />
                        Courier History
                    </button>
                </div>

                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {activeTab === 'approvals' ? (
                            <motion.div
                                key="approvals"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                            >
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest">Loading...</p>
                                    </div>
                                ) : localOrders.length === 0 ? (
                                    <div className="text-center py-16 space-y-3">
                                        <div className="w-14 h-14 bg-foreground/[0.04] rounded-2xl flex items-center justify-center mx-auto border border-foreground/[0.12]">
                                            <CheckCircleIcon className="w-7 h-7 text-foreground/30" />
                                        </div>
                                        <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest">No orders pending approval.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-foreground/[0.08]">
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Invoice / Agent</th>
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Date</th>
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Recipient</th>
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Amount</th>
                                                    <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {localOrders.map((order, idx) => (
                                                    <motion.tr
                                                        key={order._id}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.04 }}
                                                        className="hover:bg-foreground/[0.04] transition-colors"
                                                    >
                                                        <td className="py-4 pr-4">
                                                            <div className="text-sm font-semibold text-foreground/90">{order.invoice}</div>
                                                            <div className="text-[10px] text-foreground/45 mt-0.5">By: {order.agent}</div>
                                                        </td>
                                                        <td className="py-4 pr-4">
                                                            <div className="text-sm text-foreground/70">{new Date(order.createdAt).toLocaleDateString()}</div>
                                                            <div className="text-[10px] text-foreground/45 mt-0.5">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        </td>
                                                        <td className="py-4 pr-4">
                                                            <div className="text-sm font-medium text-foreground/90">{order.recipient_name}</div>
                                                            <div className="text-[10px] text-foreground/45 mt-0.5">{order.recipient_phone}</div>
                                                        </td>
                                                        <td className="py-4 pr-4">
                                                            <span className="text-sm font-bold text-emerald-600">৳{order.cod_amount.toLocaleString()}</span>
                                                        </td>
                                                        <td className="py-4 text-right space-x-2">
                                                            {isAdmin && (
                                                                <button
                                                                    onClick={() => handleSendToCourier(order)}
                                                                    disabled={processingOrderId === order._id}
                                                                    className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                                >
                                                                    {processingOrderId === order._id ? 'Sending...' : 'Approve'}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteLocal(order._id)}
                                                                className="text-red-400 text-xs font-semibold px-3 py-1.5 hover:bg-red-50 rounded-xl transition-colors"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="courier"
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                className="space-y-5"
                            >
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {statuses.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setActiveStatus(s)}
                                            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all border ${activeStatus === s ? "bg-card text-foreground/90 border-foreground/[0.12] shadow-sm" : "bg-transparent text-foreground/45 border-transparent hover:text-foreground/70"}`}
                                        >
                                            {s.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>

                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                                        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest">Syncing with courier...</p>
                                    </div>
                                ) : filteredCourierOrders.length === 0 ? (
                                    <div className="text-center py-16 space-y-3">
                                        <div className="w-14 h-14 bg-foreground/[0.04] rounded-2xl flex items-center justify-center mx-auto border border-foreground/[0.12]">
                                            <Truck className="w-7 h-7 text-foreground/30" />
                                        </div>
                                        <p className="text-xs font-semibold text-foreground/45 uppercase tracking-widest">No courier records found.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-foreground/[0.08]">
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Invoice / Tracking</th>
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Date</th>
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Recipient</th>
                                                    <th className="pb-3 text-left text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Status</th>
                                                    <th className="pb-3 text-right text-[10px] font-semibold uppercase tracking-widest text-foreground/45">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {filteredCourierOrders.map((order, idx) => (
                                                    <motion.tr
                                                        key={order.consignment_id}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.04 }}
                                                        className="hover:bg-foreground/[0.04] transition-colors"
                                                    >
                                                        <td className="py-4 pr-4">
                                                            <div className="text-sm font-semibold text-foreground/90">{order.invoice}</div>
                                                            <div className="text-[10px] text-foreground/45 font-mono mt-0.5">{order.tracking_code}</div>
                                                        </td>
                                                        <td className="py-4 pr-4">
                                                            <div className="text-sm text-foreground/70">{new Date(order.created_at).toLocaleDateString()}</div>
                                                            <div className="text-[10px] text-foreground/45 mt-0.5">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                        </td>
                                                        <td className="py-4 pr-4">
                                                            <div className="text-sm font-medium text-foreground/90">{order.recipient_name}</div>
                                                        </td>
                                                        <td className="py-4 pr-4">
                                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${statusColors[order.status] || 'bg-foreground/[0.04] text-foreground/60 border-foreground/[0.08]'}`}>
                                                                {order.status.replace(/_/g, ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="py-4 text-right">
                                                            <span className="text-sm font-bold text-emerald-600">৳{order.cod_amount.toLocaleString()}</span>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
            />

            {error && (
                <div className="fixed bottom-8 right-8 z-[110]">
                    <motion.div
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-red-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3"
                    >
                        <p className="text-xs font-semibold">{error}</p>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default OrderStatusPage;
