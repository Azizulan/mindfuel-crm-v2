
import React from 'react';
import { MenuIcon } from './icons/MenuIcon';
import NotificationBell from './NotificationBell';
import { Customer } from '../types';

interface HeaderProps {
    title: string;
    onMenuClick: () => void;
    reminders: Customer[];
    onReminderClick: (customer: Customer) => void;
}

const Header: React.FC<HeaderProps> = ({ title, onMenuClick, reminders, onReminderClick }) => {
    const formatTitle = (view: string) => {
        const map: Record<string, string> = {
            dashboard: 'Admin Dashboard',
            executiveDashboard: 'Sales Performance',
            products: 'Product Inventory',
            newOrder: 'Create New Order',
            trackOrder: 'Track Shipment',
            orderStatus: 'Order Management',
            settings: 'System Settings',
            followUp: 'Follow-up Center',
            userManagement: 'User Access Control',
            uploadData: 'Batch Data Sync',
            auditLog: 'Interaction Audit Log',
            dataManagement: 'Database Auditor',
            loading: 'Loading...'
        };
        return map[view] || view.charAt(0).toUpperCase() + view.slice(1);
    };

    return (
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-50/80 backdrop-blur-sm py-3 -mx-4 px-4 md:-mx-8 md:px-8 z-10 border-b border-slate-200">
           <div className="flex items-center space-x-2">
            <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 rounded-md hover:bg-slate-200">
                <MenuIcon />
            </button>
            <h2 className="text-lg font-bold text-slate-700 ml-2 md:ml-0">
                {formatTitle(title)}
            </h2>
           </div>
          <div className="flex items-center space-x-4">
              <NotificationBell reminders={reminders} onReminderClick={onReminderClick} />
          </div>
        </div>
    );
}

export default Header;
