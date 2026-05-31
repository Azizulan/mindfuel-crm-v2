
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
    'Positive': 'border-blue-300 bg-blue-50 text-blue-800',
    'Happy': 'border-green-300 bg-green-50 text-green-800',
    'Neutral': 'border-foreground/[0.15] bg-foreground/[0.04] text-foreground/85',
    'Angry': 'border-red-300 bg-red-50 text-red-800',
    'Not Interested': 'border-yellow-300 bg-yellow-50 text-yellow-800',
    'Call Back Later': 'border-purple-300 bg-purple-50 text-purple-800',
    'Call Not Received': 'border-foreground/[0.12] bg-foreground/[0.08] text-foreground/60',
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

  const [feedback, setFeedback] = useState<FollowUpNote['feedback'] | null>(null);
  const [notes, setNotes] = useState('');
  const [reminderDate, setReminderDate] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);

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

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');
  const [isUpdatingDate, setIsUpdatingDate] = useState(false);

  const [courierStatus, setCourierStatus] = useState<string | null>(null);
  const [isFetchingCourier, setIsFetchingCourier] = useState(false);
  const [courierError, setCourierError] = useState<string | null>(null);

  const isReminderContext = activeReminderId && onMarkReminderDone;
  const isAdmin = currentUser.role === 'Administrator';

  const lastProduct = useMemo(() => {
    if (customer.purchases && customer.purchases.length > 0) {
        return customer.purchases[0].product;
    }
    return "পণ্য";
  }, [customer.purchases]);

  const salesScriptTemplate = `আসসালামু আলাইকুম, আমি মাইন্ড ফিউল থেকে ${currentUser.name} বলছি।
স্যার/ম্যাম ভাল আছেন? স্যার আপনার সাথে কি ২ মিনিট কথা বলা যাবে?
স্যার আপনি আমাদের থেকে এর আগে ${lastProduct} টি নিয়েছিলেন। পণ্যটি কেমন ছিল একটু জানতে চাচ্ছিলাম?

আপনার জন্য আজকে আমাদের একটি অফার ছিল। যদি এখন অর্ডার করেন আপনার জন্য ডেলিভেরি চার্জ টা ফ্রি করে দেওয়া হবে।`;

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
            if (amount === 1) now.setHours(10, 0, 0, 0);
        }
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        setReminderDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    };

  const handleSaveNote = async () => {
    if (!feedback) { alert("Please select a feedback sentiment."); return; }
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
    High: 'bg-green-100 text-green-700 border-green-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low: 'bg-red-100 text-red-700 border-red-200',
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

  const inputCls = "w-full px-3.5 py-2.5 bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl text-sm text-foreground/90 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all";

  const TabButton: React.FC<{tabId: ModalTab, label: string}> = ({ tabId, label }) => (
    <button
        onClick={() => setActiveTab(tabId)}
        className={`${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-foreground/60 hover:text-foreground/85 hover:border-foreground/[0.15]'} whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
    >{label}</button>
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(salesScriptTemplate);
    alert("Script copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-foreground/[0.12]">
        {/* Header */}
        <div className="p-5 border-b border-foreground/[0.08] flex justify-between items-start">
            <div>
                <h3 className="text-lg font-bold text-foreground">{customer.name}</h3>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm text-foreground/60 mt-1">
                    <span>{customer.email}</span>
                    <div className="flex items-center gap-3 mt-1 sm:mt-0">
                        <span className="hidden sm:inline">&middot;</span>
                        <span>{displayPhoneNumber}</span>
                        <a href={telLink} title="Call Customer" className="text-foreground/45 hover:text-blue-600 transition-colors"><PhoneOutgoingIcon className="h-4 w-4" /></a>
                        <a href={`https://wa.me/${whatsAppNumber}`} title="Message on WhatsApp" target="_blank" rel="noopener noreferrer" className="text-foreground/45 hover:text-green-600 transition-colors"><WhatsAppIcon className="h-4 w-4" /></a>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="text-foreground/45 hover:text-foreground/70 p-1.5 rounded-lg hover:bg-foreground/[0.08] transition-colors"><XMarkIcon /></button>
        </div>

        {/* Tabs */}
        <div className="border-b border-foreground/[0.08] px-2">
            <nav className="-mb-px flex space-x-1">
                <TabButton tabId="profile" label="Profile" />
                <TabButton tabId="log" label="Follow-up Log" />
                <TabButton tabId="order" label="New Order" />
                <TabButton tabId="script" label="Call Script" />
            </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'profile' && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="bg-foreground/[0.04] border border-foreground/[0.08] p-4 rounded-2xl">
                            <div className="text-[10px] text-foreground/60 uppercase font-semibold tracking-widest">Value Rating</div>
                            <div className={`mt-2 text-sm font-bold px-3 py-1 inline-flex rounded-full border ${ratingStyles[customer.valueRating]}`}>{customer.valueRating}</div>
                        </div>
                        <div className="bg-foreground/[0.04] border border-foreground/[0.08] p-4 rounded-2xl">
                            <div className="text-[10px] text-foreground/60 uppercase font-semibold tracking-widest">Total Spending</div>
                            <div className="mt-2 text-lg font-bold text-foreground/90">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(customer.totalSpending)}</div>
                        </div>
                        <div className="bg-foreground/[0.04] border border-foreground/[0.08] p-4 rounded-2xl">
                            <div className="text-[10px] text-foreground/60 uppercase font-semibold tracking-widest">Total Orders</div>
                            <div className="mt-2 text-lg font-bold text-foreground/90">{customer.purchaseCount}</div>
                        </div>
                    </div>

                    <div className="mt-5 bg-card border border-foreground/[0.12] rounded-2xl p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-foreground/60 uppercase tracking-widest">Recent Courier Activity</h4>
                                <p className="text-xs text-foreground/45 mt-0.5">Live status from the shipping partner.</p>
                            </div>
                            <button
                                onClick={handleFetchCourierData}
                                disabled={isFetchingCourier}
                                className="bg-blue-50 border border-blue-100 text-blue-600 font-semibold text-xs px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                                {isFetchingCourier ? 'Checking...' : 'Check Status'}
                            </button>
                        </div>
                        {(courierStatus || courierError) && (
                            <div className="mt-4 pt-4 border-t border-foreground/[0.08]">
                                {courierStatus && (
                                    <div className="flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-sm font-semibold text-foreground/85 capitalize">Status: {courierStatus}</span>
                                    </div>
                                )}
                                {courierError && <p className="text-xs text-red-500 font-medium italic">{courierError}</p>}
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        <h4 className="text-sm font-semibold text-foreground/85 mb-3">Purchase History {isAdmin && <span className="text-xs font-normal text-foreground/45">(Admin: Click date to edit)</span>}</h4>
                        <div className="border border-foreground/[0.12] rounded-2xl max-h-60 overflow-y-auto">
                            <ul className="divide-y divide-gray-100">
                                {customer.purchases.length > 0 ? customer.purchases.map((p, i) => (
                                    <li key={i} className="px-4 py-3 grid grid-cols-3 gap-4 items-center text-sm">
                                        <span className="text-foreground/90 font-medium col-span-2 truncate" title={p.product}>{p.product || 'N/A'}</span>
                                        <div className="text-right">
                                            <span className="font-medium text-foreground/90">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(p.amount)}</span>
                                            {editingPurchaseId === p._id ? (
                                                <div className="mt-1 flex items-center justify-end gap-1">
                                                    <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="text-xs border border-foreground/[0.12] rounded-lg px-1.5 py-0.5 bg-foreground/[0.04]" />
                                                    <button onClick={() => handleUpdateDate(p)} disabled={isUpdatingDate} className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-lg">{isUpdatingDate ? '...' : 'OK'}</button>
                                                    <button onClick={() => setEditingPurchaseId(null)} className="bg-foreground/[0.12] text-foreground/70 text-[10px] px-2 py-0.5 rounded-lg">X</button>
                                                </div>
                                            ) : (
                                                <span className={`text-xs block ${isAdmin ? 'text-blue-600 cursor-pointer hover:underline' : 'text-foreground/45'}`}
                                                    onClick={() => { if (isAdmin && p._id) { setEditingPurchaseId(p._id); setTempDate(new Date(p.date).toISOString().split('T')[0]); } }}>
                                                    {new Date(p.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                )) : (
                                    <li className="px-4 py-10 text-center text-sm text-foreground/45">No purchase history found.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'log' && (
                <div>
                    <div className="bg-foreground/[0.04] border border-foreground/[0.12] rounded-2xl p-5">
                        <h4 className="text-sm font-semibold text-foreground/85 mb-4">Add New Follow-up Note</h4>
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-2">Customer Feedback</label>
                            <div className="flex flex-wrap gap-2">
                                {feedbackOptions.map(option => (
                                    <button key={option} onClick={() => setFeedback(option)} className={`flex items-center gap-2 text-xs px-3 py-2 border rounded-xl transition-colors ${feedback === option ? 'ring-2 ring-offset-1 ring-blue-500 ' + feedbackColors[option] : 'bg-card border-foreground/[0.12] hover:bg-foreground/[0.04] text-foreground/70'}`}>
                                        {feedbackIcons[option]} {option}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {feedback === 'Call Back Later' && (
                            <div className="my-3 space-y-2">
                                <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1">Reminder Date & Time</label>
                                <input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className={inputCls + " sm:w-auto"} min={new Date().toISOString().slice(0, 16)}/>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {[['hours',1,'in 1 Hour'],['hours',2,'in 2 Hours'],['days',1,'Tomorrow'],['days',7,'Next Week']].map(([unit, amount, label]) => (
                                        <button key={String(label)} type="button" onClick={() => setReminderFor(unit as any, Number(amount))} className="text-xs px-3 py-1.5 bg-card border border-foreground/[0.12] text-foreground/70 rounded-lg hover:bg-foreground/[0.04]">{label}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1">Notes (Optional)</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Any additional details..."></textarea>
                        </div>
                        <div className="text-right mt-3">
                            <button onClick={handleSaveNote} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 text-sm font-semibold disabled:opacity-50 transition-colors" disabled={!feedback || isSavingNote}>
                                {isSavingNote ? 'Saving...' : (isReminderContext && feedback !== 'Call Back Later' ? 'Save & Complete Reminder' : 'Save Feedback')}
                            </button>
                        </div>
                    </div>
                    <div className="mt-6">
                        <h4 className="text-sm font-semibold text-foreground/85 mb-3">Interaction History</h4>
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {(customer.followUpNotes || []).length > 0 ? customer.followUpNotes?.map((note, index) => (
                                <div key={index} className={`border-l-4 p-4 rounded-r-xl ${feedbackColors[note.feedback]}`}>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="font-bold flex items-center gap-2">{feedbackIcons[note.feedback]} {note.feedback}</div>
                                        <div className="text-xs opacity-70">{new Date(note.date).toLocaleString()} by {note.agent}</div>
                                    </div>
                                    <p className="mt-1.5 text-sm">{note.notes}</p>
                                    {note.reminderDate && <p className="mt-1.5 text-xs font-semibold text-purple-700">Reminder: {new Date(note.reminderDate).toLocaleString()}</p>}
                                </div>
                            )) : <p className="text-center text-sm text-foreground/45 py-8">No follow-up notes recorded yet.</p>}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'order' && (
                <form onSubmit={handleCreateOrder} className="space-y-5">
                    {orderSuccess && <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm">{orderSuccess}</div>}
                    {orderError && <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{orderError}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Customer Name</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputCls} required/></div>
                        <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Phone</label><input type="text" value={customer.phone} className={inputCls + " opacity-60"} readOnly/></div>
                    </div>
                    <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Shipping Address</label><textarea rows={2} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className={inputCls} required></textarea></div>

                    <div className="bg-foreground/[0.04] border border-foreground/[0.12] rounded-2xl p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,auto] gap-3 items-end">
                            <div>
                                <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Product</label>
                                <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className={inputCls}>
                                    <option value="" disabled>Select a product</option>
                                    {products.map(p => (<option key={String(p.id)} value={String(p.id)}>{p.name} - {new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(p.price)}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Qty</label>
                                <input type="number" value={quantityToAdd} onChange={e => setQuantityToAdd(Math.max(1, parseInt(e.target.value, 10)))} min="1" className={inputCls + " w-20"} />
                            </div>
                            <button type="button" onClick={handleAddProduct} disabled={!selectedProductId} className="px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">Add</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {orderItems.length === 0 ? (
                            <p className="text-foreground/45 text-sm text-center py-4">No products added.</p>
                        ) : orderItems.map(item => (
                            <div key={String(item.id)} className="flex items-center justify-between text-sm bg-foreground/[0.04] border border-foreground/[0.08] rounded-xl px-4 py-3">
                                <div><p className="font-semibold text-foreground/90">{item.name}</p><p className="text-foreground/45 text-xs">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(item.price)}</p></div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity - 1)} className="p-1.5 rounded-lg bg-foreground/[0.12] hover:bg-foreground/[0.18] transition-colors"><MinusIcon /></button>
                                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), item.quantity + 1)} className="p-1.5 rounded-lg bg-foreground/[0.12] hover:bg-foreground/[0.18] transition-colors"><PlusIcon /></button>
                                    <button type="button" onClick={() => handleQuantityChange(String(item.id), 0)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {orderItems.length > 0 && (
                        <div className="border-t border-foreground/[0.08] pt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-foreground/70"><span>Subtotal</span><span className="font-semibold">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(subtotal)}</span></div>
                            <div className="flex justify-between items-center text-foreground/70">
                                <label>Discount (BDT)</label>
                                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-28 text-right bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500" placeholder="0" />
                            </div>
                            <div className="flex justify-between items-center text-foreground/70">
                                <label>Delivery Charge (BDT)</label>
                                <input type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="w-28 text-right bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-3 py-1.5 text-sm outline-none focus:border-blue-500" placeholder="0" />
                            </div>
                            <div className="flex justify-between text-base font-bold border-t border-foreground/[0.08] pt-2 mt-2 text-foreground/90"><span>Final Price</span><span className="text-blue-600">{new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(finalPrice)}</span></div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 text-sm" disabled={isCreatingOrder || orderItems.length === 0 || !customerName}>{isCreatingOrder ? 'Submitting...' : 'Submit Order for Review'}</button>
                    </div>
                </form>
            )}
            {activeTab === 'script' && (
                <div>
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <h4 className="text-sm font-semibold text-foreground/85">Recommended Sales Script</h4>
                        <button onClick={copyToClipboard} className="inline-flex items-center gap-2 bg-foreground/[0.08] text-foreground/70 px-3 py-1.5 rounded-xl hover:bg-foreground/[0.12] transition-colors text-xs font-semibold">
                            <ClipboardIcon className="h-3.5 w-3.5" /> Copy Script
                        </button>
                    </div>
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-2xl">
                        <p className="text-base text-foreground/90 leading-relaxed font-medium whitespace-pre-wrap font-serif">
                            {salesScriptTemplate}
                        </p>
                    </div>
                    <div className="mt-4 p-4 bg-foreground/[0.04] border border-foreground/[0.12] rounded-2xl">
                        <h5 className="text-xs font-bold text-foreground/60 uppercase tracking-widest mb-2">Pro Tips for {currentUser.name}:</h5>
                        <ul className="text-xs text-foreground/60 space-y-1 list-disc list-inside">
                            <li>Keep a smiling tone; it reflects in your voice.</li>
                            <li>Pause after asking how the product was.</li>
                            <li>If they say no, ask for feedback to improve.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 bg-foreground/[0.04] border-t border-foreground/[0.08] text-right rounded-b-2xl">
           <button onClick={onClose} className="bg-foreground/[0.12] text-foreground/85 px-5 py-2 rounded-xl hover:bg-foreground/[0.18] transition-colors text-sm font-semibold">Close</button>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfileModal;
