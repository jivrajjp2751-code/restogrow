import { useState } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { printBillDirect } from '../utils/print';
import { settleBill } from '../store/data';
import { Search, Printer, Receipt, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';

export default function BillingHistoryPage() {
  const { bills: rawBills, config, refresh } = useApp();
  const bills = [...(rawBills || [])].reverse();
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const { addToast } = useToast();

  // Settlement modal state
  const [settleModal, setSettleModal] = useState(null);
  const [settleMode, setSettleMode] = useState('Cash');
  const [busy, setBusy] = useState(false);

  const filteredBills = (bills || []).filter(b => {
    const matchSearch = !searchQuery || b.billNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || String(b.tableNumber || '').includes(searchQuery);
    const matchPayment = paymentFilter === 'all' || b.paymentMode === paymentFilter;
    return matchSearch && matchPayment;
  });

  const handlePrint = (bill) => {
    printBillDirect(bill);
  };

  const handleSettle = async () => {
    if (!settleModal || busy) return;
    setBusy(true);
    try {
      await settleBill(settleModal.id, settleMode);
      await refresh();
      addToast(`Bill ${settleModal.billNumber} settled via ${settleMode}`, 'success');
      setSettleModal(null);
    } catch (e) { addToast('Settlement failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const todayTotal = bills.filter(b => {
    const d = b.createdAt || b.created_at;
    return d?.startsWith(new Date().toISOString().split('T')[0]);
  }).reduce((s, b) => s + (b.total || 0), 0);

  const unsettledCount = bills.filter(b => !b.paymentMode || b.paymentMode === 'Unsettled').length;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">
          <Receipt size={16} /> BILLS
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {bills.length} total · Today: {config.currency}{todayTotal}
            {unsettledCount > 0 && <span style={{ color: 'var(--brand-warning)', marginLeft: '8px' }}>· {unsettledCount} unsettled</span>}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div className="search-input-wrapper" style={{ flex: '1 1 180px', minWidth: 0 }}>
          <Search />
          <input className="input" placeholder="Search bill # or table..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="select" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ width: 'auto', minWidth: '100px', flex: '0 0 auto' }}>
          <option value="all">All</option>
          <option value="Cash">Cash</option>
          <option value="Card">Card</option>
          <option value="UPI">UPI</option>
          <option value="Unsettled">Unsettled</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0, maxHeight: 'calc(100vh - 180px)', overflow: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>BILL #</th><th>TIME</th><th>TABLE</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead>
            <tbody>
              {filteredBills.map(bill => {
                const isUnsettled = !bill.paymentMode || bill.paymentMode === 'Unsettled';
                return (
                  <tr key={bill.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{bill.billNumber}</td>
                    <td style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{new Date(bill.createdAt || bill.created_at).toLocaleString()}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>T{bill.tableNumber}</td>
                    <td>{(bill.items || []).length}</td>
                    <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--brand-success)' }}>{config.currency}{bill.total}</td>
                    <td>
                      {isUnsettled ? (
                        <button className="btn btn-sm btn-warning" style={{ fontSize: '10px', padding: '2px 8px' }}
                          onClick={() => { setSettleModal(bill); setSettleMode('Cash'); }}>
                          SETTLE
                        </button>
                      ) : (
                        <span className="badge badge-info">{bill.paymentMode}</span>
                      )}
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handlePrint(bill)}><Printer size={12} /></button></td>
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No bills</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Modal */}
      {settleModal && (
        <div className="modal-backdrop" onClick={() => setSettleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 className="modal-title">SETTLE — {settleModal.billNumber}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSettleModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Table: T{settleModal.tableNumber} · Total: {config.currency}{settleModal.total}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '8px', marginTop: '12px', color: 'var(--text-secondary)' }}>PAYMENT METHOD</div>
              <div className="payment-modes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { mode: 'Cash', icon: Banknote },
                  { mode: 'Card', icon: CreditCard },
                  { mode: 'UPI', icon: Smartphone },
                ].map(p => (
                  <button key={p.mode} type="button"
                    className={`payment-mode-btn ${settleMode === p.mode ? 'active' : ''}`}
                    onClick={() => setSettleMode(p.mode)}>
                    <p.icon size={18} />
                    <span>{p.mode}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSettleModal(null)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleSettle} disabled={busy}>
                <CheckCircle size={14} /> SETTLE — {settleMode}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
