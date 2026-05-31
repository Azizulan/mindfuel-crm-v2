'use client';
import React, { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { Customer, Product, FollowUpNote, User, DashboardStats, AuditLogEntry } from './types';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import Header from './components/Header';
import GlassBackground from './components/ui/GlassBackground';
import * as api from './services/apiService';

// Lazy-loaded page components — each becomes its own chunk
const CustomerDashboard      = lazy(() => import('./components/CustomerDashboard'));
const ProductsPage           = lazy(() => import('./components/ProductsPage'));
const NewOrderPage           = lazy(() => import('./components/NewOrderPage'));
const TrackOrderPage         = lazy(() => import('./components/TrackOrderPage'));
const SettingsPage           = lazy(() => import('./components/SettingsPage'));
const OrderStatusPage        = lazy(() => import('./components/OrderStatusPage'));
const FollowUpPage           = lazy(() => import('./components/FollowUpPage'));
const UserManagementPage     = lazy(() => import('./components/UserManagementPage'));
const DataUploadPage         = lazy(() => import('./components/DataUploadPage'));
const SalesExecutiveDashboard= lazy(() => import('./components/SalesExecutiveDashboard'));
const AdminDashboard         = lazy(() => import('./components/AdminDashboard'));
const AuditLogPage           = lazy(() => import('./components/AuditLogPage'));
const DataManagementPage     = lazy(() => import('./components/DataManagementPage'));
const TeamActivityPage       = lazy(() => import('./components/TeamActivityPage'));
const ExecutivePerformancePage= lazy(() => import('./components/ExecutivePerformancePage'));
const CallQueuePage          = lazy(() => import('./components/CallQueuePage'));
const SuppressionPage        = lazy(() => import('./components/SuppressionPage'));
const AgentCoachingPage      = lazy(() => import('./components/AgentCoachingPage'));
const WinBackPage            = lazy(() => import('./components/WinBackPage'));

const PageSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full" />
  </div>
);

export type View = 'dashboard' | 'executiveDashboard' | 'callQueue' | 'winBack' | 'suppression' | 'products' | 'newOrder' | 'trackOrder' | 'orderStatus' | 'settings' | 'followUp' | 'userManagement' | 'uploadData' | 'auditLog' | 'dataManagement' | 'teamActivity' | 'executivePerformance' | 'agentCoaching' | 'loading';

