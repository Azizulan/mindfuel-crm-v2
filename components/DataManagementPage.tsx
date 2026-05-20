
import React, { useState, useMemo } from 'react';
import { Customer, User } from '../types';
import { updateCustomer, deleteCustomer, bulkDeleteCustomers, bulkUpdateCustomersDate, clearDatabase } from '../services/apiService';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronUpDownIcon } from './icons/ChevronUpDownIcon';

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
    if (!c.phone || c.phone.length < 10) issues.push("Invalid phone format");
    
    if (!c.lastPurchaseDate) {
        issues.push("Missing purchase date");
    } else {
        const d = new Date(c.lastPurchaseDate);
        if (d.getFullYear() < 2010) issues.push("Potentially wrong date (<2010)");
        if (d > new Date(Date.now() + 86400000)) issues.push("Future date error");
        if (d.getTime() === 0) issues.push("System Default Date");
    }

    if (!c.purchases || c.purchases.length === 0) issues.push("Zero purchase records");
    
    const calculatedSpending = (c.purchases || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    if (Math.abs(calculatedSpending - c.totalSpending) > 1) {
        issues.push(`Revenue mismatch: DB has ৳${c.totalSpending}, sum has ৳${calculatedSpending}`);
    }
    
    if (c.purchaseCount !== (c.purchases?.length || 0)) {
        issues.push(`Order count mismatch: DB has ${c.purchaseCount}, history has ${c.purchases?.length || 0}`);
    }
    return issues;
};

