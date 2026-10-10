
import React, { useState } from 'react';
import { Customer, User } from '../types';
import { updateCustomer, deleteCustomer, bulkDeleteCustomers, bulkUpdateCustomersDate, exportCustomers } from '../services/apiService';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronUpDownIcon } from './icons/ChevronUpDownIcon';
import { motion, AnimatePresence } from 'motion/react';

interface DataManagementPageProps {
    customers: Customer[];
    totalCount: number;
    currentPage: number;
    pageSize: number;
    isLoading: boolean;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    onSort: (field: string) => void;
    onPageChange: (page: number) => void;
    onSearchChange: (term: string) => void;
    onPageSizeChange: (size: number) => void;
    onRefresh: () => void;
    currentUser: User;
}

const validateCustomer = (c: Customer): string[] => {
    const issues: string[] = [];
    if (!c.name || c.name === 'Unknown') issues.push("Missing valid name");
    if (!c.phone || c.phone.length < 10) issues.push("Invalid phone");
    if (!c.lastPurchaseDate) {
        issues.push("Missing purchase date");
    } else {
        const d = new Date(c.lastPurchaseDate);
        if (d.getFullYear() < 2010) issues.push("Date <2010");
        if (d > new Date(Date.now() + 86400000)) issues.push("Future date");
    }
    if (!c.purchases || c.purchases.length === 0) issues.push("Zero purchases");
    const calcSpending = (c.purchases || []).reduce((s, p) => s + (p.amount || 0), 0);
    if (calcSpending - c.totalSpending > 1) issues.push(`Revenue mismatch`);
    if ((c.purchases?.length || 0) > c.purchaseCount) issues.push(`Count mismatch`);
    return issues;
};

