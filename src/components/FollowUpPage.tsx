
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

const CollapsibleSection: React.FC<{title: string, count: number, isOpen: boolean, setIsOpen: (v: boolean) => void, children: React.ReactNode}> = ({ title, count, isOpen, setIsOpen, children }) => (
    <div className="glass-surface overflow-hidden">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-foreground/[0.04] transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl glass-chip glass-chip-tint-amber flex items-center justify-center">
                    <ClockIcon className="w-4 h-4 text-foreground/80" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="text-[10px] text-foreground/45 font-semibold uppercase tracking-widest mt-0.5">{count} records</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="glass-chip glass-chip-tint-amber text-foreground/85 text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide">{count}</span>
                <ChevronDownIcon className={`h-4 w-4 text-foreground/45 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
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
                    <div className="px-5 pb-5 border-t border-foreground/[0.08] pt-4">
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
        { id: 'notInterested', name: 'Not Interested', icon: NotInterestedIcon, count: segmentCounts.notInterested, color: 'text-foreground/45' },
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

            {/* Search & Filter Bar — glass-surface so it picks up the gradient backdrop */}
            <div className="glass-surface p-4 flex flex-col lg:flex-row items-center gap-4">
                <div className="relative w-full lg:w-80">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-foreground/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name or phone…"
                        className="w-full pl-9 pr-4 py-2.5 glass-chip rounded-xl text-sm text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                {isExecutive && (
                    <div className="flex flex-wrap items-center gap-3 lg:border-l lg:border-foreground/[0.08] lg:pl-4 w-full lg:w-auto">
                        <span className="text-[10px] font-semibold text-foreground/45 uppercase tracking-widest whitespace-nowrap">Refine Window</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={localRefinedStart}
                                onChange={e => setLocalRefinedStart(e.target.value)}
                                className="w-16 glass-chip rounded-lg px-2 py-1.5 text-xs font-semibold text-center text-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                                placeholder="Start"
                            />
                            <span className="text-foreground/45 text-xs">to</span>
                            <input
                                type="number"
                                value={localRefinedEnd}
                                onChange={e => setLocalRefinedEnd(e.target.value)}
                                className="w-16 glass-chip rounded-lg px-2 py-1.5 text-xs font-semibold text-center text-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                                placeholder="End"
                            />
                            <button
                                onClick={handleApplyRefinement}
                                className="glass-cta-primary text-xs font-semibold px-4 py-1.5 rounded-lg transition-all"
                            >Apply</button>
                            {(userRefinedRange?.start || userRefinedRange?.end) && (
                                <button
                                    onClick={handleResetRefinement}
                                    className="text-xs font-semibold text-foreground/45 hover:text-foreground/85 transition-colors"
                                >Reset</button>
                            )}
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="ml-auto inline-flex items-center gap-2 glass-chip px-3 py-1.5 rounded-full">
                        <div className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-ping" />
                        <span className="text-[10px] text-foreground/70 font-semibold uppercase tracking-widest">Loading</span>
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

            {/* Retention Segments — full glass-surface, not opaque bg-card */}
            <div className="glass-surface overflow-hidden">
                <div className="px-6 py-5 border-b border-foreground/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            {activeTab === 'all' ? 'Activity History' : 'Retention Pool'}
                        </h3>
                        <p className="text-xs text-foreground/55 mt-1">
                            {activeTab === 'all'
                                ? 'All interactions in the last 10 days.'
                                : `Customers within the ${userRefinedRange?.end || outreachRange.end}–${userRefinedRange?.start || outreachRange.start} day window.`}
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 glass-chip px-3 py-1.5 rounded-full self-start">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-widest">{totalCount} records</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 pb-0">
                    <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'glass-chip-selected text-foreground'
                                        : 'text-foreground/55 hover:text-foreground/85 hover:bg-foreground/5'
                                }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-foreground' : 'text-foreground/45'}`} />
                                <span>{tab.name}</span>
                                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    activeTab === tab.id ? 'glass-chip text-foreground/85' : 'text-foreground/45'
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