const isToday = (someDate: Date) => {
    const today = new Date();
    const d = new Date(someDate);
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [followUpCustomers, setFollowUpCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [outreachTarget, setOutreachTarget] = useState(100);
  const [outreachRange, setOutreachRange] = useState({ start: 32, end: 28 });
  
  // User-specific portion filtering
  const [userRefinedRange, setUserRefinedRange] = useState<{start?: number, end?: number}>({});

  const [sortField, setSortField] = useState('lastInteractionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [totalCustomers, setTotalCustomers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [totalFollowUp, setTotalFollowUp] = useState(0);
  const [followUpPage, setFollowUpPage] = useState(1);
  const [followUpPageSize, setFollowUpPageSize] = useState(10);
  const [followUpSearch, setFollowUpSearch] = useState('');
  const [followUpTab, setFollowUpTab] = useState('pending');
  const [followUpCounts, setFollowUpCounts] = useState({ pending: 0, ordered: 0, callLater: 0, noAnswer: 0, notInterested: 0, all: 0 });

  const [auditLogData, setAuditLogData] = useState<AuditLogEntry[]>([]);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogSearch, setAuditLogSearch] = useState('');

  // Filtering team activity by date
  const [teamActivityDate, setTeamActivityDate] = useState(new Date().toISOString().split('T')[0]);

  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<View>('loading');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Separate effect specifically for User Management to ensure it always fetches
  useEffect(() => {
    if (currentUser && currentUser.role === 'Administrator' && activeView === 'userManagement') {
        const fetchUsers = async () => {
            try {
                const fetchedUsers = await api.getUsers();
                setUsers(fetchedUsers);
            } catch (err: any) {
                console.error("User fetch failed:", err);
            }
        };
        fetchUsers();
    }
  }, [currentUser, activeView]);


  // Debounced fetch logic for Main Directory and Data Management
  useEffect(() => {
    const timer = setTimeout(() => {
        if (currentUser && (activeView === 'dashboard' || activeView === 'executiveDashboard' || activeView === 'dataManagement' || activeView === 'teamActivity' || activeView === 'loading' || activeView === 'newOrder' || activeView === 'followUp')) {
            fetchData();
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, currentPage, pageSize, sortField, sortOrder, activeView, currentUser, teamActivityDate]);

  // Debounced fetch for Follow-up
  useEffect(() => {
    const timer = setTimeout(() => {
        if (currentUser && activeView === 'followUp') {
            fetchFollowUpData();
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [followUpSearch, followUpPage, followUpPageSize, followUpTab, sortField, sortOrder, activeView, currentUser, userRefinedRange]);

  // Debounced fetch for Audit Log
  useEffect(() => {
    const timer = setTimeout(() => {
        if (currentUser && activeView === 'auditLog') {
            fetchAuditLog();
        }
    }, 400);
    return () => clearTimeout(timer);
  }, [auditLogSearch, auditLogPage, activeView, currentUser]);

  const fetchData = useCallback(async () => {
      if (!currentUser) return;
      setIsLoading(true);
      setError(null);
      try {
          const customerRes = await api.getCustomers(searchTerm, currentPage, pageSize, sortField, sortOrder);
          setCustomers(customerRes.data);
          setTotalCustomers(customerRes.total);

          try {
              const [globalStats, targetRes, rangeRes, prodRes] = await Promise.all([
                  api.getStats(currentUser.name, teamActivityDate),
                  api.getOutreachTarget(),
                  api.getOutreachRange(),
                  api.getProducts()
              ]);
              setStats(globalStats);
              setOutreachTarget(targetRes.value);
              setOutreachRange(rangeRes);
              setProducts(prodRes);
          } catch (auxErr) {
              console.warn("Auxiliary data fetch failed:", auxErr);
          }
          
          if (activeView === 'loading') {
            setActiveView(currentUser.role === 'Administrator' ? 'dashboard' : 'callQueue');
          }
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  }, [currentUser, searchTerm, currentPage, pageSize, sortField, sortOrder, activeView, teamActivityDate]);

  const fetchFollowUpData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
        const res = await api.getFollowUpCustomers(
            followUpSearch, 
            followUpPage, 
            followUpPageSize, 
            followUpTab, 
            sortField, 
            sortOrder,
            userRefinedRange.start,
            userRefinedRange.end
        );
        setFollowUpCustomers(res.data);
        setTotalFollowUp(res.total);
        setFollowUpCounts(res.counts);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, followUpSearch, followUpPage, followUpPageSize, followUpTab, sortField, sortOrder, userRefinedRange]);

  const fetchAuditLog = useCallback(async () => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
          const res = await api.getAuditLog(auditLogSearch, auditLogPage, 20);
          setAuditLogData(res.data);
          setAuditLogTotal(res.total);
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  }, [currentUser, auditLogSearch, auditLogPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortOrder('desc');
    }
    setCurrentPage(1);
    setFollowUpPage(1);
  };

  const addFollowUpNote = async (customerId: number | string, newNote: FollowUpNote): Promise<void> => {
    try {
        await api.addFollowUpNote(customerId, newNote);
        fetchData();
        if (activeView === 'followUp') fetchFollowUpData();
    } catch(err: any) {
        setError(err.message);
    }
  };

  const updatePurchaseDate = async (customerId: string | number, purchaseId: string, newDate: string): Promise<void> => {
    try {
        await api.updatePurchaseDate(customerId, purchaseId, newDate);
        if (activeView === 'followUp') fetchFollowUpData();
        else fetchData();
    } catch (err: any) {
        setError(err.message);
    }
  };

  const handleMarkReminderDone = async (customerId: number | string, noteId: string): Promise<void> => {
    try {
        await api.markReminderAsDone(customerId, noteId);
        if (activeView === 'followUp') fetchFollowUpData();
        else fetchData();
    } catch (err: any) {
        setError(err.message);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const user = await api.login(email, password);
      setCurrentUser(user);
      setActiveView(user.role === 'Administrator' ? 'dashboard' : 'callQueue');
      return 'success';
    } catch (err: any) { return err.message; }
  };

  const handleRegister = async (name: string, email: string, password: string) => {
    try {
      await api.register(name, email, password);
      return 'success';
    } catch (err: any) { return err.message; }
  };

  const renderView = () => {
    switch (activeView) {
      case 'loading': return <PageSpinner />;
      case 'callQueue': return <CallQueuePage currentUser={currentUser!} />;
      case 'winBack': return <WinBackPage currentUser={currentUser!} />;
      case 'suppression': return <SuppressionPage />;
      case 'executiveDashboard': return <SalesExecutiveDashboard currentUser={currentUser!} stats={stats} outreachRange={outreachRange} target={outreachTarget} isLoading={isLoading} />;
      case 'dashboard': return <AdminDashboard setView={setActiveView} />;
      case 'followUp': return (
        <FollowUpPage 
            todaysReminders={followUpCustomers.filter(c => c.followUpNotes?.some(n => n.reminderDate && isToday(n.reminderDate) && n.reminderStatus !== 'completed'))} 
            customers={followUpCustomers}
            segmentCounts={followUpCounts}
            activeTab={followUpTab}
            outreachRange={outreachRange}
            userRefinedRange={userRefinedRange}
            onUserRefinedRangeChange={setUserRefinedRange}
            onTabChange={(t) => { setFollowUpTab(t); setFollowUpPage(1); }}
            onAddFollowUpNote={addFollowUpNote} 
            onMarkReminderDone={handleMarkReminderDone} 
            products={products} 
            currentUser={currentUser!} 
            onUpdatePurchaseDate={updatePurchaseDate} 
            onSearchChange={setFollowUpSearch} 
            isLoading={isLoading} 
            totalCount={totalFollowUp} 
            currentPage={followUpPage} 
            onPageChange={setFollowUpPage} 
            pageSize={followUpPageSize} 
            onPageSizeChange={(s) => { setFollowUpPageSize(s); setFollowUpPage(1); }}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
        />
      );
      case 'uploadData': return <DataUploadPage onUploadSuccess={fetchData} />;
      case 'dataManagement': return (
          <DataManagementPage 
            customers={customers}
            totalCount={totalCustomers}
            currentPage={currentPage}
            pageSize={pageSize}
            isLoading={isLoading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onPageChange={setCurrentPage}
            onSearchChange={setSearchTerm}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            onRefresh={fetchData}
            currentUser={currentUser!}
          />
      );
      case 'teamActivity': return (
          <TeamActivityPage 
            teamActivity={stats?.teamActivity || []} 
            isLoading={isLoading} 
            onRefresh={fetchData}
            selectedDate={teamActivityDate}
            onDateChange={setTeamActivityDate}
          />
      );
      case 'executivePerformance': return <ExecutivePerformancePage />;
      case 'agentCoaching': return <AgentCoachingPage />;
      case 'products': return (
        <ProductsPage 
            products={products} 
            onAddProduct={async p => { await api.addProduct(p); fetchData(); }} 
            onUpdateProduct={async p => { /* Not strictly needed */ }} 
            onDeleteProduct={async id => { await api.deleteProduct(id); fetchData(); }} 
        />
      );
      case 'auditLog': return (
          <AuditLogPage 
            data={auditLogData} 
            totalCount={auditLogTotal} 
            currentPage={auditLogPage} 
            onPageChange={setAuditLogPage} 
            onSearchChange={setAuditLogSearch}
            isLoading={isLoading}
          />
      );
      case 'userManagement': return (
        <UserManagementPage 
            users={users} 
            currentUser={currentUser!} 
            onUpdateUserStatus={async (id, s) => { 
                await api.updateUserStatus(id, s); 
                const updatedUsers = await api.getUsers();
                setUsers(updatedUsers);
            }} 
        />
      );
      case 'settings': return <SettingsPage currentTarget={outreachTarget} onTargetUpdate={setOutreachTarget} currentUser={currentUser!} />;
      case 'newOrder': return <NewOrderPage customers={customers} products={products} setView={setActiveView} currentUser={currentUser!} />;
      case 'orderStatus': return <OrderStatusPage currentUser={currentUser!} />;
      case 'trackOrder': return <TrackOrderPage />;
      default: return <div className="text-center py-20 text-slate-400 italic">Welcome back! Loading your dashboard...</div>;
    }
  };

  if (!currentUser) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;

  return (
    <>
      {/* Global glass backdrop — sits behind every page. The whole app surfaces frost over it. */}
      <GlassBackground />
      <div className="min-h-screen text-foreground md:flex font-sans relative">
        <Sidebar user={currentUser} activeView={activeView} setView={setActiveView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onLogout={() => { setCurrentUser(null); setActiveView('loading'); }} />
        <main className="flex-1 p-4 md:py-6 md:pr-6 md:pl-3 overflow-y-auto">
          <Header title={activeView} onMenuClick={() => setIsSidebarOpen(true)} reminders={[]} onReminderClick={() => setActiveView('followUp')} />
          {error && (
            <div className="mb-6 px-4 py-3 text-red-700 text-sm font-medium glass-surface glass-chip-tint-red">
              {error}
            </div>
          )}
          <Suspense fallback={<PageSpinner />}>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </>
  );
};

export default App;
