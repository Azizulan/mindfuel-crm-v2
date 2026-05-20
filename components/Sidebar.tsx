
import React, { useState, useEffect } from 'react';
import { View } from '../App';
import { DashboardIcon } from './icons/DashboardIcon';
import { PackageIcon } from './icons/PackageIcon';
import { BoxIcon } from './icons/BoxIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { CogIcon } from './icons/CogIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { User } from '../types';
import { UsersIcon } from './icons/UsersIcon';
import { UploadIcon } from './icons/UploadIcon';
import { FileIcon } from './icons/FileIcon';
import { ClockIcon } from './icons/ClockIcon';
import { StarIcon } from './icons/StarIcon';

interface SidebarProps {
  user: User;
  activeView: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setView, isOpen, setIsOpen, onLogout }) => {
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  const isOrdersActive = activeView === 'newOrder' || activeView === 'trackOrder' || activeView === 'orderStatus';
  const isAdmin = user.role === 'Administrator';

  useEffect(() => {
    if (isOrdersActive) {
      setIsOrdersOpen(true);
    }
  }, [activeView, isOrdersActive]);

  const handleSetView = (view: View) => {
    setView(view);
    setIsOpen(false);
  }

  const commonButtonClass = "w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors";
  const activeButtonClass = "bg-slate-700 text-white";
  const inactiveButtonClass = "text-slate-300 hover:bg-slate-700 hover:text-white";

  const commonSubMenuButtonClass = "w-full flex items-center pl-11 pr-4 py-2 text-sm font-medium rounded-lg transition-colors";
  const activeSubMenuButtonClass = "text-white";
  const inactiveSubMenuButtonClass = "text-slate-400 hover:text-white";

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setIsOpen(false)}></div>}

      <aside className={`
        bg-slate-800 text-white flex flex-col p-4 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed inset-y-0 left-0 z-40 w-64
        md:sticky md:top-0 md:h-screen md:translate-x-0 md:flex-shrink-0
      `}>
        <div className="flex items-center justify-between px-2 mb-4">
            <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">CRM Assistant</h1>
              <p className="text-xs text-slate-400">{user.name} ({user.role})</p>
            </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="md:hidden p-2 rounded-full hover:bg-slate-700">
                <XMarkIcon/>
            </button>
        </div>

        <nav className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
            <div className="space-y-2">
                 <button
                    onClick={() => handleSetView(isAdmin ? 'dashboard' : 'executiveDashboard')}
                    className={`${commonButtonClass} ${(activeView === 'dashboard' || activeView === 'executiveDashboard') ? activeButtonClass : inactiveButtonClass}`}
                >
                    <DashboardIcon className="h-5 w-5" />
                    <span>Dashboard</span>
                </button>

                 <button
                    onClick={() => handleSetView('followUp')}
                    className={`${commonButtonClass} ${activeView === 'followUp' ? activeButtonClass : inactiveButtonClass}`}
                >
                    <CalendarIcon className="h-5 w-5" />
                    <span>Follow-ups</span>
                </button>

                {isAdmin && (
                  <>
                    <button
                        onClick={() => handleSetView('teamActivity')}
                        className={`${commonButtonClass} ${activeView === 'teamActivity' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <ClockIcon className="h-5 w-5" />
                        <span>Team Activity</span>
                    </button>

                    <button
                        onClick={() => handleSetView('executivePerformance')}
                        className={`${commonButtonClass} ${activeView === 'executivePerformance' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <StarIcon />
                        <span>Executive Perf.</span>
                    </button>

                     <button
                        onClick={() => handleSetView('uploadData')}
                        className={`${commonButtonClass} ${activeView === 'uploadData' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <UploadIcon className="h-5 w-5" />
                        <span>Upload Data</span>
                    </button>

                    <button
                        onClick={() => handleSetView('dataManagement')}
                        className={`${commonButtonClass} ${activeView === 'dataManagement' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <UsersIcon className="h-5 w-5" />
                        <span>Data Management</span>
                    </button>

                    <button
                        onClick={() => handleSetView('auditLog')}
                        className={`${commonButtonClass} ${activeView === 'auditLog' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <FileIcon />
                        <span>Audit Log</span>
                    </button>

                    <button
                        onClick={() => handleSetView('products')}
                        className={`${commonButtonClass} ${activeView === 'products' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <BoxIcon className="h-5 w-5" />
                        <span>Products</span>
                    </button>
                    
                    <div>
                        <button
                        onClick={() => setIsOrdersOpen(!isOrdersOpen)}
                        className={`${commonButtonClass} justify-between ${isOrdersActive ? activeButtonClass : inactiveButtonClass}`}
                        >
                        <div className="flex items-center space-x-3">
                            <PackageIcon className="h-5 w-5" />
                            <span>Orders</span>
                        </div>
                        <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOrdersOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOrdersOpen && (
                        <div className="mt-1 space-y-1">
                            <button
                                onClick={() => handleSetView('newOrder')}
                                className={`${commonSubMenuButtonClass} ${activeView === 'newOrder' ? activeSubMenuButtonClass : inactiveSubMenuButtonClass}`}
                            >
                                <span>New Order</span>
                            </button>
                            <button
                                onClick={() => handleSetView('orderStatus')}
                                className={`${commonSubMenuButtonClass} ${activeView === 'orderStatus' ? activeSubMenuButtonClass : inactiveSubMenuButtonClass}`}
                            >
                                <span>Order Status</span>
                            </button>
                            <button
                                onClick={() => handleSetView('trackOrder')}
                                className={`${commonSubMenuButtonClass} ${activeView === 'trackOrder' ? activeSubMenuButtonClass : inactiveSubMenuButtonClass}`}
                            >
                                <span>Track Order</span>
                            </button>
                        </div>
                        )}
                    </div>
                     <button
                        onClick={() => handleSetView('userManagement')}
                        className={`${commonButtonClass} ${activeView === 'userManagement' ? activeButtonClass : inactiveButtonClass}`}
                    >
                        <UsersIcon className="h-5 w-5" />
                        <span>User Management</span>
                    </button>
                  </>
                )}
            </div>
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-700 flex-shrink-0">
            {isAdmin && (
                  <button
                    onClick={() => handleSetView('settings')}
                    className={`${commonButtonClass} ${activeView === 'settings' ? activeButtonClass : inactiveButtonClass} mb-2`}
                >
                    <CogIcon className="h-5 w-5" />
                    <span>Settings</span>
                </button>
            )}
              <button
                onClick={onLogout}
                className={`${commonButtonClass} ${inactiveButtonClass}`}
            >
                <LogoutIcon className="h-5 w-5" />
                <span>Logout</span>
            </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;