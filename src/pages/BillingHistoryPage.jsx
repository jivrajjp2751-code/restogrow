import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { printBillDirect } from '../utils/print';
import { Search, Printer, Receipt } from 'lucide-react';

export default function BillingHistoryPage() {
  const { bills: rawBills, config, refresh, refreshing = false } = useApp();
  const bills = [...(rawBills || [])].reverse();
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const filteredBills = (bills || []).filter(b => {
    const matchSearch = !searchQuery || b.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || String(b.tableNumber || '').includes(searchQuery);
    const matchPayment = paymentFilter === 'all' || b.paymentMode === paymentFilter;
    return matchSearch && matchPayment;
  });

  const handlePrint = (bill) => {
    printBillDirect(bill);
  };

  const todayTotal = bills.filter(b => {
    const d = b.createdAt || b.created_at;
    return d?.startsWith(new Date().toISOString().split('T')[0]);
  }).reduce((s, b) => s + (b.total || 0), 0);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">
          <Receipt size={16} /> BILLS
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {bills.length} total · Today: {config.currency}{todayTotal}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '180px' }}>
          <Search />
          <input className="input" placeholder="Search bill # or table..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="select" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ width: '120px' }}>
          <option value="all">All</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="UPI">UPI</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0, maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>BILL #</th><th>TIME</th><th>TABLE</th><th>ITEMS</th><th>TOTAL</th><th>PAY</th><th></th></tr></thead>
            <tbody>
              {filteredBills.map(bill => (
                <tr key={bill.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{bill.billNumber}</td>
                  <td style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{new Date(bill.createdAt || bill.created_at).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>T{bill.tableNumber}</td>
                  <td>{(bill.items || []).length}</td>
                  <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-success)' }}>{config.currency}{bill.total}</td>
                  <td><span className="badge badge-info">{bill.paymentMode}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => handlePrint(bill)}><Printer size={12} /></button></td>
                </tr>
              ))}
              {filteredBills.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No bills</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