const EditRecordModal: React.FC<{customer: Customer, onClose: () => void, onSave: (updates: Partial<Customer>) => Promise<void>}> = ({ customer, onClose, onSave }) => {
    const [name, setName] = useState(customer.name);
    const [phone, setPhone] = useState(customer.phone);
    const [email, setEmail] = useState(customer.email || '');
    const [address, setAddress] = useState(customer.address || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({ name, phone, email, address });
            onClose();
        } catch (err) {
            alert("Failed to update: " + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Edit Record Identity</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XMarkIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile / Phone</label>
                        <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" required />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</label>
                        <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-bold" rows={3} />
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {isSaving ? 'Updating...' : 'Apply Fix'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DataManagementPage: React.FC<DataManagementPageProps> = (props) => {
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkUpdateDate, setBulkUpdateDate] = useState('');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const handleUpdate = async (updates: Partial<Customer>) => {
        if (!editingCustomer) return;
        await updateCustomer(editingCustomer.id, updates);
        props.onRefresh();
    };

    const handleDelete = async (id: string | number) => {
        if (!window.confirm("CRITICAL: Are you sure you want to permanently delete this customer record? This cannot be undone.")) return;
        try {
            await deleteCustomer(id);
            props.onRefresh();
        } catch (err) {
            alert("Delete failed: " + (err as Error).message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === props.customers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(props.customers.map(c => String(c.id))));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedIds.size} records permanently?`)) return;
        setIsBulkProcessing(true);
        try {
            await bulkDeleteCustomers(Array.from(selectedIds));
            setSelectedIds(new Set());
            props.onRefresh();
        } catch (err) { alert(err); }
        finally { setIsBulkProcessing(false); }
    };

    const handleBulkUpdateDate = async () => {
        if (!bulkUpdateDate) return alert("Select a date first.");
        setIsBulkProcessing(true);
        try {
            await bulkUpdateCustomersDate(Array.from(selectedIds), bulkUpdateDate);
            setBulkUpdateDate('');
            setSelectedIds(new Set());
            props.onRefresh();
        } catch (err) { alert(err); }
        finally { setIsBulkProcessing(false); }
    };

    const SortHeader = ({ field, label, align = 'left' }: { field: string, label: string, align?: 'left' | 'right' }) => (
        <th 
            className={`px-6 py-4 text-${align} text-[10px] font-black uppercase text-slate-400 tracking-widest cursor-pointer hover:bg-slate-100 transition-colors`}
            onClick={() => props.onSort(field)}
        >
            <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
                {label}
                <ChevronUpDownIcon 
                    className="h-3 w-3" 
                    direction={props.sortField === field ? (props.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} 
                />
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-6 w-full">
                    <div className="flex-1">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Database Auditor</h3>
                        <p className="text-xs text-slate-400 font-medium">Verify data integrity and resolve system anomalies.</p>
                    </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="Scan by Phone/Name..." 
                        onChange={e => props.onSearchChange(e.target.value)}
                        className="flex-1 md:w-64 px-4 py-2 border rounded-lg text-sm bg-slate-50" 
                    />
                    <select 
                        value={props.pageSize}
                        onChange={e => props.onPageSizeChange(Number(e.target.value))}
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                        <option value={10}>10 rows</option>
                        <option value={50}>50 rows</option>
                        <option value={100}>100 rows</option>
                    </select>
                </div>
            </div>

            {selectedIds.size > 0 && (
                <div className="bg-slate-900 p-4 rounded-xl shadow-lg flex flex-col md:flex-row gap-4 justify-between items-center animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-4">
                        <span className="text-white text-xs font-black uppercase bg-white/10 px-3 py-1 rounded-full">
                            {selectedIds.size} Marked
                        </span>
                        <div className="h-6 w-px bg-white/20 hidden md:block"></div>
                        <button 
                            disabled={isBulkProcessing}
                            onClick={handleBulkDelete}
                            className="text-rose-400 text-[10px] font-black uppercase tracking-widest hover:text-rose-300 flex items-center gap-2"
                        >
                            <TrashIcon /> Bulk Purge
                        </button>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className="text-white/60 text-[10px] font-black uppercase whitespace-nowrap">Correct Date:</span>
                        <input 
                            type="date" 
                            value={bulkUpdateDate}
                            onChange={e => setBulkUpdateDate(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs outline-none focus:border-blue-500"
                        />
                        <button 
                            disabled={isBulkProcessing || !bulkUpdateDate}
                            onClick={handleBulkUpdateDate}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50"
                        >
                            Update Selected
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className={`overflow-x-auto ${props.isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="px-6 py-4 text-left w-12">
                                    <input 
                                        type="checkbox" 
                                        checked={props.customers.length > 0 && selectedIds.size === props.customers.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                    />
                                </th>
                                <SortHeader field="name" label="Identifier" />
                                <SortHeader field="health" label="Health & Issues" />
                                <SortHeader field="totalSpending" label="Stored Stats" />
                                <SortHeader field="lastPurchaseDate" label="Last Activity" />
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {props.customers.length > 0 ? props.customers.map(c => {
                                const issues = validateCustomer(c);
                                const isHealthy = issues.length === 0;
                                const isSelected = selectedIds.has(String(c.id));
                                return (
                                    <tr key={c.id} className={`transition-colors ${isSelected ? 'bg-blue-50' : (!isHealthy ? 'bg-red-50/30' : 'hover:bg-slate-50/50')}`}>
                                        <td className="px-6 py-4">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => toggleSelect(String(c.id))}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-black text-slate-800">{c.name}</p>
                                            <p className="text-[11px] font-mono text-slate-400">{c.phone}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isHealthy ? (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Verified Good
                                                </span>
                                            ) : (
                                                <div className="space-y-1">
                                                    {issues.map((msg, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 text-[9px] font-black text-rose-600 uppercase tracking-tighter bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                                            <span className="w-1 h-1 rounded-full bg-rose-500"></span> {msg}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-[10px] font-bold text-slate-600">Spent: ৳{c.totalSpending.toLocaleString()}</p>
                                            <p className="text-[10px] font-bold text-slate-600">Orders: {c.purchaseCount}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-xs font-bold text-slate-700">
                                                {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : 'NO DATE'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase font-black">Purchase Date</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setEditingCustomer(c)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                    title="Fix Data"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(c.id)}
                                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                    title="Purge Record"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic text-sm">No customers in view.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        Database Audit Trail &middot; {props.totalCount} records total
                    </div>
                    <div className="flex gap-2">
                        <button 
                            disabled={props.currentPage === 1 || props.isLoading} 
                            onClick={() => props.onPageChange(props.currentPage - 1)}
                            className="px-3 py-1 text-xs font-black uppercase text-slate-600 bg-white border rounded-lg hover:bg-slate-50 disabled:opacity-30"
                        >Prev</button>
                        <button 
                            disabled={props.currentPage * props.pageSize >= props.totalCount || props.isLoading} 
                            onClick={() => props.onPageChange(props.currentPage + 1)}
                            className="px-3 py-1 text-xs font-black uppercase text-slate-600 bg-white border rounded-lg hover:bg-slate-50 disabled:opacity-30"
                        >Next</button>
                    </div>
                </div>
            </div>

            {editingCustomer && (
                <EditRecordModal 
                    customer={editingCustomer} 
                    onClose={() => setEditingCustomer(null)} 
                    onSave={handleUpdate} 
                />
            )}
        </div>
    );
};

export default DataManagementPage;
