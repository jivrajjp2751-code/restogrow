import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import { generateBill, createPrintJob } from '../store/data';
import { printBillDirect } from '../utils/print';
import { CreditCard, Banknote, Smartphone, ArrowLeft, Printer } from 'lucide-react';

export default function BillingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { config = {}, refresh, orders = [], currentUser } = useApp();
  const { addToast } = useToast();

  const order = (orders || []).find(o => o.id === orderId);
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

  const subtotal = (order?.items || []).reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0);
  const taxRate = config.taxRate || 0;
  const halfTaxRate = taxRate / 2;
  const sgst = Math.round((subtotal * halfTaxRate) / 100 * 100) / 100;
  const cgst = Math.round((subtotal * halfTaxRate) / 100 * 100) / 100;
  const totalTax = sgst + cgst;
  const serviceCharge = (subtotal * (config.serviceChargeRate || 0)) / 100;
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal + totalTax + serviceCharge - discountAmount;

  const handleGenerateBill = async () => {
    try {
      const result = await generateBill(orderId, paymentMode, discount);
      if (result.bill) {
        // Merge billLayout config into the bill object for printing
        const billLayout = config.billLayout || {};
        result.bill.billLayout = billLayout;
        result.bill.cashierName = currentUser?.name || currentUser?.email || '';
        setGeneratedBill(result.bill);
        refresh();
        addToast('BILL GENERATED', 'success');
      }
      else addToast('Failed', 'error');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handlePrintBill = async () => {
    if (!generatedBill) return;
    try {
      await createPrintJob('BILL', { bill: generatedBill });
      addToast('Printing Bill...', 'info');
    } catch { addToast('Print failed', 'error'); }
  };

  const billLayout = config.billLayout || {};

  if (generatedBill) {
    const bSubtotal = generatedBill.subtotal || 0;
    const bTaxRate = parseFloat(generatedBill.taxRate) || 0;
    const bHalfRate = bTaxRate / 2;
    const bSgst = Math.round((bSubtotal * bHalfRate) / 100 * 100) / 100;
    const bCgst = Math.round((bSubtotal * bHalfRate) / 100 * 100) / 100;
    const bDiscount = generatedBill.discountAmount || 0;
    const bTotal = generatedBill.total || 0;

    return (
      <div className="page-content">
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '4px' }}>BILL GENERATED</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>{generatedBill.billNumber}</div>

          {/* Bill Preview — thermal receipt style */}
          <div className="bill-preview" style={{ marginBottom: '16px', textAlign: 'left' }}>
            <div className="bill-header">
              <div className="bill-restaurant-name">{generatedBill.restaurantName || billLayout.restaurantName || 'POS'}</div>
              {(generatedBill.restaurantAddress || billLayout.address) && (
                <div style={{ fontSize: '9px', color: '#333' }}>{generatedBill.restaurantAddress || billLayout.address}</div>
              )}
              {(generatedBill.restaurantPhone || billLayout.phone) && (
                <div style={{ fontSize: '9px', color: '#333' }}>Phone: {generatedBill.restaurantPhone || billLayout.phone}</div>
              )}
              {(generatedBill.gstNumber || billLayout.gstin) && (
                <div style={{ fontSize: '9px', color: '#444' }}>GSTIN: {generatedBill.gstNumber || billLayout.gstin}</div>
              )}
              {billLayout.sacCode && (
                <div style={{ fontSize: '12px', fontWeight: 900, marginTop: '4px' }}>SAC {billLayout.sacCode}</div>
              )}
              {billLayout.serviceType && (
                <div style={{ fontSize: '10px', fontWeight: 700 }}>[{billLayout.serviceType}]</div>
              )}
              <div style={{ fontSize: '11px', fontWeight: 800, marginTop: '2px' }}>[INVOICE]</div>
            </div>

            <hr className="bill-divider" />

            <div style={{ fontSize: '10px', padding: '2px 0' }}>Bill No.: {generatedBill.billNumber}</div>
            <div style={{ fontSize: '10px', padding: '2px 0' }}>
              Date: {new Date(generatedBill.createdAt || Date.now()).toLocaleString('en-IN')}
            </div>

            <hr className="bill-divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '2px 0' }}>
              <span>Table: {generatedBill.tableNumber}</span>
              <span>Waiter: {generatedBill.waiterCode || ''}</span>
            </div>

            <hr className="bill-divider" />

            {/* Item table header */}
            <div style={{ display: 'flex', fontSize: '10px', fontWeight: 700, padding: '2px 0', borderBottom: '1px dotted #999' }}>
              <span style={{ flex: 2 }}>Item Name</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Qty.</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Value</span>
            </div>

            {(generatedBill.items || []).map((item, i) => {
              const qty = item.quantity || 1;
              const price = item.price || 0;
              return (
                <div key={i} style={{ display: 'flex', fontSize: '10px', padding: '2px 0', fontWeight: 600 }}>
                  <span style={{ flex: 2, textTransform: 'uppercase' }}>{item.name}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{qty.toFixed(2)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{price.toFixed(1)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{(price * qty).toFixed(2)}</span>
                </div>
              );
            })}

            <hr className="bill-divider" />

            {/* Subtotal */}
            <div className="bill-total-row"><span>SUB TOTAL</span><span>{bSubtotal.toFixed(2)}</span></div>

            {/* Tax breakdown */}
            {bTaxRate > 0 && (
              <>
                <div style={{ fontSize: '10px', textAlign: 'right', padding: '1px 0' }}>
                  Add S GST({bHalfRate.toFixed(3)}%) on {bSubtotal.toFixed(2)} <span style={{ marginLeft: '8px' }}>{bSgst.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: '10px', textAlign: 'right', padding: '1px 0' }}>
                  Add C GST({bHalfRate.toFixed(3)}%) on {bSubtotal.toFixed(2)} <span style={{ marginLeft: '8px' }}>{bCgst.toFixed(2)}</span>
                </div>
              </>
            )}

            {bDiscount > 0 && (
              <div style={{ fontSize: '10px', textAlign: 'right', padding: '1px 0', color: '#00B894' }}>
                Discount {generatedBill.discount}% <span style={{ marginLeft: '8px' }}>-{bDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="bill-total-row" style={{ fontSize: '12px' }}>
              <span>Amount Incl of All Taxes</span>
              <span style={{ fontWeight: 900 }}>{bTotal.toFixed(2)}</span>
            </div>

            <hr className="bill-divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '4px' }}>
              <span>Cashier: {generatedBill.cashierName || ''}</span>
              <span>Payment: {generatedBill.paymentMode}</span>
            </div>

            <div className="bill-footer">
              <p style={{ fontWeight: 700 }}>{billLayout.footerLine1 || 'Thank you for your visit'}</p>
              {(billLayout.footerLine2 || 'Have a nice day') && <p style={{ fontWeight: 700 }}>{billLayout.footerLine2 || 'Have a nice day'}</p>}
              {billLayout.footerLine3 && <p style={{ fontSize: '9px', marginTop: '4px' }}>{billLayout.footerLine3}</p>}
            </div>
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
              <thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>VALUE</th></tr></thead>
              <tbody>
                {(order?.items || []).map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.quantity}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{config.currency}{item.price}</td>
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
            <div className="order-summary-row"><span>Subtotal</span><span>{config.currency}{subtotal.toFixed(2)}</span></div>
            {taxRate > 0 && (
              <>
                <div className="order-summary-row" style={{ fontSize: '11px' }}><span>SGST {halfTaxRate.toFixed(1)}%</span><span>{config.currency}{sgst.toFixed(2)}</span></div>
                <div className="order-summary-row" style={{ fontSize: '11px' }}><span>CGST {halfTaxRate.toFixed(1)}%</span><span>{config.currency}{cgst.toFixed(2)}</span></div>
              </>
            )}
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
