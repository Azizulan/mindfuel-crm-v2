
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, FollowUpNote, Product, User } from '../types';
import CustomerTable from './CustomerTable';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PositiveIcon, NotInterestedIcon, CallBackIcon, NoAnswerIcon } from './icons/FeedbackIcons';

interface FollowUpPageProps {
    todaysReminders: Customer[];
    customers: Customer[];
    segmentCounts: {
        pending: number;
        ordered: number;
        callLater: number;
        noAnswer: number;
        notInterested: number;
        all: number;
    };
    activeTab: string;
    outreachRange: { start: number, end: number };
    userRefinedRange?: { start?: number, end?: number };
    onUserRefinedRangeChange?: (range: { start?: number, end?: number }) => void;
    onTabChange: (tab: string) => void;
    onAddFollowUpNote: (customerId: number | string, newNote: FollowUpNote) => Promise<void>;
    onMarkReminderDone: (customerId: number | string, noteId: string) => Promise<void>;
    products: Product[];
    currentUser: User;
    onUpdatePurchaseDate: (customerId: string | number, purchaseId: string, newDate: string) => Promise<void>;
    onSearchChange: (term: string) => void;
    isLoading?: boolean;
    totalCount: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    onSort: (field: string) => void;
}

const isToday = (someDate: Date) => {
    const today = new Date();
    const d = new Date(someDate);
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
}

const CollapsibleSection: React.FC<{title: string, count: number, isOpen: boolean, setIsOpen: (isOpen: boolean) => void, children: React.ReactNode}> = ({ title, count, isOpen, setIsOpen, children }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">{count}</span>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="mt-6">
                    {children}
                </div>
            )}
        </div>
    );
};


