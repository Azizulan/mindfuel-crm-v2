
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag as ShoppingBagIcon, Truck, Search as SearchIcon } from 'lucide-react';

type OrderTab = 'new' | 'track';

const OrdersPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<OrderTab>('new');

    const tabs = [
        { id: 'new', label: 'New Order', icon: ShoppingBagIcon },
        { id: 'track', label: 'Track Order', icon: Truck },
    ];

    const inputCls = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all";

    return (
        <div className="space-y-5 pb-12">
            <div className="max-w-2xl mx-auto space-y-5">
                <div className="flex p-1.5 bg-white border border-gray-200 rounded-2xl shadow-sm gap-1.5 w-fit mx-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as OrderTab)}
                            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-blue-50 text-blue-700 border border-blue-100" : "text-gray-400 hover:text-gray-600"}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-blue-600" : "text-gray-300"}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6"
                    >
                        {activeTab === 'new' && (
                            <div className="space-y-5">
                                <div>
                                    <h3 className="text-base font-bold text-gray-800">Create New Order</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Initialize a new fulfillment request.</p>
                                </div>
                                <form className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Customer</label>
                                        <div className="relative">
                                            <input type="text" className={inputCls + " pl-10"} placeholder="Search for a customer..." />
                                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Product</label>
                                        <input type="text" className={inputCls} placeholder="Enter product name" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Quantity</label>
                                            <input type="number" defaultValue="1" className={inputCls} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Price (BDT)</label>
                                            <input type="number" className={inputCls} placeholder="e.g., 1500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Shipping Address</label>
                                        <textarea rows={2} className={inputCls + " resize-none"} placeholder="Full shipping address"></textarea>
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">Create Order</button>
                                    </div>
                                </form>
                            </div>
                        )}
                        {activeTab === 'track' && (
                            <div className="space-y-5">
                                <div>
                                    <h3 className="text-base font-bold text-gray-800">Track Existing Order</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Monitor real-time fulfillment status.</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-grow relative">
                                        <input type="text" className={inputCls + " pl-10"} placeholder="Enter Tracking ID" />
                                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                    </div>
                                    <button className="px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">Track</button>
                                </div>
                                <div className="py-12 border-2 border-dashed border-gray-200 rounded-2xl text-center">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-gray-200">
                                        <SearchIcon className="w-6 h-6 text-gray-300" />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Courier API integration pending</p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default OrdersPage;
