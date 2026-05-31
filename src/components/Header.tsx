import React from 'react';
import NotificationBell from './NotificationBell';
import { Customer } from '../types';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  reminders: Customer[];
  onReminderClick: (customer: Customer) => void;
}

const titles: Record<string, string> = {
  dashboard: 'Admin Overview',
  executiveDashboard: 'Performance Hub',
  products: 'Products',
  newOrder: 'New Order',
  trackOrder: 'Track Order',
  orderStatus: 'Order Status',
  settings: 'Settings',
  followUp: 'Follow-ups',
  userManagement: 'User Management',
  uploadData: 'Upload Data',
  auditLog: 'Audit Log',
  dataManagement: 'Data Management',
  teamActivity: 'Team Pulse',
  executivePerformance: 'Performance',
  agentCoaching: 'Agent Coaching',
  winBack: 'Win-Back Squad',
  loading: 'Loading...',
};

const Header: React.FC<HeaderProps> = ({ title, onMenuClick, reminders, onReminderClick }) => (
  <header className="flex items-center justify-between mb-6 sticky top-0 glass-pane py-4 -mx-6 px-6 md:-mx-8 md:px-8 z-20 border-b border-foreground/10">
    <div className="flex items-center gap-3">
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-xl glass-chip text-foreground/70 hover:text-foreground"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <div>
        <h2 className="text-display text-3xl text-foreground">{titles[title] || title}</h2>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-medium text-foreground/40 uppercase tracking-widest">Live</span>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <NotificationBell reminders={reminders} onReminderClick={onReminderClick} />
      <div className="h-6 w-px bg-foreground/10 mx-1 hidden sm:block" />
      <button className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center glass-chip">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      </button>
    </div>
  </header>
);

export default Header;