const FollowUpPage: React.FC<FollowUpPageProps> = ({ 
    todaysReminders, 
    customers,
    segmentCounts, 
    activeTab,
    outreachRange,
    userRefinedRange,
    onUserRefinedRangeChange,
    onTabChange,
    onAddFollowUpNote, 
    onMarkReminderDone, 
    products, 
    currentUser,
    onUpdatePurchaseDate,
    onSearchChange,
    isLoading = false,
    totalCount,
    currentPage,
    onPageChange,
    pageSize,
    onPageSizeChange,
    sortField,
    sortOrder,
    onSort,
}) => {
    const [isHourlyOpen, setIsHourlyOpen] = useState(false);
    const [isDailyOpen, setIsDailyOpen] = useState(false);
    
    // Internal state for refined range inputs
    const [localRefinedStart, setLocalRefinedStart] = useState(userRefinedRange?.start?.toString() || outreachRange.start.toString());
    const [localRefinedEnd, setLocalRefinedEnd] = useState(userRefinedRange?.end?.toString() || outreachRange.end.toString());

    useEffect(() => {
        if (!userRefinedRange?.start) setLocalRefinedStart(outreachRange.start.toString());
        if (!userRefinedRange?.end) setLocalRefinedEnd(outreachRange.end.toString());
    }, [outreachRange]);

    const handleApplyRefinement = () => {
        onUserRefinedRangeChange?.({
            start: parseInt(localRefinedStart),
            end: parseInt(localRefinedEnd)
        });
    };

    const handleResetRefinement = () => {
        setLocalRefinedStart(outreachRange.start.toString());
        setLocalRefinedEnd(outreachRange.end.toString());
        onUserRefinedRangeChange?.({});
    };

    const tabs = [
        { id: 'pending', name: 'To Call', icon: <ClockIcon />, count: segmentCounts.pending, title: "Pending Follow-ups" },
        { id: 'ordered', name: 'Ordered', icon: <PositiveIcon />, count: segmentCounts.ordered, title: "Interested / Ordered" },
        { id: 'callLater', name: 'Call Later', icon: <CallBackIcon />, count: segmentCounts.callLater, title: "Rescheduled Calls" },
        { id: 'noAnswer', name: 'No Answer', icon: <NoAnswerIcon />, count: segmentCounts.noAnswer, title: "Call Not Received" },
        { id: 'notInterested', name: 'Not Interested', icon: <NotInterestedIcon />, count: segmentCounts.notInterested, title: "Not Interested" },
        { id: 'all', name: 'Recent History', icon: <CheckCircleIcon />, count: segmentCounts.all, title: "Interactions in Last 10 Days" },
    ];

    const { hourlyReminders, dailyReminders } = useMemo(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const hourly: Customer[] = [];
        const daily: Customer[] = [];

        todaysReminders.forEach(customer => {
            const hasHourlyReminder = customer.followUpNotes?.some(note => {
                if (!note.reminderDate) return false;
                const reminderDate = new Date(note.reminderDate);
                return isToday(reminderDate) && reminderDate.getHours() === currentHour && note.reminderStatus !== 'completed';
            });
            if (hasHourlyReminder) hourly.push(customer);
            else daily.push(customer);
        });
        return { hourlyReminders: hourly, dailyReminders: daily };
    }, [todaysReminders]);

    const activeTitle = tabs.find(tab => tab.id === activeTab)?.title || '';
    const isExecutive = currentUser.role === 'Sales Executive';

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-full md:w-80">
                    <input 
                        type="text" 
                        placeholder="Search list by mobile..." 
                        className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>

                {isExecutive && (
                    <div className="flex flex-wrap items-center gap-3 border-l-0 md:border-l border-slate-200 md:pl-6 w-full md:w-auto">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Refine My List Window:</span>
                        <div className="flex items-center gap-2">
                             <input 
                                type="number" 
                                value={localRefinedStart}
                                onChange={e => setLocalRefinedStart(e.target.value)}
                                className="w-16 border rounded px-2 py-1 text-xs font-bold text-center"
                                placeholder="Start"
                            />
                            <span className="text-slate-300">to</span>
                            <input 
                                type="number" 
                                value={localRefinedEnd}
                                onChange={e => setLocalRefinedEnd(e.target.value)}
                                className="w-16 border rounded px-2 py-1 text-xs font-bold text-center"
                                placeholder="End"
                            />
                            <button 
                                onClick={handleApplyRefinement}
                                className="bg-slate-800 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded hover:bg-slate-900 transition-colors"
                            >Filter</button>
                            {(userRefinedRange?.start || userRefinedRange?.end) && (
                                <button 
                                    onClick={handleResetRefinement}
                                    className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                                >Reset</button>
                            )}
                        </div>
                    </div>
                )}
                {isLoading && <span className="text-xs text-blue-500 font-bold animate-pulse ml-auto">Processing...</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CollapsibleSection title="Priority This Hour" count={hourlyReminders.length} isOpen={isHourlyOpen} setIsOpen={setIsHourlyOpen}>
                    <CustomerTable 
                        customers={hourlyReminders} 
                        title="Reminders for this hour"
                        onAddFollowUpNote={onAddFollowUpNote}
                        onMarkReminderDone={onMarkReminderDone}
                        products={products} 
                        currentUser={currentUser}
                        displayMode="followup"
                        onUpdatePurchaseDate={onUpdatePurchaseDate}
                        isLoading={isLoading}
                        hideInteractionColumn={true}
                    />
                </CollapsibleSection>

                <CollapsibleSection title="Other Reminders Today" count={dailyReminders.length} isOpen={isDailyOpen} setIsOpen={setIsDailyOpen}>
                    <CustomerTable 
                        customers={dailyReminders} 
                        title="Today's Other Reminders"
                        onAddFollowUpNote={onAddFollowUpNote}
                        onMarkReminderDone={onMarkReminderDone}
                        products={products} 
                        currentUser={currentUser}
                        displayMode="followup"
                        onUpdatePurchaseDate={onUpdatePurchaseDate}
                        isLoading={isLoading}
                        hideInteractionColumn={true}
                    />
                </CollapsibleSection>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
                 <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {activeTab === 'all' ? 'Activity History' : `Retention Segments (${userRefinedRange?.end || outreachRange.end}-${userRefinedRange?.start || outreachRange.start} Days)`}
                        </h3>
                        <p className="text-sm text-slate-500">
                            {activeTab === 'all' 
                                ? 'Showing all customers contacted in the last 10 days.' 
                                : 'Categorized pool of customers matching the configured retention window.'}
                        </p>
                    </div>
                 </div>
                <div className="border-b border-slate-200">
                  <nav className="-mb-px flex space-x-4 overflow-x-auto pb-1" aria-label="Tabs">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        } flex items-center whitespace-nowrap py-4 px-2 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                      >
                        <span className="mr-2">{tab.icon}</span>
                        <span>{tab.name}</span>
                        <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>
                
                <div className="mt-8">
                  <CustomerTable 
                    customers={customers} 
                    title={activeTitle}
                    onAddFollowUpNote={onAddFollowUpNote}
                    onMarkReminderDone={onMarkReminderDone}
                    products={products}
                    currentUser={currentUser}
                    onUpdatePurchaseDate={onUpdatePurchaseDate}
                    displayMode="followup"
                    totalCount={totalCount}
                    currentPage={currentPage}
                    onPageChange={onPageChange}
                    isLoading={isLoading}
                    pageSize={pageSize}
                    onPageSizeChange={onPageSizeChange}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    hideInteractionColumn={activeTab === 'pending'}
                  />
                </div>
            </div>
        </div>
    );
};

export default FollowUpPage;
