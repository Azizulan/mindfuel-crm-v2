
import React, { useState, useMemo, useEffect } from 'react';
import { Customer, FollowUpNote, Product, User } from '../types';
import CustomerTable from './CustomerTable';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PositiveIcon, NotInterestedIcon, CallBackIcon, NoAnswerIcon } from './icons/FeedbackIcons';
import { motion, AnimatePresence } from 'motion/react';

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

const CollapsibleSection: React.FC<{title: string, count: number, isOpen: boolean, setIsOpen: (v: boolean) => void, children: React.ReactNode, accent?: string}> = ({ title, count, isOpen, setIsOpen, children, accent = 'text-amber-600' }) => (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                    <ClockIcon className={`w-4 h-4 ${accent}`} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">{count} records</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-100 uppercase">{count}</span>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
        </button>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

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

    const [localRefinedStart, setLocalRefinedStart] = useState(userRefinedRange?.start?.toString() || outreachRange.start.toString());
    const [localRefinedEnd, setLocalRefinedEnd] = useState(userRefinedRange?.end?.toString() || outreachRange.end.toString());

    useEffect(() => {
        if (!userRefinedRange?.start) setLocalRefinedStart(outreachRange.start.toString());
        if (!userRefinedRange?.end) setLocalRefinedEnd(outreachRange.end.toString());
    }, [outreachRange, userRefinedRange?.start, userRefinedRange?.end]);

    const handleApplyRefinement = () => {
        onUserRefinedRangeChange?.({ start: parseInt(localRefinedStart), end: parseInt(localRefinedEnd) });
    };

    const handleResetRefinement = () => {
        setLocalRefinedStart(outreachRange.start.toString());
        setLocalRefinedEnd(outreachRange.end.toString());
        onUserRefinedRangeChange?.({});
    };

    const tabs = [
        { id: 'pending', name: 'To Call', icon: ClockIcon, count: segmentCounts.pending, color: 'text-amber-500' },
        { id: 'ordered', name: 'Ordered', icon: PositiveIcon, count: segmentCounts.ordered, color: 'text-emerald-500' },
        { id: 'callLater', name: 'Call Later', icon: CallBackIcon, count: segmentCounts.callLater, color: 'text-blue-500' },
        { id: 'noAnswer', name: 'No Answer', icon: NoAnswerIcon, count: segmentCounts.noAnswer, color: 'text-rose-500' },
        { id: 'notInterested', name: 'Not Interested', icon: NotInterestedIcon, count: segmentCounts.notInterested, color: 'text-gray-400' },
        { id: 'all', name: 'History', icon: CheckCircleIcon, count: segmentCounts.all, color: 'text-indigo-500' },
    ];

    const { hourlyReminders, dailyReminders } = useMemo(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const hourly: Customer[] = [];
        const daily: Customer[] = [];
        todaysReminders.forEach(customer => {
            const hasHourly = customer.followUpNotes?.some(note => {
                if (!note.reminderDate) return false;
                const d = new Date(note.reminderDate);
                return isToday(d) && d.getHours() === currentHour && note.reminderStatus !== 'completed';
            });
            if (hasHourly) hourly.push(customer);
            else daily.push(customer);
        });
        return { hourlyReminders: hourly, dailyReminders: daily };
    }, [todaysReminders]);

    const activeTitle = tabs.find(t => t.id === activeTab)?.name || '';
    const isExecutive = currentUser.role === 'Sales Executive';

    return (
        <div className="space-y-6 pb-12">

            {/* Search & Filter Bar */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-col lg:flex-row items-center gap-4">
                <div className="relative w-full lg:w-80">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all"
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                {isExecutive && (
                    <div className="flex flex-wrap items-center gap-3 lg:border-l lg:border-gray-200 lg:pl-4 w-full lg:w-auto">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Refine Window:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={localRefinedStart}
                                onChange={e => setLocalRefinedStart(e.target.value)}
                                className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                placeholder="Start"
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                                type="number"
                                value={localRefinedEnd}
                                onChange={e => setLocalRefinedEnd(e.target.value)}
                                className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                placeholder="End"
                            />
                            <button
                                onClick={handleApplyRefinement}
                                className="bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-all"
                            >Apply</button>
                            {(userRefinedRange?.start || userRefinedRange?.end) && (
                                <button
                                    onClick={handleResetRefinement}
                                    className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
                                >Reset</button>
                            )}
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="ml-auto flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                        <span className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest">Loading</span>
                    </div>
                )}
            </div>

            {/* Priority Sections */}
            {todaysReminders.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
            )}

            {/* Retention Segments */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">
                            {activeTab === 'all' ? 'Activity History' : 'Retention Pool'}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {activeTab === 'all'
                                ? 'All interactions in the last 10 days.'
                                : `Customers within the ${userRefinedRange?.end || outreachRange.end}–${userRefinedRange?.start || outreachRange.start} day window.`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{totalCount} records</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 pb-0">
                    <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all whitespace-nowrap border ${
                                    activeTab === tab.id
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-blue-600' : tab.color}`} />
                                <span>{tab.name}</span>
                                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                    activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                }`}>{tab.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6 pt-2">
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