const EditRecordModal: React.FC<{customer: Customer, onClose: () => void, onSave: (u: Partial<Customer>) => Promise<void>}> = ({ customer, onClose, onSave }) => {
    const [name, setName] = useState(customer.name);
    const [phone, setPhone] = useState(customer.phone);
    const [email, setEmail] = useState(customer.email || '');
    const [address, setAddress] = useState(customer.address || '');
    const [isSaving, setIsSaving] = useState(false);

    const inputClass = "w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-2.5 text-sm text-foreground/90 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try { await onSave({ name, phone, email, address }); onClose(); }
        catch (err) { alert("Failed: " + (err as Error).message); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-foreground/[0.12] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-foreground/[0.08] flex justify-between items-center">
                    <h3 className="font-bold text-foreground text-base">Edit Customer Record</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-foreground/[0.08] text-foreground/45 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Customer Name</label><input value={name} onChange={e => setName(e.target.value)} className={inputClass} required /></div>
                    <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} required /></div>
                    <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></div>
                    <div><label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} className={inputClass} rows={3} /></div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-foreground/[0.08] text-foreground/70 text-sm font-medium rounded-xl hover:bg-foreground/[0.12] transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
                            {isSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

const EXPORT_LISTS: { value: string, label: string, hint: string }[] = [
    { value: 'all',          label: 'Everyone',              hint: 'Full list with a "Campaign list" column to filter in Excel. Includes do-not-contact customers, marked.' },
    { value: 'winback',      label: 'Win-back',              hint: "At Risk + Can't Lose: used to buy often, gone quiet. Send an offer." },
    { value: 'reorder_due',  label: 'Reorder due',           hint: 'Their usual reorder gap is up now or within 7 days. Send a reminder.' },
    { value: 'second_order', label: 'Second order push',     hint: 'New + Potential Loyalist: 1–2 orders, recent. Push the next order with a bundle.' },
    { value: 'vip',          label: 'VIP / loyal',           hint: 'Champion + Loyal: reward, preview new products, ask for referrals.' },
    { value: 'revive',       label: 'Revive (low priority)', hint: 'Hibernating + Lost: long silent. Cheap broadcast only.' },
    { value: 'never',        label: 'Never ordered',         hint: 'In the CRM but no purchase yet. Intro offer.' },
];

const ExportModal: React.FC<{ adminEmail: string, onClose: () => void }> = ({ adminEmail, onClose }) => {
    const [list, setList] = useState('all');
    const [password, setPassword] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const inputClass = "w-full bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-4 py-2.5 text-sm text-foreground/90 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsExporting(true);
        try {
            const { blob, filename } = await exportCustomers(password, adminEmail, list);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            onClose();
        }
        catch (err) { alert("Export failed: " + (err as Error).message); }
        finally { setIsExporting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-foreground/[0.12] rounded-2xl shadow-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-foreground/[0.08] flex justify-between items-center">
                    <h3 className="font-bold text-foreground text-base">Export Customers (CSV)</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-foreground/[0.08] text-foreground/45 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Which customers</label>
                        <select value={list} onChange={e => setList(e.target.value)} className={inputClass}>
                            {EXPORT_LISTS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                        <p className="text-xs text-foreground/50 mt-1.5 leading-relaxed">{EXPORT_LISTS.find(l => l.value === list)?.hint}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-widest mb-1.5">Administrator Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" required />
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-4 py-3 rounded-xl leading-relaxed">
                        This file contains customer phone numbers and addresses. Keep it private and don't upload it anywhere public.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-foreground/[0.08] text-foreground/70 text-sm font-medium rounded-xl hover:bg-foreground/[0.12] transition-colors">Cancel</button>
                        <button type="submit" disabled={isExporting} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
                            {isExporting ? 'Preparing…' : 'Download CSV'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

const DataManagementPage: React.FC<DataManagementPageProps> = (props) => {
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [showExport, setShowExport] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkUpdateDate, setBulkUpdateDate] = useState('');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const handleUpdate = async (updates: Partial<Customer>) => {
        if (!editingCustomer) return;
        await updateCustomer(editingCustomer.id, updates);
        props.onRefresh();
    };

    const handleDelete = async (id: string | number) => {
        if (!window.confirm("Delete this customer permanently? This cannot be undone.")) return;
        try { await deleteCustomer(id); props.onRefresh(); }
        catch (err) { alert("Delete failed: " + (err as Error).message); }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === props.customers.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(props.customers.map(c => String(c.id))));
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.size} records permanently?`)) return;
        setIsBulkProcessing(true);
        try { await bulkDeleteCustomers(Array.from(selectedIds)); setSelectedIds(new Set()); props.onRefresh(); }
        catch (err) { alert(err); } finally { setIsBulkProcessing(false); }
    };

    const handleBulkUpdateDate = async () => {
        if (!bulkUpdateDate) return alert("Select a date first.");
        setIsBulkProcessing(true);
        try { await bulkUpdateCustomersDate(Array.from(selectedIds), bulkUpdateDate); setBulkUpdateDate(''); setSelectedIds(new Set()); props.onRefresh(); }
        catch (err) { alert(err); } finally { setIsBulkProcessing(false); }
    };

    const SortHeader = ({ field, label, align = 'left' }: { field: string, label: string, align?: 'left' | 'right' }) => (
        <th className={`px-5 py-3 text-xs font-semibold uppercase text-foreground/60 tracking-wider cursor-pointer hover:bg-foreground/[0.08] transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => props.onSort(field)}>
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                <ChevronUpDownIcon className="h-3 w-3" direction={props.sortField === field ? (props.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} />
            </div>
        </th>
    );

    return (
        <div className="space-y-5 pb-12">

            {/* Toolbar */}
            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative w-full sm:w-80">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-foreground/45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input type="text" placeholder="Search by phone or name…" onChange={e => props.onSearchChange(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl text-sm text-foreground/90 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all" />
                </div>
                <select value={props.pageSize} onChange={e => props.onPageSizeChange(Number(e.target.value))} className="bg-foreground/[0.04] border border-foreground/[0.12] rounded-xl px-3 py-2.5 text-sm text-foreground/85 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
                    <option value={10}>10 rows</option>
                    <option value={50}>50 rows</option>
                    <option value={100}>100 rows</option>
                </select>
                <div className="ml-auto text-xs font-semibold text-foreground/45 uppercase tracking-widest">{props.totalCount} records</div>
                {props.currentUser.role === 'Administrator' && (
                    <button onClick={() => setShowExport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        Export
                    </button>
                )}
            </div>

            {/* Bulk actions bar */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="bg-blue-600 px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row gap-4 items-center">
                        <span className="text-white text-xs font-bold uppercase tracking-widest">{selectedIds.size} selected</span>
                        <button disabled={isBulkProcessing} onClick={handleBulkDelete} className="flex items-center gap-2 text-white text-xs font-semibold hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all">
                            <TrashIcon className="w-3.5 h-3.5" /> Delete
                        </button>
                        <div className="flex items-center gap-2 sm:ml-auto">
                            <span className="text-white/80 text-xs">Set date:</span>
                            <input type="date" value={bulkUpdateDate} onChange={e => setBulkUpdateDate(e.target.value)} className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white text-xs outline-none" />
                            <button disabled={isBulkProcessing || !bulkUpdateDate} onClick={handleBulkUpdateDate} className="bg-card text-blue-700 px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-50 disabled:opacity-50 transition-all">
                                Apply
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Table */}
            <div className="bg-card border border-foreground/[0.12] rounded-2xl shadow-sm overflow-hidden">
                <div className={`overflow-x-auto transition-opacity ${props.isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-foreground/[0.04] border-b border-foreground/[0.08]">
                                <th className="px-5 py-3 w-10">
                                    <input type="checkbox" checked={props.customers.length > 0 && selectedIds.size === props.customers.length} onChange={toggleSelectAll} className="w-4 h-4 rounded text-blue-600 border-foreground/[0.15] focus:ring-blue-500 cursor-pointer" />
                                </th>
                                <SortHeader field="name" label="Customer" />
                                <SortHeader field="health" label="Integrity" />
                                <SortHeader field="totalSpending" label="Revenue" />
                                <SortHeader field="lastPurchaseDate" label="Last Purchase" />
                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-foreground/60 tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <AnimatePresence mode="wait">
                                {props.customers.length > 0 ? props.customers.map((c, idx) => {
                                    const issues = validateCustomer(c);
                                    const isHealthy = issues.length === 0;
                                    const isSelected = selectedIds.has(String(c.id));
                                    return (
                                        <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }} className={`transition-colors group ${isSelected ? 'bg-blue-50' : (!isHealthy ? 'bg-rose-50/50' : 'hover:bg-foreground/[0.04]')}`}>
                                            <td className="px-5 py-4">
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(String(c.id))} className="w-4 h-4 rounded text-blue-600 border-foreground/[0.15] focus:ring-blue-500 cursor-pointer" />
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-foreground/90">{c.name}</div>
                                                <div className="text-[10px] text-foreground/45 font-mono">{c.phone}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                {isHealthy ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-600 uppercase">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Verified
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {issues.map((msg, i) => (
                                                            <span key={i} className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">{msg}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-foreground/85">৳{c.totalSpending.toLocaleString()}</div>
                                                <div className="text-[10px] text-foreground/45">{c.purchaseCount} orders</div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-foreground/60">
                                                {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingCustomer(c)} className="p-2 bg-foreground/[0.04] text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-foreground/[0.12]" title="Edit">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id)} className="p-2 bg-foreground/[0.04] text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-foreground/[0.12]" title="Delete">
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-16 text-center text-foreground/45 italic text-sm">
                                            {props.isLoading ? 'Loading…' : 'No records in current view.'}
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 bg-foreground/[0.04] border-t border-foreground/[0.08] flex items-center justify-between">
                    <div className="text-xs text-foreground/45 font-semibold uppercase tracking-widest">
                        Page {props.currentPage} of {Math.ceil(props.totalCount / props.pageSize) || 1}
                    </div>
                    <div className="flex gap-2">
                        <button disabled={props.currentPage === 1 || props.isLoading} onClick={() => props.onPageChange(props.currentPage - 1)} className="px-4 py-1.5 text-xs font-medium text-foreground/60 bg-card border border-foreground/[0.12] rounded-xl hover:bg-foreground/[0.04] disabled:opacity-30 transition-all">Prev</button>
                        <button disabled={props.currentPage * props.pageSize >= props.totalCount || props.isLoading} onClick={() => props.onPageChange(props.currentPage + 1)} className="px-4 py-1.5 text-xs font-medium text-foreground/60 bg-card border border-foreground/[0.12] rounded-xl hover:bg-foreground/[0.04] disabled:opacity-30 transition-all">Next</button>
                    </div>
                </div>
            </div>

            {editingCustomer && (
                <EditRecordModal customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSave={handleUpdate} />
            )}

            {showExport && (
                <ExportModal adminEmail={props.currentUser.email} onClose={() => setShowExport(false)} />
            )}
        </div>
    );
};

export default DataManagementPage;
