import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import { generateBill } from '../store/data';
import { printBillDirect } from '../utils/print';
import { CreditCard, Banknote, Smartphone, ArrowLeft, Printer } from 'lucide-react';

export default function BillingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { config, refresh, orders } = useApp();
  const { addToast } = useToast();

  const order = orders.find(o => o.id === orderId);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [generatedBill, setGeneratedBill] = useState(null);

  if (!order) {
    return (
      <div className="page-content"><div className="empty-state">
        <p className="empty-state-title">Order not found</p>
        <button className="btn btn-primary" onClick={() => navigate('/tables')}>Back</button>
      </div></div>
    );
  }

  const subtotal = order.items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const taxAmount = (subtotal * config.taxRate) / 100;
  const serviceCharge = (subtotal * config.serviceChargeRate) / 100;
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal + taxAmount + serviceCharge - discountAmount;

  const handleGenerateBill = async () => {
    try {
      const result = await generateBill(orderId, paymentMode, discount);
      if (result.bill) { setGeneratedBill(result.bill); refresh(); addToast('BILL GENERATED', 'success'); }
      else addToast('Failed', 'error');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handlePrintBill = () => {
    if (!generatedBill) return;
    printBillDirect(generatedBill);
  };

  if (generatedBill) {
    return (
      <div className="page-content">
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '4px' }}>BILL GENERATED</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>{generatedBill.billNumber}</div>

          <div className="bill-preview" style={{ marginBottom: '16px', textAlign: 'left' }}>
            <div className="bill-header">
              <div className="bill-restaurant-name">{generatedBill.restaurantName || 'POS'}</div>
              {generatedBill.gstNumber && <div style={{ fontSize: '9px', color: '#666' }}>GST: {generatedBill.gstNumber}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
              <span>{generatedBill.billNumber}</span><span>{generatedBill.tableNumber}</span>
            </div>
            <hr className="bill-divider" />
            {generatedBill.items.map((item, i) => (
              <div key={i} className="bill-item-row"><span>{item.name} ×{item.quantity}</span><span>₹{item.price * item.quantity}</span></div>
            ))}
            <hr className="bill-divider" />
            <div className="bill-total-row" style={{ fontWeight: 400 }}><span>Subtotal</span><span>₹{generatedBill.subtotal}</span></div>
            {generatedBill.taxAmount > 0 && <div className="bill-total-row" style={{ fontWeight: 400, fontSize: '10px' }}><span>Tax {generatedBill.taxRate}%</span><span>₹{Math.round(generatedBill.taxAmount)}</span></div>}
            {generatedBill.discountAmount > 0 && <div className="bill-total-row" style={{ fontWeight: 400, fontSize: '10px', color: '#00B894' }}><span>Discount {generatedBill.discount}%</span><span>-₹{Math.round(generatedBill.discountAmount)}</span></div>}
            <hr className="bill-divider" />
            <div className="bill-total-row"><span>TOTAL</span><span>₹{generatedBill.total}</span></div>
            <div style={{ fontSize: '10px', marginTop: '4px' }}>Payment: {generatedBill.paymentMode}</div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => navigate('/tables')}>
              TABLES
            </button>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handlePrintBill}>
              <Printer size={14} /> PRINT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/order/${order.tableId}`)}>
            <ArrowLeft size={16} />
          </button>
          <div className="page-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            BILLING — {order.tableNumber}
          </div>
        </div>

        {/* Items */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>ITEM</th><th>QTY</th><th>AMT</th></tr></thead>
              <tbody>
                {order.items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.quantity}</td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{config.currency}{item.price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-body">
            <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '8px', color: 'var(--text-secondary)' }}>PAYMENT METHOD</div>
            <div className="payment-modes">
              {[
                { mode: 'Cash', icon: Banknote },
                { mode: 'Card', icon: CreditCard },
                { mode: 'UPI', icon: Smartphone },
              ].map(p => (
                <button key={p.mode}
                  className={`payment-mode-btn ${paymentMode === p.mode ? 'active' : ''}`}
                  onClick={() => setPaymentMode(p.mode)}>
                  <p.icon size={18} />
                  <span>{p.mode}</span>
                </button>
              ))}
            </div>

            <div className="input-group">
              <label className="input-label">Discount (%)</label>
              <input type="number" className="input" value={discount}
                onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                min="0" max="100" />
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-body">
            <div className="order-summary-row"><span>Subtotal</span><span>{config.currency}{subtotal}</span></div>
            {config.taxRate > 0 && <div className="order-summary-row"><span>Tax {config.taxRate}%</span><span>{config.currency}{Math.round(taxAmount)}</span></div>}
            {config.serviceChargeRate > 0 && <div className="order-summary-row"><span>Service {config.serviceChargeRate}%</span><span>{config.currency}{Math.round(serviceCharge)}</span></div>}
            {discount > 0 && <div className="order-summary-row" style={{ color: 'var(--brand-success)' }}><span>Discount {discount}%</span><span>-{config.currency}{Math.round(discountAmount)}</span></div>}
            <div className="order-summary-row total"><span>TOTAL</span><span>{config.currency}{Math.round(total)}</span></div>
          </div>
        </div>

        <button className="btn btn-success btn-lg" style={{ width: '100%', fontSize: '14px' }} onClick={handleGenerateBill}>
          COMPLETE — {config.currency}{Math.round(total)}
        </button>
      </div>
    </div>
  );
}
