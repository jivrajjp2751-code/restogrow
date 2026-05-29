import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, Component } from 'react';
import { AppProvider, ToastProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import PrintListener from './components/PrintListener';
import PrintQueuePanel from './components/PrintQueuePanel';
import './index.css';

// Global Error Boundary — catches any uncaught React rendering errors
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('⚠️ App Error Boundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1A1B2E', color: 'white', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '24px', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', borderRadius: '8px', background: '#6C5CE7', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>RELOAD APP</button>
            <button onClick={() => this.setState({ hasError: false, error: null })} style={{ padding: '12px 24px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 700, cursor: 'pointer' }}>TRY AGAIN</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#1A1B2E', backgroundImage: 'radial-gradient(circle at top right, #2D2B52 0%, #1A1B2E 60%, #12131F 100%)',
        padding: '20px', textAlign: 'center', fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
         <div style={{
           background: 'rgba(25, 26, 46, 0.85)', padding: '48px 40px', borderRadius: '24px',
           border: '1px solid rgba(255, 255, 255, 0.08)', maxWidth: '440px', width: '100%',
           boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 80px rgba(108, 92, 231, 0.08)',
           backdropFilter: 'blur(20px)',
           animation: 'slideUp 0.4s ease',
         }}>
           <div style={{
             width: '72px', height: '72px', borderRadius: '20px', margin: '0 auto 24px',
             background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.15), rgba(255, 159, 10, 0.15))',
             border: '1px solid rgba(255, 107, 107, 0.2)',
             display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
           }}>🔒</div>
           <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px', letterSpacing: '0.02em' }}>
             Access Suspended
           </h2>
           <div style={{
             fontSize: '11px', fontWeight: 700, color: '#FF6B6B', background: 'rgba(255, 107, 107, 0.12)',
             padding: '4px 14px', borderRadius: '20px', display: 'inline-block', marginBottom: '20px',
             fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase',
             border: '1px solid rgba(255, 107, 107, 0.2)',
           }}>MEMBERSHIP EXPIRED</div>
           <p style={{ color: 'rgba(255, 255, 255, 0.55)', lineHeight: '1.7', marginBottom: '28px', fontSize: '14px' }}>
             Your access to <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{restaurant.name || 'RestoGrow'}</span> has been temporarily suspended.
             Please contact the administrator to renew your membership and restore access.
           </p>
           <div style={{
             background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', padding: '14px 16px', marginBottom: '28px',
             border: '1px solid rgba(255, 255, 255, 0.06)',
           }}>
             <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace" }}>
               CONTACT SUPPORT
             </div>
             <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 500 }}>
               Reach out to your RestoGrow administrator to reactivate your account.
             </div>
           </div>
           <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
             <button onClick={() => window.location.reload()} style={{
               flex: 1, padding: '12px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '13px',
               background: '#6C5CE7', color: 'white', border: 'none', cursor: 'pointer',
               boxShadow: '0 4px 16px rgba(108, 92, 231, 0.3)', transition: 'all 0.15s ease',
             }}>RETRY</button>
             <button onClick={logout} style={{
               flex: 1, padding: '12px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '13px',
               background: 'rgba(255, 255, 255, 0.06)', color: 'rgba(255, 255, 255, 0.7)',
               border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', transition: 'all 0.15s ease',
             }}>LOGOUT</button>
           </div>
         </div>
         <div style={{ marginTop: '24px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
           <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'linear-gradient(135deg, #6C5CE7, #00CEC9)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: 'white' }}>RG</span>
           Powered by RestoGrow
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
      <PrintQueuePanel />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
