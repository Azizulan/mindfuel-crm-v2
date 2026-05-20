
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, FollowUpNote, Product, User, Purchase } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PhoneOutgoingIcon } from './icons/PhoneOutgoingIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { saveLocalOrder, getLatestOrderByPhone } from '../services/apiService';
import { getTrackingStatus } from '../services/packzyApiService';
import { PlusIcon } from './icons/PlusIcon';
import { MinusIcon } from './icons/MinusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { HappyIcon, NeutralIcon, AngryIcon, PositiveIcon, NotInterestedIcon, CallBackIcon, NoAnswerIcon } from './icons/FeedbackIcons';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface CustomerProfileModalProps {
  customer: Customer;
  onClose: () => void;
  onAddFollowUpNote: (customerId: number | string, newNote: FollowUpNote) => Promise<void>;
  products: Product[];
  currentUser: User;
  onMarkReminderDone?: (customerId: number | string, noteId: string) => Promise<void>;
  activeReminderId?: string;
  onUpdatePurchaseDate?: (customerId: string | number, purchaseId: string, newDate: string) => Promise<void>;
}

type ModalTab = 'profile' | 'log' | 'order' | 'script';

interface OrderItem extends Product {
    quantity: number;
}
const feedbackOptions: FollowUpNote['feedback'][] = ['Positive', 'Happy', 'Neutral', 'Angry', 'Not Interested', 'Call Back Later', 'Call Not Received'];
const feedbackIcons: Record<FollowUpNote['feedback'], React.ReactNode> = {
    'Positive': <PositiveIcon />,
    'Happy': <HappyIcon />,
    'Neutral': <NeutralIcon />,
    'Angry': <AngryIcon />,
    'Not Interested': <NotInterestedIcon />,
    'Call Back Later': <CallBackIcon />,
    'Call Not Received': <NoAnswerIcon />,
};
const feedbackColors: Record<FollowUpNote['feedback'], string> = {
    'Positive': 'border-blue-400 bg-blue-50 text-blue-800',
    'Happy': 'border-green-400 bg-green-50 text-green-800',
    'Neutral': 'border-slate-400 bg-slate-50 text-slate-700',
    'Angry': 'border-red-400 bg-red-50 text-red-800',
    'Not Interested': 'border-yellow-400 bg-yellow-50 text-yellow-800',
    'Call Back Later': 'border-purple-400 bg-purple-50 text-purple-800',
    'Call Not Received': 'border-slate-300 bg-slate-100 text-slate-500',
}


