import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppProvider, ToastProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import PrintListener from './components/PrintListener';
import './index.css';

// Lazy load pages for performance optimization on low-end PCs
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const BillingHistoryPage = lazy(() => import('./pages/BillingHistoryPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SessionPage = lazy(() => import('./pages/SessionPage'));
const StaffMobileDashboard = lazy(() => import('./pages/StaffMobileDashboard'));
const MasterPortal = lazy(() => import('./pages/MasterPortal'));

function LoadingFallback() {
  return (
    <div className="resto-loader">
      <div className="resto-logo-spin">RG</div>
      <div className="resto-loader-text">LOADING...</div>
    </div>
  );
}

function ProtectedLayout() {
  const { currentUser, loading, restaurant, logout } = useApp();
  
  if (loading) {
    return <LoadingFallback />;
  }

  if (restaurant?.status === 'suspended') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC', padding: '20px', textAlign: 'center' }}>
         <div style={{ background: '#fff', padding: '48px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: '500px' }}>
           <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔒</div>
           <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1A1B2E', marginBottom: '16px' }}>Membership Expired</h2>
           <p style={{ color: '#5A5E73', lineHeight: '1.6', marginBottom: '32px' }}>
             Your access to <b>{restaurant.name || 'RestoGrow'}</b> has been temporarily suspended. 
             Please contact the administrator to renew your membership and restore access to your data.
           </p>
           <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
             <button className="btn btn-primary" onClick={() => window.location.reload()}>RETRY</button>
             <button className="btn btn-secondary" onClick={logout}>LOGOUT</button>
           </div>
         </div>
      </div>
    );
  }

  if (!currentUser && window.location.hash !== '#/jivesh') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  const isStaff = currentUser?.role === 'staff';

  if (isStaff) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/staff" element={<StaffMobileDashboard />} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/session" element={<SessionPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/order/:tableId" element={<OrderPage />} />
            <Route path="/billing/:orderId" element={<BillingPage />} />
            <Route path="/billing" element={<BillingHistoryPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/session" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppProvider>
          <PrintListener />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/jivesh" element={<MasterPortal />} />
              <Route path="*" element={<ProtectedLayout />} />
            </Routes>
          </Suspense>
        </AppProvider>
      </ToastProvider>
    </HashRouter>
  );
}
