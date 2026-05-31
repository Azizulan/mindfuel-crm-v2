
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
        className={`px-5 py-3 text-${align} text-[10px] font-semibold text-foreground/45 uppercase tracking-widest cursor-pointer hover:text-foreground/70 transition-colors`}
        onClick={() => onSort?.(field)}
    >
        <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            {label}
            <ChevronUpDownIcon
                className="h-3 w-3 opacity-60"
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

// iOS Liquid Glass — value rating maps to a soft tinted glass capsule.
const ratingTint = (rating: Customer['valueRating']) => {
    if (rating === 'High')   return 'glass-chip glass-chip-tint-emerald text-foreground/85';
    if (rating === 'Medium') return 'glass-chip glass-chip-tint-amber text-foreground/85';
    return 'glass-chip glass-chip-tint-red text-foreground/85';
};

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

  const currentSortOrder = sortOrder || 'desc';
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* Dashboard mode — top search + rows control */}
      {displayMode === 'dashboard' && (
        <div className="glass-surface p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-72">
              <input
                  type="text"
                  placeholder="Search name or phone…"
                  className="w-full pl-4 pr-3 py-2.5 glass-chip rounded-xl text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                  onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-foreground/45 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                    <span>Rows</span>
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                        className="glass-chip rounded-lg px-2 py-1 text-foreground/85 outline-none focus:ring-2 focus:ring-foreground/20"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
                <span className="text-foreground/55">{totalCount.toLocaleString()} total</span>
            </div>
        </div>
      )}

      {/* Follow-up mode — segment data list header */}
      {displayMode === 'followup' && (
          <div className="flex justify-between items-center px-4 py-3 glass-pane rounded-t-2xl border-b border-foreground/[0.08]">
              <span className="text-[10px] font-bold text-foreground/55 uppercase tracking-widest">Segment Data List</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Per Page</span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                    className="glass-chip rounded-lg text-[11px] px-2 py-1 text-foreground/85 outline-none focus:ring-2 focus:ring-foreground/20"
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                </select>
            </div>
          </div>
      )}

      {/* The table itself, in a glass surface */}
      <div className={`${displayMode === 'followup' ? 'glass-surface rounded-t-none' : 'glass-surface'} overflow-hidden`}>
        <div className={`overflow-x-auto ${isLoading ? 'opacity-50 pointer-events-none transition-opacity' : ''}`}>
          <table className="min-w-full">
            <thead className="border-b border-foreground/[0.08]">
              <tr>
                <CustomSortHeader field="name" label="Customer" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                <CustomSortHeader field="lastPurchaseDate" label="Last Activity" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                {!hideInteractionColumn && <CustomSortHeader field="lastInteractionDate" label="Last Interaction" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />}
                <CustomSortHeader field="valueRating" label="Status" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                <CustomSortHeader field="totalSpending" label="Revenue" align="right" sortField={sortField} currentSortOrder={currentSortOrder} onSort={onSort} />
                <th className="px-5 py-3 text-center text-[10px] font-semibold text-foreground/45 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.05]">
              {customers.length > 0 ? customers.map((customer) => {
                const latestNote = customer.followUpNotes && customer.followUpNotes.length > 0
                  ? [...customer.followUpNotes].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                  : null;

                return (
                  <tr key={customer.id} className="hover:bg-foreground/[0.03] transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-foreground">{customer.name}</div>
                      <div className="text-[11px] text-foreground/40 font-mono mt-0.5">{customer.phone}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-foreground/60">
                      {customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : 'No history'}
                    </td>
                    {!hideInteractionColumn && (
                        <td className="px-5 py-4 max-w-xs">
                            {latestNote ? (
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">{new Date(latestNote.date).toLocaleDateString()}</span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full glass-chip glass-chip-tint-blue text-foreground/80">{latestNote.feedback}</span>
                                  {latestNote.reminderDate && latestNote.reminderStatus === 'pending' && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full glass-chip glass-chip-tint-violet text-foreground/85 animate-pulse">
                                          Due {new Date(latestNote.reminderDate).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                                      </span>
                                  )}
                                </div>
                                <p className="text-sm text-foreground/85 line-clamp-2 leading-snug italic">"{latestNote.notes}"</p>
                            </div>
                            ) : (
                            <span className="text-[11px] text-foreground/30 italic">No outreach logs yet.</span>
                            )}
                        </td>
                    )}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide ${ratingTint(customer.valueRating)}`}>
                          {customer.valueRating}
                        </span>
                        {customer.purchaseCount > 1 && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wide glass-chip glass-chip-tint-violet text-foreground/80">
                            Repeat ({customer.purchaseCount})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <span className="text-display text-lg text-foreground">৳{customer.totalSpending.toLocaleString('bn-BD')}</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <button onClick={() => handleOpenProfile(customer)} className="text-[11px] font-semibold uppercase tracking-wide glass-cta-primary px-3.5 py-1.5 rounded-lg transition-all">
                        Profile
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                    <td colSpan={hideInteractionColumn ? 5 : 6} className="px-5 py-16 text-center text-foreground/40 italic text-sm">
                        {isLoading ? 'Syncing…' : 'No results matching criteria.'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 border-t border-foreground/[0.08] flex items-center justify-between">
            <div className="text-[10px] text-foreground/55 font-semibold uppercase tracking-widest">
                Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
                <button
                    disabled={currentPage === 1 || isLoading}
                    onClick={() => onPageChange?.(currentPage - 1)}
                    className="p-2 glass-chip rounded-lg disabled:opacity-30 text-foreground/70 hover:text-foreground transition-colors"
                    aria-label="Previous page"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                    disabled={currentPage * pageSize >= totalCount || isLoading}
                    onClick={() => onPageChange?.(currentPage + 1)}
                    className="p-2 glass-chip rounded-lg disabled:opacity-30 text-foreground/70 hover:text-foreground transition-colors"
                    aria-label="Next page"
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
