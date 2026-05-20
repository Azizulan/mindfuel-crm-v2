
import React, { useState } from 'react';
import { Customer, FollowUpNote, Product, User } from '../types';
import CustomerProfileModal from './CustomerProfileModal';
import { ChevronUpDownIcon } from './icons/ChevronUpDownIcon';

interface CustomSortHeaderProps {
    field: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    sortField?: string;
    currentSortOrder: 'asc' | 'desc';
    onSort?: (field: string) => void;
}

const CustomSortHeader = ({ field, label, align = 'left', sortField, currentSortOrder, onSort }: CustomSortHeaderProps) => (
    <th 
        className={`px-6 py-3 text-${align} text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors`}
        onClick={() => onSort?.(field)}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            {label}
            <ChevronUpDownIcon 
                className="h-3 w-3" 
                direction={sortField === field ? (currentSortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} 
            />
        </div>
    </th>
);

interface CustomerTableProps {
  customers: Customer[];
  title: string;
  onAddFollowUpNote: (customerId: number | string, newNote: FollowUpNote) => Promise<void>;
  products: Product[];
  currentUser: User;
  displayMode?: 'dashboard' | 'followup';
  onMarkReminderDone?: (customerId: number | string, noteId: string) => Promise<void>;
  onUpdatePurchaseDate: (customerId: string | number, purchaseId: string, newDate: string) => Promise<void>;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  onSearchChange?: (term: string) => void;
  isLoading?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  hideInteractionColumn?: boolean;
}

const isToday = (someDate: Date) => {
    const today = new Date();
    const d = new Date(someDate);
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
}

const CustomerTable: React.FC<CustomerTableProps> = ({ 
    customers, 
    onAddFollowUpNote, 
    products, 
    currentUser, 
    displayMode = 'dashboard', 
    onMarkReminderDone,
    onUpdatePurchaseDate,
    totalCount = 0,
    onPageChange,
    currentPage = 1,
    onSearchChange,
    isLoading = false,
    pageSize = 10,
    onPageSizeChange,
    sortField,
    sortOrder,
    onSort,
    hideInteractionColumn = false
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [activeReminderId, setActiveReminderId] = useState<string | undefined>(undefined);
  
  const handleOpenProfile = (customer: Customer) => {
    const reminderNote = displayMode === 'followup'
      ? customer.followUpNotes?.find(note =>
          note.reminderDate && isToday(note.reminderDate) && note.reminderStatus !== 'completed'
        )
      : undefined;
    setActiveReminderId(reminderNote?._id);
    setSelectedCustomer(customer);
  };

  const ratingStyles = { High: 'bg-green-100 text-green-800', Medium: 'bg-yellow-100 text-yellow-800', Low: 'bg-red-100 text-red-800' };

  const currentSortOrder = sortOrder || 'desc';

  return (
    <div className="space-y-4">
      {displayMode === 'dashboard' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <div className="relative w-full sm:w-64">
            <input 
                type="text" 
                placeholder="Search name/phone..." 
                className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                onChange={(e) => onSearchChange?.(e.target.value)}
            />
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                    <span>Rows:</span>
                    <select 
                        value={pageSize}
                        onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none text-slate-700"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
                <span>{totalCount} Total Records</span>
            </div>
        </div>
      )}
      
      {displayMode === 'followup' && (
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-t-lg border-x border-t border-slate-200">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segment Data List</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Per Page:</span>
                <select 
                    value={pageSize}
                    onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded text-[10px] px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none text-slate-700"
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                </select>
            </div>
          </div>
      )}

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-slate-200">
        <div className={`overflow-x-auto ${isLoading ? 'opacity-50 pointer-events-none transition-opacity' : ''}`}>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <CustomSortHeader field="name" label="Customer" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                <CustomSortHeader field="lastPurchaseDate" label="Last Activity" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                {!hideInteractionColumn && <CustomSortHeader field="lastInteractionDate" label="Last Interaction" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />}
                <CustomSortHeader field="valueRating" label="Status" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                <CustomSortHeader field="totalSpending" label="Revenue" align="right" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {customers.length > 0 ? customers.map((customer) => {
                const latestNote = customer.followUpNotes && customer.followUpNotes.length > 0 
                  ? [...customer.followUpNotes].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                  : null;
                
                return (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{customer.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : 'No history'}
                    </td>
                    {!hideInteractionColumn && (
                        <td className="px-6 py-4 max-w-xs">
                            {latestNote ? (
                            <div>
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className="text-[9px] font-black uppercase text-slate-400">{new Date(latestNote.date).toLocaleDateString()}</span>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">{latestNote.feedback}</span>
                                {latestNote.reminderDate && latestNote.reminderStatus === 'pending' && (
                                    <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 animate-pulse">
                                        Due: {new Date(latestNote.reminderDate).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                    </span>
                                )}
                                </div>
                                <p className="text-sm text-slate-900 font-semibold line-clamp-2 leading-relaxed italic">"{latestNote.notes}"</p>
                            </div>
                            ) : (
                            <span className="text-[10px] text-slate-300 italic">No outreach logs yet.</span>
                            )}
                        </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase border ${ratingStyles[customer.valueRating]}`}>
                          {customer.valueRating}
                        </span>
                        {customer.purchaseCount > 1 && (
                          <span className="px-2 py-0.5 text-[9px] font-black rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                            Repeat ({customer.purchaseCount})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-700 text-right">
                      ৳{customer.totalSpending.toLocaleString('bn-BD')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button onClick={() => handleOpenProfile(customer)} className="text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase border border-blue-100 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
                        Profile
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                    <td colSpan={hideInteractionColumn ? 5 : 6} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                        {isLoading ? 'Syncing...' : 'No results matching criteria.'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                Page {currentPage} of {Math.ceil(totalCount / pageSize) || 1}
            </div>
            <div className="flex gap-2">
                <button 
                    disabled={currentPage === 1 || isLoading} 
                    onClick={() => onPageChange?.(currentPage - 1)}
                    className="p-2 border border-slate-300 rounded bg-white disabled:opacity-30 hover:bg-slate-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button 
                    disabled={currentPage * pageSize >= totalCount || isLoading} 
                    onClick={() => onPageChange?.(currentPage + 1)}
                    className="p-2 border border-slate-300 rounded bg-white disabled:opacity-30 hover:bg-slate-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
      </div>
      {selectedCustomer && <CustomerProfileModal 
        customer={selectedCustomer} 
        onClose={() => setSelectedCustomer(null)} 
        onAddFollowUpNote={onAddFollowUpNote}
        onMarkReminderDone={onMarkReminderDone}
        activeReminderId={activeReminderId}
        products={products} 
        currentUser={currentUser} 
        onUpdatePurchaseDate={onUpdatePurchaseDate}
      />}
    </div>
  );
};

export default CustomerTable;
