import React, { useState, useRef, useEffect } from 'react';
import { Customer } from '../types';
import { BellIcon } from './icons/BellIcon';
import { PhoneIcon } from './icons/PhoneIcon';

interface NotificationBellProps {
    reminders: Customer[];
    onReminderClick: (customer: Customer) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ reminders, onReminderClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const reminderCount = reminders.length;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={notificationRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-full hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-800">
                <BellIcon />
                {reminderCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">{reminderCount}</span>
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 z-20">
                    <div className="p-3 border-b">
                        <h4 className="font-semibold text-sm text-slate-800">Today's Reminders</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {reminderCount > 0 ? (
                            <ul>
                                {reminders.map(customer => (
                                    <li key={customer.id}>
                                        <button 
                                            onClick={() => {
                                                onReminderClick(customer);
                                                setIsOpen(false);
                                            }}
                                            className="w-full text-left flex items-start space-x-3 p-3 hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="mt-1 text-blue-500"><PhoneIcon /></div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-700">{customer.name}</p>
                                                <p className="text-xs text-slate-500">{customer.phone}</p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-sm text-slate-500 p-6">No reminders for today.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
