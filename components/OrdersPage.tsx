
import React, { useState } from 'react';

type OrderTab = 'new' | 'track';

const OrdersPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<OrderTab>('new');

    const commonTabClass = 'px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    const activeTabClass = 'bg-blue-600 text-white';
    const inactiveTabClass = 'bg-white text-slate-600 hover:bg-slate-100';

    return (
        <div>
            <h2 className="text-3xl font-bold text-slate-800 mb-6">Orders Management</h2>

            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                <div className="border-b border-slate-200 mb-6">
                    <nav className="flex space-x-2" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('new')}
                            className={`${commonTabClass} ${activeTab === 'new' ? activeTabClass : inactiveTabClass}`}
                        >
                            New Order
                        </button>
                        <button
                            onClick={() => setActiveTab('track')}
                            className={`${commonTabClass} ${activeTab === 'track' ? activeTabClass : inactiveTabClass}`}
                        >
                            Track Order
                        </button>
                    </nav>
                </div>

                <div>
                    {activeTab === 'new' && (
                        <div>
                            <h3 className="text-xl font-semibold text-slate-700 mb-4">Create New Order</h3>
                            <form className="space-y-4">
                                <div>
                                    <label htmlFor="customer-name" className="block text-sm font-medium text-slate-700">Customer Name</label>
                                    <input type="text" id="customer-name" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search for an existing customer..."/>
                                </div>
                                <div>
                                    <label htmlFor="product" className="block text-sm font-medium text-slate-700">Product</label>
                                    <input type="text" id="product" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Enter product name"/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">Quantity</label>
                                        <input type="number" id="quantity" defaultValue="1" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                                    </div>
                                    <div>
                                        <label htmlFor="price" className="block text-sm font-medium text-slate-700">Price (BDT)</label>
                                        <input type="number" id="price" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="e.g., 1500"/>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="shipping-address" className="block text-sm font-medium text-slate-700">Shipping Address</label>
                                    <textarea id="shipping-address" rows={3} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Full shipping address"></textarea>
                                </div>
                                <div className="text-right">
                                    <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                        Create Order
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {activeTab === 'track' && (
                        <div>
                            <h3 className="text-xl font-semibold text-slate-700 mb-4">Track Existing Order</h3>
                            <p className="text-sm text-slate-500 mb-4">Enter the tracking ID provided by the courier service.</p>
                            <div className="flex space-x-2">
                                <input type="text" className="flex-grow px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Enter Tracking ID"/>
                                <button className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                    Track
                                </button>
                            </div>
                            <div className="mt-6 p-4 bg-slate-50 rounded-lg text-center text-slate-500">
                                <p>Tracking information will be displayed here.</p>
                                <p className="text-xs mt-1">(Courier API integration is pending)</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrdersPage;
