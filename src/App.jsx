import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, ToastProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import TablesPage from './pages/TablesPage';
import OrderPage from './pages/OrderPage';
import OrdersListPage from './pages/OrdersListPage';
import BillingPage from './pages/BillingPage';
import BillingHistoryPage from './pages/BillingHistoryPage';
import InventoryPage from './pages/InventoryPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import SessionPage from './pages/SessionPage';
import StaffMobileDashboard from './pages/StaffMobileDashboard';
import MasterPortal from './pages/MasterPortal';
import './index.css';

function ProtectedLayout() {
  const { currentUser, loading, tenantId } = useApp();

  if (loading) {
    return (
      <div className="resto-loader">
        <div className="resto-logo-spin">RG</div>
        <div className="resto-loader-text">RESTOGROW | POWERING YOUR RESTAURANT</div>
      </div>
    );
  }

  if (!currentUser && window.location.hash !== '#/jivesh') {
    return <LoginPage />;
  }

  const isStaff = currentUser?.role === 'staff';

  if (isStaff) {
    return (
      <Routes>
        <Route path="/staff" element={<StaffMobileDashboard />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/session" element={<SessionPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/order/:tableId" element={<OrderPage />} />
          <Route path="/orders" element={<OrdersListPage />} />
          <Route path="/billing/:orderId" element={<BillingPage />} />
          <Route path="/billing" element={<BillingHistoryPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/session" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppProvider>
          <Routes>
            <Route path="/jivesh" element={<MasterPortal />} />
            <Route path="*" element={<ProtectedLayout />} />
          </Routes>
        </AppProvider>
      </ToastProvider>
    </HashRouter>
  );
}
