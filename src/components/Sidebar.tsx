import React, { useState, useEffect } from 'react';
import { View } from '../App';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  user: User;
  activeView: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLogout: () => void;
}

const NavItem: React.FC<{
  view: View;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: (v: View) => void;
}> = ({ view, label, icon, active, onClick }) => (
  <button
    onClick={() => onClick(view)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
      active
        ? 'glass-chip text-foreground shadow-sm'
        : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
    }`}
  >
    <span className={active ? 'text-foreground' : 'text-foreground/40'}>{icon}</span>
    <span>{label}</span>
  </button>
);

const Icon = ({ d }: { d: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ user, activeView, setView, isOpen, setIsOpen, onLogout }) => {
  const [ordersOpen, setOrdersOpen] = useState(false);
  const isAdmin = user.role === 'Administrator';
  const isOrdersActive = ['newOrder', 'trackOrder', 'orderStatus'].includes(activeView);

  useEffect(() => { if (isOrdersActive) setOrdersOpen(true); }, [activeView]);

  const go = (v: View) => { setView(v); setIsOpen(false); };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-30"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -260 : 0) }}
        className={`glass-pane border-r border-foreground/10 flex flex-col fixed inset-y-0 left-0 z-40 w-60 md:sticky md:top-0 md:h-screen md:flex-shrink-0 ${!isOpen && 'hidden md:flex'}`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-foreground/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center glass-chip">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <div>
              <p className="text-display text-lg leading-none text-foreground">MINDFUEL</p>
              <p className="text-[10px] text-foreground/40 mt-1 uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1 rounded-lg text-foreground/40 hover:bg-foreground/5">
            <Icon d="M6 18 18 6M6 6l12 12" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <NavItem view={isAdmin ? 'dashboard' : 'executiveDashboard'} label="Dashboard"
            icon={<Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
            active={activeView === 'dashboard' || activeView === 'executiveDashboard'} onClick={go}
          />
          <NavItem view="callQueue" label="Today's Queue"
            icon={<Icon d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />}
            active={activeView === 'callQueue'} onClick={go}
          />
          <NavItem view="followUp" label="Follow-ups"
            icon={<Icon d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />}
            active={activeView === 'followUp'} onClick={go}
          />
          <NavItem view="winBack" label="Win-Back Squad"
            icon={<Icon d="M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-9 9m4.5-1.206a8.959 8.959 0 0 1-4.5 1.207" />}
            active={activeView === 'winBack'} onClick={go}
          />

          {isAdmin && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">Analytics</p>
              </div>
              <NavItem view="teamActivity" label="Team Pulse"
                icon={<Icon d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />}
                active={activeView === 'teamActivity'} onClick={go}
              />
              <NavItem view="suppression" label="Suppressed"
                icon={<Icon d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />}
                active={activeView === 'suppression'} onClick={go}
              />
              <NavItem view="executivePerformance" label="Performance"
                icon={<Icon d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />}
                active={activeView === 'executivePerformance'} onClick={go}
              />
              <NavItem view="agentCoaching" label="Agent Coaching"
                icon={<Icon d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />}
                active={activeView === 'agentCoaching'} onClick={go}
              />

              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">Data</p>
              </div>
              <NavItem view="uploadData" label="Upload Data"
                icon={<Icon d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />}
                active={activeView === 'uploadData'} onClick={go}
              />
              <NavItem view="dataManagement" label="Data Management"
                icon={<Icon d="M20.25 6.375c0 8.284-7.163 15-16 15a15.84 15.84 0 0 1-1.883-.113M2.25 6.375c0 8.284 7.163 15 16 15 .657 0 1.305-.04 1.938-.115M15 6.375a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />}
                active={activeView === 'dataManagement'} onClick={go}
              />
              <NavItem view="auditLog" label="Audit Log"
                icon={<Icon d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />}
                active={activeView === 'auditLog'} onClick={go}
              />

              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">Catalog</p>
              </div>
              <NavItem view="products" label="Products"
                icon={<Icon d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />}
                active={activeView === 'products'} onClick={go}
              />

              {/* Orders dropdown */}
              <div>
                <button
                  onClick={() => setOrdersOpen(o => !o)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isOrdersActive ? 'glass-chip text-foreground shadow-sm' : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isOrdersActive ? 'text-foreground' : 'text-foreground/40'}>
                      <Icon d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </span>
                    <span>Orders</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${ordersOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <AnimatePresence>
                  {ordersOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-9 mt-0.5 space-y-0.5">
                      {[['newOrder', 'New Order'], ['orderStatus', 'Status'], ['trackOrder', 'Tracking']].map(([v, l]) => (
                        <button key={v} onClick={() => go(v as View)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeView === v ? 'text-foreground glass-chip' : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'}`}
                        >{l}</button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <NavItem view="userManagement" label="Users"
                icon={<Icon d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />}
                active={activeView === 'userManagement'} onClick={go}
              />
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-foreground/10 space-y-0.5">
          {isAdmin && (
            <NavItem view="settings" label="Settings"
              icon={<Icon d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />}
              active={activeView === 'settings'} onClick={go}
            />
          )}
          {/* User chip + logout */}
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 glass-chip">
              <span className="text-xs font-bold text-foreground">{user.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-foreground/40 truncate">{user.email}</p>
            </div>
            <button onClick={onLogout} title="Logout" className="p-1.5 rounded-lg text-foreground/40 hover:bg-foreground/5 hover:text-foreground transition-colors">
              <Icon d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
