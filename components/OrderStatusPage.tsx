
import React, { useState, useEffect } from 'react';
import { getOrders, createOrder } from '../services/packzyApiService';
import { getLocalOrders, deleteLocalOrder, markLocalOrderAsSent } from '../services/apiService';
import { Order, User } from '../types';

interface OrderStatusPageProps {
    currentUser: User;
}

const OrderStatusPage: React.FC<OrderStatusPageProps> = ({ currentUser }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [localOrders, setLocalOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'approvals' | 'courier'>('approvals');
    const [activeStatus, setActiveStatus] = useState<string>('all');
    const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

    const isAdmin = currentUser.role === 'Administrator';
    const statuses = ['all', 'in_review', 'pending', 'delivered', 'cancelled', 'returned'];

    useEffect(() => {
        fetchData();
    }, [activeTab]);

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

    const handleSendToCourier = async (localOrder: any) => {
        if (!window.confirm('Send this order to Packzy Courier?')) return;
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
            alert('Order sent to courier successfully!');
            fetchData();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setProcessingOrderId(null);
        }
    };

    const handleDeleteLocal = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this draft?')) return;
        try {
            await deleteLocalOrder(id);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const statusColors: Record<string, string> = {
        delivered: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        in_review: 'bg-blue-100 text-blue-800',
        cancelled: 'bg-red-100 text-red-800',
        returned: 'bg-purple-100 text-purple-800',
    };

    const filteredCourierOrders = activeStatus === 'all' ? orders : orders.filter(o => o.status === activeStatus);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b flex px-4">
                    <button 
                        onClick={() => setActiveTab('approvals')}
                        className={`py-4 px-6 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'approvals' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400'}`}
                    >
                        Pending Approvals ({localOrders.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('courier')}
                        className={`py-4 px-6 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'courier' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400'}`}
                    >
                        Courier History
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'approvals' ? (
                        <div className="space-y-4">
                            {isLoading ? (
                                <div className="text-center py-10"><div className="animate-spin h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div></div>
                            ) : localOrders.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 italic">No orders pending approval.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Invoice / Agent</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Created At</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Customer</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Amount</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {localOrders.map(order => (
                                                <tr key={order._id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-slate-900">{order.invoice}</div>
                                                        <div className="text-[10px] text-slate-400">By: {order.agent}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-xs font-medium text-slate-600">
                                                            {new Date(order.createdAt).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm font-medium text-slate-700">{order.recipient_name}</div>
                                                        <div className="text-[10px] text-slate-500">{order.recipient_phone}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap font-black text-slate-800">
                                                        ৳{order.cod_amount.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-right space-x-2">
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={() => handleSendToCourier(order)}
                                                                disabled={processingOrderId === order._id}
                                                                className="bg-indigo-600 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                                                            >
                                                                {processingOrderId === order._id ? 'Sending...' : 'Approve & Send'}
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDeleteLocal(order._id)}
                                                            className="text-red-600 text-[10px] font-bold uppercase px-3 py-1.5 hover:bg-red-50 rounded"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                                {statuses.map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => setActiveStatus(s)}
                                        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-colors border ${activeStatus === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                                    >
                                        {s.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                            {isLoading ? (
                                <div className="text-center py-10"><div className="animate-spin h-6 w-6 border-b-2 border-slate-600 mx-auto"></div></div>
                            ) : filteredCourierOrders.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 italic">No courier records found.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Invoice / Tracking</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Created At</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Customer</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">Status</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-slate-500">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredCourierOrders.map(order => (
                                                <tr key={order.consignment_id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-slate-900">{order.invoice}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{order.tracking_code}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-xs font-medium text-slate-600">
                                                            {new Date(order.created_at).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm font-medium text-slate-700">{order.recipient_name}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${statusColors[order.status] || 'bg-slate-100 text-slate-600'}`}>
                                                            {order.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-right font-black text-slate-800">
                                                        ৳{order.cod_amount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderStatusPage;
