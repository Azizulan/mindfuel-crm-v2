
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Product, User } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { saveLocalOrder } from '../services/apiService';
import { View } from '../App';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { User as UserIcon, ShoppingBag as ShoppingBagIcon, CreditCard as CreditCardIcon } from 'lucide-react';

interface NewOrderPageProps {
    customers: Customer[];
    products: Product[];
    setView: (view: View) => void;
    currentUser: User;
}

interface OrderItem extends Product {
    quantity: number;
}

const NewOrderPage: React.FC<NewOrderPageProps> = ({ customers, products, setView, currentUser }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
    const [showFillButton, setShowFillButton] = useState(false);
    const [customerStats, setCustomerStats] = useState<{ purchaseCount: number } | null>(null);

    const [customerName, setCustomerName] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [note, setNote] = useState('');

    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [discount, setDiscount] = useState<string>('0');
    const [deliveryCharge, setDeliveryCharge] = useState<string>('0');

    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const [quantityToAdd, setQuantityToAdd] = useState<number>(1);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [isAddProductOpen, setIsAddProductOpen] = useState(true);

    useEffect(() => {
        const cleanedPhone = phoneNumber.replace(/\D/g, '');
        if (cleanedPhone.length === 11) {
            const existingCustomer = customers.find(c => c.phone && c.phone.replace(/\D/g, '').endsWith(cleanedPhone.slice(-10)));
            if (existingCustomer) {
                setFoundCustomer(existingCustomer);
                setShowFillButton(true);
                setCustomerStats({ purchaseCount: existingCustomer.purchaseCount });
            } else {
                setFoundCustomer(null);
                setShowFillButton(false);
                setCustomerStats(null);
            }
        } else {
            setFoundCustomer(null);
            setShowFillButton(false);
            setCustomerStats(null);
        }
    }, [phoneNumber, customers]);

    const handleFillData = () => {
        if (foundCustomer) {
            setCustomerName(foundCustomer.name);
            setShippingAddress(foundCustomer.address || '');
            setShowFillButton(false);
        }
    };

    const handleAddProduct = () => {
        if (!selectedProductId) return;
        const productToAdd = products.find(p => String(p.id) === String(selectedProductId));
        if (!productToAdd) return;
        const existingItem = orderItems.find(item => String(item.id) === String(productToAdd.id));
        if (existingItem) {
            handleQuantityChange(String(productToAdd.id), existingItem.quantity + quantityToAdd);
        } else {
            setOrderItems([...orderItems, { ...productToAdd, quantity: quantityToAdd }]);
        }
        setSelectedProductId('');
        setQuantityToAdd(1);
    };

    const handleQuantityChange = (productId: string | number, newQuantity: number) => {
        if (newQuantity <= 0) {
            setOrderItems(orderItems.filter(item => String(item.id) !== String(productId)));
        } else {
            setOrderItems(orderItems.map(item => String(item.id) === String(productId) ? { ...item, quantity: newQuantity } : item));
        }
    };

    const subtotal = useMemo(() => orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0), [orderItems]);
    const finalPrice = useMemo(() => (subtotal - (parseFloat(discount) || 0)) + (parseFloat(deliveryCharge) || 0), [subtotal, discount, deliveryCharge]);

    const resetForm = () => {
        setPhoneNumber('');
        setCustomerName('');
        setShippingAddress('');
        setNote('');
        setOrderItems([]);
        setDiscount('0');
        setDeliveryCharge('0');
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);
        const invoiceId = `CRM-${Date.now()}`;
        try {
            await saveLocalOrder({
                invoice: invoiceId,
                recipient_name: customerName,
                recipient_phone: phoneNumber,
                recipient_address: shippingAddress,
                cod_amount: finalPrice,
                note: note,
                items: orderItems,
                agent: currentUser.name
            });
            setSuccessMessage(`Order queued for administrator review! Invoice: ${invoiceId}`);
            resetForm();
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400";

    return (
        <div className="space-y-6 pb-12">
            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
                    >
                        <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="text-sm font-medium">{error}</p>
                    </motion.div>
                )}
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="p-10 bg-emerald-50 border border-emerald-100 rounded-2xl text-center"
                    >
                        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-200">
                            <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Order Submitted</h3>
                        <p className="text-sm text-gray-500 mb-6">{successMessage}</p>
                        <button
                            onClick={() => setSuccessMessage(null)}
                            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
                        >
                            Create Another Order
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {!successMessage && (
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Step 1: Customer Details */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                <UserIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Customer Details</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Step 1 of 3</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            className={inputCls}
                                            placeholder="01XXXXXXXXX"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value)}
                                            required
                                        />
                                        <AnimatePresence>
                                            {showFillButton && foundCustomer && (
                                                <motion.button
                                                    initial={{ opacity: 0, x: 8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 8 }}
                                                    type="button"
                                                    onClick={handleFillData}
                                                    className="absolute inset-y-2 right-2 px-3 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    Fill: {foundCustomer.name}
                                                </motion.button>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Full Name</label>
                                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputCls} placeholder="Customer Name" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Shipping Address</label>
                                <textarea rows={2} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className={inputCls + " resize-none"} placeholder="Complete delivery address..." required />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Internal Note</label>
                                <input type="text" value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="Special instructions or customer context..." />
                            </div>
                            {customerStats && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between"
                                >
                                    <p className="text-xs font-semibold text-blue-700">Returning Customer</p>
                                    <span className="text-xs font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1 rounded-full">{customerStats.purchaseCount} Previous Orders</span>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Products */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                                    <ShoppingBagIcon className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800">Inventory Selection</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Step 2 of 3</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAddProductOpen(!isAddProductOpen)}
                                className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                            >
                                <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isAddProductOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                        <div className="p-6">
                            <AnimatePresence>
                                {isAddProductOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Select Product</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedProductId}
                                                        onChange={e => setSelectedProductId(e.target.value)}
                                                        className={inputCls + " appearance-none cursor-pointer"}
                                                    >
                                                        <option value="" disabled>Choose a product...</option>
                                                        {products.map(product => (
                                                            <option key={String(product.id)} value={String(product.id)}>
                                                                {product.name} - ৳{product.price.toLocaleString()}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                        <ChevronDownIcon className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Quantity</label>
                                                <input
                                                    type="number"
                                                    value={quantityToAdd}
                                                    onChange={e => setQuantityToAdd(Math.max(1, parseInt(e.target.value, 10)))}
                                                    min="1"
                                                    className={inputCls + " text-center"}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddProduct}
                                                disabled={!selectedProductId}
                                                className="w-full py-3 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
                                            >
                                                Add to Cart
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {orderItems.length === 0 ? (
                                <div className="py-12 border-2 border-dashed border-gray-200 rounded-2xl text-center">
                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-gray-300">
                                        <ShoppingBagIcon className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Cart is empty</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orderItems.map(item => (
                                        <motion.div
                                            key={String(item.id)}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-400">
                                                    <ShoppingBagIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                                                    <p className="text-xs font-semibold text-emerald-600">৳{item.price.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
                                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                                                        <MinusIcon className="w-3 h-3" />
                                                    </button>
                                                    <span className="w-10 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
                                                        <PlusIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <button type="button" onClick={() => handleQuantityChange(String(item.id), 0)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Summary */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                                <CreditCardIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Financial Summary</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Step 3 of 3</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Discount (৳)</label>
                                    <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className={inputCls + " text-right"} placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Delivery Charge (৳)</label>
                                    <input type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className={inputCls + " text-right"} placeholder="0" />
                                </div>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Subtotal</span>
                                    <span className="font-semibold">৳{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Discount</span>
                                    <span className="font-semibold text-red-500">-৳{parseFloat(discount || '0').toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Delivery</span>
                                    <span className="font-semibold text-blue-600">+৳{parseFloat(deliveryCharge || '0').toLocaleString()}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-700">Net Payable</span>
                                    <span className="text-2xl font-bold text-emerald-600">৳{finalPrice.toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || orderItems.length === 0 || !customerName}
                                className="w-full py-3.5 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Submitting...</span>
                                    </div>
                                ) : 'Finalize & Submit Order'}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

export default NewOrderPage;
