import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  LayoutGrid,
  Receipt, Package, Settings, Users, LogOut, TrendingUp, Play
} from 'lucide-react';

const navItems = [
  { to: '/session', icon: Play, label: 'Session' },
  { to: '/tables', icon: LayoutGrid, label: 'Tables' },
  { to: '/billing', icon: Receipt, label: 'Bills' },
  { to: '/inventory', icon: Package, label: 'Stock', adminOnly: true },
  { to: '/users', icon: Users, label: 'Users', adminOnly: true },
  { to: '/reports', icon: TrendingUp, label: 'Reports', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Setup', adminOnly: true },
];

export default function Sidebar() {
  const { currentUser, logout, currentSession } = useApp();
  const isAdmin = currentUser?.role === 'admin';

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand-icon" title="RestoGrow POS">RG</div>

      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/session'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <item.icon size={18} />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
        
        {/* Mobile Logout Button (inside nav for scrolling) */}
        <button 
          className="sidebar-link" 
          onClick={logout} 
          title="Logout"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--brand-danger)' }}
        >
          <LogOut size={18} />
          <span className="sidebar-label">Logout</span>
        </button>
      </nav>

      {/* Session indicator */}
      {currentSession && (
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--brand-success)',
          boxShadow: '0 0 6px var(--brand-success)',
          margin: '4px 0 0 0',
          animation: 'pulse 2s infinite',
        }} title="Session Active" />
      )}
    </aside>
  );
}
