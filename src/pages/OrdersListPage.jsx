import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle } from 'lucide-react';

export default function OrdersListPage() {
  const { orders, config, refreshing = false } = useApp();
  const navigate = useNavigate();

  const activeOrders = (orders || []).filter(o => o.status === 'active');
  const completedOrders = (orders || []).filter(o => o.status === 'completed').reverse().slice(0, 30);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">
          <ClipboardList size={16} /> ORDERS
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {activeOrders.length} active
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock size={12} color="var(--brand-primary)" /> ACTIVE
        </div>
        {activeOrders.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
            {activeOrders.map(order => {
              const subtotal = (order.items || []).reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0);
              return (
                <div key={order.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/order/${order.tableId}`)}>
                  <div className="card-body" style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '13px' }}>T{order.tableNumber}</span>
                      <span className="badge badge-info">ACTIVE</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {(order.items || []).length} items · {config.currency}{subtotal}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      {(order.items || []).slice(0, 3).map(i => `${i.name}×${i.quantity}`).join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card"><div className="empty-state" style={{ padding: '20px' }}>
            <p className="empty-state-text">No active orders</p>
          </div></div>
        )}
      </div>

      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CheckCircle size={12} color="var(--brand-success)" /> COMPLETED
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 0, maxHeight: '400px', overflow: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>TABLE</th><th>ITEMS</th><th>CUSTOMER</th><th>TIME</th></tr></thead>
            <tbody>
              {completedOrders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>T{order.tableNumber}</td>
                  <td>{(order.items || []).length}</td>
                  <td>{order.customerName || '—'}</td>
                  <td style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{new Date(order.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {completedOrders.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>None yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
