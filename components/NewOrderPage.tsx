
import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Product, User } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { saveLocalOrder } from '../services/apiService';
import { View } from '../App';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

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

        // Compare IDs as strings to support MongoDB ObjectIDs
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

    const subtotal = useMemo(() => {
        return orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }, [orderItems]);

    const finalPrice = useMemo(() => {
        const discountAmount = parseFloat(discount) || 0;
        const delivery = parseFloat(deliveryCharge) || 0;
        return (subtotal - discountAmount) + delivery;
    }, [subtotal, discount, deliveryCharge]);

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


    return (
        <div className="max-w-3xl mx-auto">
             {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
             {successMessage && (
                <div className="mb-4 p-4 bg-green-100 text-green-800 rounded-md border border-green-200">
                    <p className="font-bold flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Order Submitted
                    </p>
                    <p className="text-sm mt-1">{successMessage}</p>
                    <button onClick={() => setSuccessMessage(null)} className="text-xs font-black uppercase tracking-tighter mt-3 bg-white px-3 py-1.5 rounded border border-green-300 hover:bg-green-50">Create another order</button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Customer Information Card */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-slate-700">Customer Details</h3>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">Step 1 of 3</span>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="phone-number" className="block text-sm font-medium text-slate-700">Customer Phone Number</label>
                            <div className="relative mt-1">
                                <input 
                                    type="tel" 
                                    id="phone-number" 
                                    className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                                    placeholder="Enter 11-digit phone number"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    required
                                />
                                {showFillButton && foundCustomer && (
                                    <button
                                        type="button"
                                        onClick={handleFillData}
                                        className="absolute inset-y-0 right-0 flex items-center px-4 text-sm font-medium text-blue-600 bg-blue-100 rounded-r-md hover:bg-blue-200"
                                    >
                                        Found: {foundCustomer.name}. Click to fill.
                                    </button>
                                )}
                            </div>
                        </div>

                        {customerStats && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h4 className="text-sm font-semibold text-slate-600">Customer History</h4>
                                <div className="mt-2 flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Previous Orders (in system):</span>
                                    <span className="font-bold text-slate-800">{customerStats.purchaseCount}</span>
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="customer-name" className="block text-sm font-medium text-slate-700">Customer Name</label>
                            <input type="text" id="customer-name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" required/>
                        </div>
                        
                        <div>
                            <label htmlFor="shipping-address" className="block text-sm font-medium text-slate-700">Shipping Address</label>
                            <textarea id="shipping-address" rows={3} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" required></textarea>
                        </div>
                         <div>
                            <label htmlFor="note" className="block text-sm font-medium text-slate-700">Internal Order Note</label>
                            <input type="text" id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., Happy repeat customer, urgent delivery" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"/>
                        </div>
                    </div>
                </div>

                {/* Add Product Card */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                     <button
                        type="button"
                        onClick={() => setIsAddProductOpen(!isAddProductOpen)}
                        className="w-full flex justify-between items-center text-left"
                    >
                        <h3 className="text-xl font-semibold text-slate-700">Products & Quantities</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">Step 2 of 3</span>
                            <ChevronDownIcon className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${isAddProductOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </button>
                    {isAddProductOpen && (
                        <div id="add-product-section" className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr,auto,auto] gap-2 items-end">
                            <div className="flex-grow">
                                <label htmlFor="product-select" className="block text-sm font-medium text-slate-700">Select Product</label>
                                <select
                                    id="product-select"
                                    value={selectedProductId}
                                    onChange={e => setSelectedProductId(e.target.value)}
                                    className={`mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white border border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${!selectedProductId ? 'text-slate-500' : 'text-slate-900'}`}
                                >
                                    <option value="" disabled>Select a product</option>
                                    {products.map(product => (
                                        <option key={String(product.id)} value={String(product.id)}>{product.name} - {new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(product.price)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="quantity-to-add" className="block text-sm font-medium text-slate-700">Qty</label>
                                <input
                                    type="number"
                                    id="quantity-to-add"
                                    value={quantityToAdd}
                                    onChange={e => setQuantityToAdd(Math.max(1, parseInt(e.target.value, 10)))}
                                    min="1"
                                    className="mt-1 block w-20 px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleAddProduct}
                                disabled={!selectedProductId}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400"
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>

                {/* Order Summary Card */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                    <div className="flex justify-between items-center mb-4 border-b pb-3">
                        <h3 className="text-xl font-semibold text-slate-700">Order Summary</h3>
                         <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">Step 3 of 3</span>
                    </div>
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                        {orderItems.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">Cart is empty.</p>
                        ) : orderItems.map(item => (
                            <div key={String(item.id)} className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-800">{item.name}</p>
                                    <p className="text-sm text-slate-500">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(item.price)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity - 1)} className="p-1 rounded-full bg-slate-200 hover:bg-slate-300"><MinusIcon /></button>
                                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity + 1)} className="p-1 rounded-full bg-slate-200 hover:bg-slate-300"><PlusIcon /></button>
                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), 0)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {orderItems.length > 0 && (
                         <div className="border-t mt-4 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Subtotal</span>
                                <span className="font-medium text-slate-800">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(subtotal)}</span>
                            </div>
                             <div className="flex justify-between items-center text-sm">
                                <label htmlFor="discount" className="text-slate-600">Discount (BDT)</label>
                                <input 
                                    type="number" 
                                    id="discount" 
                                    value={discount}
                                    onChange={e => setDiscount(e.target.value)}
                                    className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-right"
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <label htmlFor="delivery-charge" className="text-slate-600">Delivery Charge (BDT)</label>
                                <input 
                                    type="number" 
                                    id="delivery-charge" 
                                    value={deliveryCharge}
                                    onChange={e => setDeliveryCharge(e.target.value)}
                                    className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-right"
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                                <span>Total Payable</span>
                                <span>{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(finalPrice)}</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="text-right pt-6">
                        <button type="submit" className="w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-black uppercase tracking-widest rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 transition-colors" disabled={isLoading || orderItems.length === 0 || !customerName}>
                           {isLoading ? 'Processing...' : 'Submit Order for Review'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default NewOrderPage;
