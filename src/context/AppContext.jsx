import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { syncAll, authenticateUser, setTenant, getTenant, subscribeToChanges } from '../store/data';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts([{ id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ===== APP CONTEXT =====
const AppContext = createContext();

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('rg_tenant_id'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('rg_current_user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });

  const [data, setData] = useState({
    tables: [], sections: [], categories: [], menuItems: [], orders: [], bills: [], users: [], sessions: [],
    config: { restaurantName: 'RestoGrow', currency: '₹', taxRate: 0, serviceChargeRate: 0 }
  });

  const [loading, setLoading] = useState(true);

  // Check URL for RID (Restaurant ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const rid = params.get('rid');
    if (rid) {
      localStorage.setItem('rg_tenant_id', rid);
      setTenantId(rid);
      setTenant(rid);
    } else if (tenantId) {
      setTenant(tenantId);
    }
  }, [tenantId]);

  const loadData = useCallback(async () => {
    if (!getTenant()) {
      setLoading(false);
      return;
    }
    try {
      const result = await syncAll();
      if (result) setData(result);
      setLoading(false);
    } catch (err) {
      console.error('Sync error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    let sub = null;
    if (getTenant()) {
      sub = subscribeToChanges(() => loadData());
    }
    return () => { if (sub) sub.unsubscribe(); };
  }, [loadData, tenantId]);

  const login = useCallback(async (user) => {
    setCurrentUser(user);
    localStorage.setItem('rg_current_user', JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('rg_current_user');
  }, []);

  const refresh = useCallback(async () => { await loadData(); }, [loadData]);

  const currentSession = (data.sessions || []).find(s => s.status === 'active') || null;

  return (
    <AppContext.Provider value={{
      theme, currentUser, login, logout, tenantId,
      config: data.config,
      tables: data.tables,
      sections: data.sections,
      menuItems: data.menu_items || [],
      categories: data.categories,
      orders: data.orders,
      bills: data.bills,
      users: data.users,
      sessions: data.sessions,
      currentSession,
      refresh,
      loading
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