const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({ 
    customer, 
    onClose, 
    onAddFollowUpNote, 
    products, 
    currentUser, 
    onMarkReminderDone, 
    activeReminderId,
    onUpdatePurchaseDate
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('log');
  
  // Follow-up Log State
  const [feedback, setFeedback] = useState<FollowUpNote['feedback'] | null>(null);
  const [notes, setNotes] = useState('');
  const [reminderDate, setReminderDate] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // New Order State
  const [customerName, setCustomerName] = useState(customer.name);
  const [shippingAddress, setShippingAddress] = useState(customer.address || '');
  const [orderNote, setOrderNote] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState<string>('0');
  const [deliveryCharge, setDeliveryCharge] = useState<string>('0');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityToAdd, setQuantityToAdd] = useState<number>(1);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Edit Purchase Date State (Admin only)
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');
  const [isUpdatingDate, setIsUpdatingDate] = useState(false);

  // Courier Data State
  const [courierStatus, setCourierStatus] = useState<string | null>(null);
  const [isFetchingCourier, setIsFetchingCourier] = useState(false);
  const [courierError, setCourierError] = useState<string | null>(null);
  
  const isReminderContext = activeReminderId && onMarkReminderDone;
  const isAdmin = currentUser.role === 'Administrator';

  // Extract last product for the script
  const lastProduct = useMemo(() => {
    if (customer.purchases && customer.purchases.length > 0) {
        return customer.purchases[0].product;
    }
    return "পণ্য";
  }, [customer.purchases]);

  const salesScriptTemplate = `আসসালামু আলাইকুম, আমি মাইন্ড ফিউল থেকে ${currentUser.name} বলছি।
স্যার/ম্যাম ভাল আছেন? স্যার আপনার সাথে কি ২ মিনিট কথা বলা যাবে?
স্যার আপনি আমাদের থেকে এর আগে ${lastProduct} টি নিয়েছিলেন। পণ্যটি কেমন ছিল একটু জানতে চাচ্ছিলাম?

আপনার জন্য আজকে আমাদের একটি অফার ছিল। যদি এখন অর্ডার করেন আপনার জন্য ডেলিভেরি চার্জ টা ফ্রি করে দেওয়া হবে।`;

  useEffect(() => {
    setCustomerName(customer.name);
    setShippingAddress(customer.address || '');
    setOrderItems([]);
    setDiscount('0');
    setDeliveryCharge('0');
    setOrderError(null);
    setOrderSuccess(null);
    setCourierStatus(null);
    setCourierError(null);
  }, [customer]);


    const setReminderFor = (unit: 'hours' | 'days', amount: number) => {
        const now = new Date();
        if (unit === 'hours') {
            now.setHours(now.getHours() + amount);
        } else if (unit === 'days') {
            now.setDate(now.getDate() + amount);
            if (amount === 1) {
                now.setHours(10, 0, 0, 0);
            }
        }
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        
        setReminderDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    };

  const handleSaveNote = async () => {
    if (!feedback) {
        alert("Please select a feedback sentiment.");
        return;
    }
    setIsSavingNote(true);
    try {
        const newNote: FollowUpNote = {
            date: new Date(),
            feedback,
            notes: notes.trim() || `Recorded reaction: ${feedback}`,
            agent: currentUser.name,
        };

        if (feedback === 'Call Back Later' && reminderDate) {
            newNote.reminderDate = new Date(reminderDate);
            newNote.reminderStatus = 'pending';
        }

        await onAddFollowUpNote(customer.id, newNote);

        if (isReminderContext && feedback !== 'Call Back Later') {
            await onMarkReminderDone(customer.id, activeReminderId);
        }

        setFeedback(null);
        setNotes('');
        setReminderDate('');
    } catch (error) {
        console.error("Error saving note:", error);
    } finally {
        setIsSavingNote(false);
    }
  };

  const handleUpdateDate = async (purchase: Purchase) => {
    if (!purchase._id || !onUpdatePurchaseDate) return;
    setIsUpdatingDate(true);
    try {
        await onUpdatePurchaseDate(customer.id, purchase._id, tempDate);
        setEditingPurchaseId(null);
    } catch (err) {
        console.error(err);
    } finally {
        setIsUpdatingDate(false);
    }
  };

  const handleFetchCourierData = async () => {
      setIsFetchingCourier(true);
      setCourierError(null);
      setCourierStatus(null);
      try {
          const latestOrder = await getLatestOrderByPhone(customer.phone);
          if (latestOrder.status === 'sent_to_courier') {
              const tracking = await getTrackingStatus('invoice', latestOrder.invoice);
              setCourierStatus(tracking.delivery_status.replace(/_/g, ' '));
          } else {
              setCourierStatus('Draft / Awaiting Approval');
          }
      } catch (err: any) {
          setCourierError(err.message === 'No orders found' ? 'No courier history for this customer.' : 'Unable to reach tracking server.');
      } finally {
          setIsFetchingCourier(false);
      }
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    // Map IDs to strings to avoid parseInt issues with Mongo ObjectIDs
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

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setOrderSuccess(null);
    setIsCreatingOrder(true);
    try {
        const invoiceId = `CRM-${Date.now()}`;
        await saveLocalOrder({
            invoice: invoiceId,
            recipient_name: customerName,
            recipient_phone: customer.phone,
            recipient_address: shippingAddress,
            cod_amount: finalPrice,
            note: orderNote,
            items: orderItems,
            agent: currentUser.name
        });
        setOrderSuccess(`Order submitted for review! Invoice: ${invoiceId}`);
        setOrderItems([]);
        setDiscount('0');
        setDeliveryCharge('0');
    } catch (err: any) {
        setOrderError(err.message || 'An unknown error occurred.');
    } finally {
        setIsCreatingOrder(false);
    }
  };

  const ratingStyles = {
    High: 'bg-green-100 text-green-800 border-green-200',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Low: 'bg-red-100 text-red-800 border-red-200',
  };

  const formatForWhatsApp = (phone: string | undefined): string => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('880')) return cleaned;
    if (cleaned.startsWith('0')) return `880${cleaned.substring(1)}`;
    return `880${cleaned}`;
  };
  
  const formatForDisplay = (phone: string | undefined): string => {
    if (!phone) return 'N/A';
    let cleaned = phone.replace(/\D/g, '');
    let localPart = cleaned.startsWith('880') ? cleaned.substring(3) : (cleaned.startsWith('0') ? cleaned.substring(1) : cleaned);
    if (localPart.length === 10) return `+880 ${localPart.substring(0, 4)}-${localPart.substring(4)}`;
    return `+880 ${localPart}`;
  };

  const whatsAppNumber = formatForWhatsApp(customer.phone);
  const displayPhoneNumber = formatForDisplay(customer.phone);
  const telLink = customer.phone ? `tel:+${whatsAppNumber}` : '';

  const TabButton: React.FC<{tabId: ModalTab, label: string}> = ({ tabId, label }) => (
    <button
        onClick={() => setActiveTab(tabId)}
        className={`${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
    >{label}</button>
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(salesScriptTemplate);
    alert("Script copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col transform transition-all">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-start">
            <div>
                <h3 className="text-xl font-bold text-slate-800">{customer.name}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm text-slate-500 mt-1">
                    <span>{customer.email}</span>
                    <div className="flex items-center gap-3 mt-1 sm:mt-0">
                        <span className="hidden sm:inline">&middot;</span>
                        <span>{displayPhoneNumber}</span>
                        <a href={telLink} title="Call Customer" className="text-slate-500 hover:text-blue-600 transition-colors"><PhoneOutgoingIcon className="h-4 w-4" /></a>
                        <a href={`https://wa.me/${whatsAppNumber}`} title="Message on WhatsApp" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-green-600 transition-colors"><WhatsAppIcon className="h-4 w-4" /></a>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"><XMarkIcon /></button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-2">
            <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                <TabButton tabId="profile" label="Profile" />
                <TabButton tabId="log" label="Follow-up Log" />
                <TabButton tabId="order" label="New Order" />
                <TabButton tabId="script" label="Call Script" />
            </nav>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto">
            {activeTab === 'profile' && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-50 p-4 rounded-lg"><div className="text-xs text-slate-500 uppercase font-semibold">Value Rating</div><div className={`mt-1 text-lg font-bold px-3 py-1 inline-flex rounded-full border ${ratingStyles[customer.valueRating]}`}>{customer.valueRating}</div></div>
                        <div className="bg-slate-50 p-4 rounded-lg"><div className="text-xs text-slate-500 uppercase font-semibold">Total Spending</div><div className="mt-1 text-xl font-bold text-slate-800">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(customer.totalSpending)}</div></div>
                        <div className="bg-slate-50 p-4 rounded-lg"><div className="text-xs text-slate-500 uppercase font-semibold">Total Orders</div><div className="mt-1 text-xl font-bold text-slate-800">{customer.purchaseCount}</div></div>
                    </div>

                    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">Recent Courier Activity</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Live status from the shipping partner.</p>
                            </div>
                            <button 
                                onClick={handleFetchCourierData}
                                disabled={isFetchingCourier}
                                className="bg-white border border-slate-200 text-blue-600 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-md shadow-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
                            >
                                {isFetchingCourier ? 'Checking...' : 'Check Status'}
                            </button>
                        </div>
                        {(courierStatus || courierError) && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                {courierStatus && (
                                    <div className="flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-sm font-bold text-slate-700 capitalize">Status: {courierStatus}</span>
                                    </div>
                                )}
                                {courierError && (
                                    <p className="text-xs text-red-500 font-medium italic">{courierError}</p>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-8">
                        <h4 className="text-md font-semibold text-slate-700 mb-3">Purchase History {isAdmin && <span className="text-xs font-normal text-slate-500">(Admin: Click date to edit)</span>}</h4>
                        <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                            <ul className="divide-y divide-slate-200">
                                {customer.purchases.length > 0 ? customer.purchases.map((p, i) => (
                                    <li key={i} className="px-4 py-3 grid grid-cols-3 gap-4 items-center text-sm">
                                        <span className="text-slate-800 font-medium col-span-2 truncate" title={p.product}>{p.product || 'N/A'}</span>
                                        <div className="text-right">
                                            <span className="font-medium text-slate-800">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(p.amount)}</span>
                                            {editingPurchaseId === p._id ? (
                                                <div className="mt-1 flex items-center justify-end gap-1">
                                                    <input 
                                                        type="date" 
                                                        value={tempDate} 
                                                        onChange={e => setTempDate(e.target.value)} 
                                                        className="text-xs border rounded px-1 py-0.5"
                                                    />
                                                    <button 
                                                        onClick={() => handleUpdateDate(p)} 
                                                        disabled={isUpdatingDate}
                                                        className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded"
                                                    >
                                                        {isUpdatingDate ? '...' : 'OK'}
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingPurchaseId(null)} 
                                                        className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            ) : (
                                                <span 
                                                    className={`text-xs block ${isAdmin ? 'text-blue-600 cursor-pointer hover:underline' : 'text-slate-500'}`}
                                                    onClick={() => {
                                                        if (isAdmin && p._id) {
                                                            setEditingPurchaseId(p._id);
                                                            setTempDate(new Date(p.date).toISOString().split('T')[0]);
                                                        }
                                                    }}
                                                >
                                                    {new Date(p.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                )) : (
                                    <li className="px-4 py-10 text-center text-sm text-slate-500">No purchase history found.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'log' && (
                <div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <h4 className="text-md font-semibold text-slate-700 mb-3">Add New Follow-up Note</h4>
                        <div className="mb-3">
                            <label className="block text-sm font-medium text-slate-600 mb-2">Customer Feedback</label>
                            <div className="flex flex-wrap gap-2">
                                {feedbackOptions.map(option => (
                                    <button key={option} onClick={() => setFeedback(option)} className={`flex items-center gap-2 text-sm px-3 py-2 border rounded-md transition-colors ${feedback === option ? 'ring-2 ring-offset-1 ring-blue-500 ' + feedbackColors[option] : 'bg-white hover:bg-slate-100'}`}>
                                        {feedbackIcons[option]} {option}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {feedback === 'Call Back Later' && (
                            <div className="my-3 space-y-2">
                                <label htmlFor="reminder-date" className="block text-sm font-medium text-slate-600 mb-1">Reminder Date & Time</label>
                                <input type="datetime-local" id="reminder-date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className="input-field w-full sm:w-auto" min={new Date().toISOString().slice(0, 16)}/>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button type="button" onClick={() => setReminderFor('hours', 1)} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">in 1 Hour</button>
                                    <button type="button" onClick={() => setReminderFor('hours', 2)} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">in 2 Hours</button>
                                    <button type="button" onClick={() => setReminderFor('days', 1)} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">Tomorrow</button>
                                    <button type="button" onClick={() => setReminderFor('days', 7)} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">Next Week</button>
                                </div>
                            </div>
                        )}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-slate-600 mb-1">Notes (Optional)</label>
                            <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="w-full input-field" placeholder="Any additional details..."></textarea>
                        </div>
                        <div className="text-right mt-3">
                            <button onClick={handleSaveNote} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:bg-slate-400" disabled={!feedback || isSavingNote}>
                                {isSavingNote ? 'Saving...' : (isReminderContext && feedback !== 'Call Back Later' ? 'Save & Complete Reminder' : 'Save Feedback')}
                            </button>
                        </div>
                    </div>
                    <div className="mt-8">
                        <h4 className="text-md font-semibold text-slate-700 mb-3">Interaction History</h4>
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                            {(customer.followUpNotes || []).length > 0 ? customer.followUpNotes?.map((note, index) => (
                                <div key={index} className={`border-l-4 p-4 rounded-r-lg ${feedbackColors[note.feedback]}`}>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="font-bold flex items-center gap-2">{feedbackIcons[note.feedback]} {note.feedback}</div>
                                        <div className="text-xs">{new Date(note.date).toLocaleString()} by {note.agent}</div>
                                    </div>
                                    <p className="mt-2 text-sm">{note.notes}</p>
                                    {note.reminderDate && <p className="mt-2 text-xs font-semibold text-purple-800">Reminder set for: {new Date(note.reminderDate).toLocaleString()}</p>}
                                </div>
                            )) : <p className="text-center text-sm text-slate-500 py-8">No follow-up notes recorded yet.</p>}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'order' && (
                <form onSubmit={handleCreateOrder} className="space-y-6">
                    {orderSuccess && <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">{orderSuccess}</div>}
                    {orderError && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{orderError}</div>}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="order-customer-name" className="block text-sm font-medium text-slate-700">Customer Name</label><input type="text" id="order-customer-name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1 w-full input-field" required/></div>
                        <div><label htmlFor="order-phone" className="block text-sm font-medium text-slate-700">Phone</label><input type="text" id="order-phone" value={customer.phone} className="mt-1 w-full input-field bg-slate-100" readOnly/></div>
                    </div>
                    <div><label htmlFor="order-shipping-address" className="block text-sm font-medium text-slate-700">Shipping Address</label><textarea id="order-shipping-address" rows={2} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="mt-1 w-full input-field" required></textarea></div>
                    
                    <div className="border rounded-md p-4">
                         <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,auto] gap-2 items-end">
                            <div className="flex-grow">
                                <label htmlFor="product-select" className="block text-sm font-medium text-slate-700">Product</label>
                                <select id="product-select" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="mt-1 block w-full input-field"><option value="" disabled>Select a product</option>{products.map(p => (<option key={String(p.id)} value={String(p.id)}>{p.name} - {new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(p.price)}</option>))}</select>
                            </div>
                            <div><label htmlFor="quantity-to-add" className="block text-sm font-medium text-slate-700">Qty</label><input type="number" id="quantity-to-add" value={quantityToAdd} onChange={e => setQuantityToAdd(Math.max(1, parseInt(e.target.value, 10)))} min="1" className="mt-1 w-20 input-field" /></div>
                            <button type="button" onClick={handleAddProduct} disabled={!selectedProductId} className="btn-primary py-2 px-4">Add</button>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                         {orderItems.length === 0 ? <p className="text-slate-500 text-sm text-center py-4">No products added.</p> : orderItems.map(item => (
                            <div key={String(item.id)} className="flex items-center justify-between text-sm">
                                <div><p className="font-medium text-slate-800">{item.name}</p><p className="text-slate-500">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(item.price)}</p></div>
                                <div className="flex items-center gap-2"><button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity - 1)} className="p-1 rounded-full bg-slate-200 hover:bg-slate-300"><MinusIcon /></button><span className="w-8 text-center font-medium">{item.quantity}</span><button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity + 1)} className="p-1 rounded-full bg-slate-200 hover:bg-slate-300"><PlusIcon /></button><button type="button" onClick={() => handleQuantityChange(String(item.id), 0)} className="p-1 text-red-500 hover:text-red-700"><TrashIcon /></button></div>
                            </div>
                        ))}
                    </div>
                    
                    {orderItems.length > 0 && (
                         <div className="border-t mt-4 pt-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(subtotal)}</span></div>
                            <div className="flex justify-between items-center">
                                <label htmlFor="discount">Discount (BDT)</label>
                                <input type="number" id="discount" value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 text-right input-field" placeholder="0" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label htmlFor="delivery-charge">Delivery Charge (BDT)</label>
                                <input type="number" id="delivery-charge" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="w-24 text-right input-field" placeholder="0" />
                            </div>
                            <div className="flex justify-between text-base font-semibold border-t pt-2 mt-2"><span>Final Price</span><span>{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(finalPrice)}</span></div>
                        </div>
                    )}

                    <div className="text-right pt-2">
                        <button type="submit" className="w-full sm:w-auto btn-primary py-2 px-6" disabled={isCreatingOrder || orderItems.length === 0 || !customerName}>{isCreatingOrder ? 'Submitting...' : 'Submit Order for Review'}</button>
                    </div>
                </form>
            )}
            {activeTab === 'script' && (
                <div>
                     <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                        <h4 className="text-md font-semibold text-slate-700">Recommended Sales Script</h4>
                        <button onClick={copyToClipboard} className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-200 transition-colors text-xs font-bold uppercase tracking-tighter">
                            <ClipboardIcon className="h-3.5 w-3.5" /> Copy Script
                        </button>
                    </div>
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg shadow-inner">
                        <p className="text-lg text-slate-800 leading-relaxed font-medium whitespace-pre-wrap font-serif">
                            {salesScriptTemplate}
                        </p>
                    </div>
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Pro Tips for {currentUser.name}:</h5>
                        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                            <li>Keep a smiling tone; it reflects in your voice.</li>
                            <li>Pause after asking how the product was.</li>
                            <li>If they say no, ask for feedback to improve.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 bg-slate-50 border-t text-right">
           <button onClick={onClose} className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 transition-colors text-sm font-medium">Close</button>
        </div>
      </div>
      <style>{`
        .input-field {
            display: block;
            padding: 0.5rem 0.75rem;
            background-color: white;
            border: 1px solid #cbd5e1;
            border-radius: 0.375rem;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            font-size: 0.875rem;
        }
        .input-field:focus {
            outline: none;
            --tw-ring-color: #3b82f6;
            --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
            --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
            box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
            border-color: #3b82f6;
        }
        .btn-primary {
            display: inline-flex;
            justify-content: center;
            border: 1px solid transparent;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            font-size: 0.875rem;
            font-weight: 500;
            border-radius: 0.375rem;
            color: white;
            background-color: #2563eb;
        }
        .btn-primary:hover {
            background-color: #1d4ed8;
        }
        .btn-primary:focus {
            outline: none;
            --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
            --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
            box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
            --tw-ring-color: #2563eb;
            --tw-ring-offset-width: 2px;
        }
        .btn-primary:disabled {
            background-color: #94a3b8;
            cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default CustomerProfileModal;
