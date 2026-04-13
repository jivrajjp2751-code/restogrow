import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import { generateBill, createPrintJob, cancelOrder, settleBill } from '../store/data';
import { CreditCard, Banknote, Smartphone, ArrowLeft, Printer, XCircle, CheckCircle } from 'lucide-react';
import { printBillDirect } from '../utils/print';

export default function BillingPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { config = {}, refresh, orders = [], currentUser } = useApp();
  const { addToast } = useToast();

  const order = (orders || []).find(o => o.id === orderId);
  const [discount, setDiscount] = useState(0);
  const [generatedBill, setGeneratedBill] = useState(null);
  const [busy, setBusy] = useState(false);

  // Settlement state
  const [settlementMode, setSettlementMode] = useState('Cash');
  const [settled, setSettled] = useState(false);

  if (!order && !generatedBill) {
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

  const billLayout = config.billLayout || {};

  const handleGenerateBill = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await generateBill(orderId, discount);
      if (result.bill) {
        result.bill.billLayout = billLayout;
        result.bill.cashierName = currentUser?.name || currentUser?.email || '';
        setGeneratedBill(result.bill);
        refresh();
        addToast('BILL GENERATED', 'success');
      }
      else addToast('Failed', 'error');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const handlePrintBill = async () => {
    if (!generatedBill) return;
    try {
      if (localStorage.getItem('isPrintStation') === 'true') {
        printBillDirect(generatedBill);
        addToast('Printing Bill...', 'success');
      } else {
        await createPrintJob('BILL', { bill: generatedBill });
        addToast('Bill sent to printer queue', 'success');
      }
    } catch (e) { addToast('Print failed: ' + e.message, 'error'); }
  };

  const handleSettlement = async () => {
    if (!generatedBill || busy) return;
    setBusy(true);
    try {
      await settleBill(generatedBill.id, settlementMode);
      setSettled(true);
      refresh();
      addToast(`Bill settled via ${settlementMode}`, 'success');
    } catch (e) { addToast('Settlement failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const handleCancelOrder = async () => {
    if (!confirm('Cancel this order? All items will be removed.')) return;
    setBusy(true);
    try {
      await cancelOrder(order.id, order.tableId);
      await refresh();
      addToast('Order cancelled', 'info');
      navigate('/tables');
    } catch (e) { addToast('Cancel failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  // Preview Data (either live or from DB)
  const isGenerated = !!generatedBill;
  const dRestaurantName = isGenerated ? generatedBill.restaurantName : (billLayout.restaurantName || config.restaurantName || 'RESTAURANT');
  const dAddress = isGenerated ? generatedBill.restaurantAddress : (billLayout.address || config.address || '');
  const dPhone = isGenerated ? generatedBill.restaurantPhone : (billLayout.phone || config.phone || '');
  const dGstin = isGenerated ? generatedBill.gstNumber : (billLayout.gstin || config.gstNumber || '');
  
  const pSubtotal = isGenerated ? (generatedBill.subtotal || 0) : subtotal;
  const pTaxRate = isGenerated ? (parseFloat(generatedBill.taxRate) || 0) : taxRate;
  const pHalfRate = pTaxRate / 2;
  const pSgst = isGenerated ? Math.round((pSubtotal * pHalfRate) / 100 * 100) / 100 : sgst;
  const pCgst = isGenerated ? Math.round((pSubtotal * pHalfRate) / 100 * 100) / 100 : cgst;
  const pDiscountAmount = isGenerated ? (generatedBill.discountAmount || 0) : discountAmount;
  const pDiscountPercent = isGenerated ? generatedBill.discount : discount;
  const pTotal = isGenerated ? (generatedBill.total || 0) : total;
  const pItems = isGenerated ? generatedBill.items : order.items;
  const pTableLabel = isGenerated ? generatedBill.tableNumber : order.tableNumber;
  const pBillNumber = isGenerated ? generatedBill.billNumber : 'DRAFT';
  const pDate = isGenerated ? new Date(generatedBill.createdAt || Date.now()).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  const pCashierName = isGenerated ? generatedBill.cashierName : (currentUser?.name || 'CN');

  return (
    <div className="page-content">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 350px', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Editor or Success */}
        <div>
          {isGenerated ? (
             <div style={{ textAlign: 'center', padding: '40px 0' }}>
               <div style={{ fontSize: '48px', color: 'var(--brand-success)', marginBottom: '16px' }}>✓</div>
               <div style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>BILL GENERATED</div>
               <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: '32px' }}>{generatedBill.billNumber}</div>
               
               <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                 <button className="btn btn-secondary btn-lg" onClick={() => navigate('/tables')}>BACK TO TABLES</button>
                 <button className="btn btn-success btn-lg" onClick={handlePrintBill}><Printer size={16} /> PRINT BILL</button>
               </div>

               {/* Settlement Section */}
               <div style={{ marginTop: '32px', padding: '24px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                 {settled ? (
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--brand-success)', fontWeight: 700, fontSize: '14px' }}>
                     <CheckCircle size={18} /> SETTLED VIA {settlementMode.toUpperCase()}
                   </div>
                 ) : (
                   <>
                     <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '12px', color: 'var(--text-secondary)' }}>SETTLEMENT</div>
                     <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>Select how the customer paid. This is for reports only — not shown on the bill.</p>
                     <div className="payment-modes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                       {[
                         { mode: 'Cash', icon: Banknote },
                         { mode: 'Card', icon: CreditCard },
                         { mode: 'UPI', icon: Smartphone },
                       ].map(p => (
                         <button key={p.mode} type="button"
                           className={`payment-mode-btn ${settlementMode === p.mode ? 'active' : ''}`}
                           onClick={() => setSettlementMode(p.mode)}>
                           <p.icon size={18} />
                           <span>{p.mode}</span>
                         </button>
                       ))}
                     </div>
                     <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSettlement} disabled={busy}>
                       <CheckCircle size={16} /> SETTLE — {settlementMode.toUpperCase()}
                     </button>
                   </>
                 )}
               </div>
             </div>
          ) : (
             <>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/order/${order.tableId}`)}>
                     <ArrowLeft size={16} />
                   </button>
                   <div className="page-title" style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>
                     BILLING — {order.tableNumber}
                   </div>
                 </div>
                 <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={handleCancelOrder}>
                   <XCircle size={14} style={{ marginRight: '4px' }} /> CANCEL ORDER
                 </button>
               </div>

               {/* Items Grid */}
               <div className="card" style={{ marginBottom: '12px' }}>
                 <div className="card-body" style={{ padding: 0 }}>
                   <table className="data-table">
                     <thead><tr><th>ITEM</th><th style={{ textAlign: 'center' }}>QTY</th><th style={{ textAlign: 'right' }}>PRICE</th><th style={{ textAlign: 'right' }}>VALUE</th></tr></thead>
                     <tbody>
                       {(order?.items || []).map(item => (
                         <tr key={item.id}>
                           <td style={{ fontWeight: 600 }}>{item.name}</td>
                           <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.quantity}</td>
                           <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.price}</td>
                           <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{config.currency}{item.price * item.quantity}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>

               {/* Discount Only (no payment method) */}
               <div className="card" style={{ marginBottom: '12px' }}>
                 <div className="card-body">
                   <div className="input-group">
                     <label className="input-label">Discount (%)</label>
                     <input type="number" className="input" value={discount}
                       onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                       min="0" max="100" />
                   </div>
                 </div>
               </div>

               {/* Financial Summary */}
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

               <button className="btn btn-success btn-lg" style={{ width: '100%', fontSize: '14px' }} onClick={handleGenerateBill} disabled={busy}>
                 GENERATE BILL — {config.currency}{Math.round(total)}
               </button>
             </>
          )}
        </div>

        {/* RIGHT COLUMN: Live Bill Preview */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            {isGenerated ? 'FINAL RECEIPT' : 'LIVE PREVIEW'}
          </div>
          
          <div style={{
            background: '#fff', color: '#000', padding: '14px', borderRadius: '8px',
            fontFamily: "'Courier New', monospace", fontSize: '10px', lineHeight: '1.5',
            border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)',
            maxHeight: 'calc(100vh - 100px)', overflowY: 'auto'
          }}>
            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', marginBottom: '2px', textTransform: 'uppercase' }}>
              {dRestaurantName}
            </div>
            {dAddress && <div style={{ textAlign: 'center', fontSize: '9px' }}>{dAddress}</div>}
            {dPhone && <div style={{ textAlign: 'center', fontSize: '9px' }}>Phone: {dPhone}</div>}
            {dGstin && <div style={{ textAlign: 'center', fontSize: '9px' }}>GSTIN: {dGstin}</div>}
            {billLayout.sacCode && billLayout.showSACCode !== false && (
              <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '11px', marginTop: '2px' }}>SAC {billLayout.sacCode}</div>
            )}
            {billLayout.serviceType && (
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '10px' }}>[{billLayout.serviceType}]</div>
            )}
            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '11px', marginTop: '4px' }}>[INVOICE]</div>

            <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

            <div>Bill No.: {pBillNumber}</div>
            <div>Date : {pDate}</div>

            <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Table No.: {pTableLabel}</span>
              {billLayout.showWaiter !== false && <span>Waiter: {(order?.waiterCode || '')}</span>}
            </div>

            <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

            <div style={{ display: 'flex', fontWeight: 700, fontSize: '9px', borderBottom: '1px dotted #000', paddingBottom: '2px' }}>
              <span style={{ flex: 2 }}>Item Name</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Qty.</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Value</span>
            </div>

            {(pItems || []).map((item, i) => {
              const qty = item.quantity || 1;
              const price = item.price || 0;
              return (
                <div key={i} style={{ display: 'flex', fontWeight: 700, padding: '2px 0' }}>
                  <span style={{ flex: 2, textTransform: 'uppercase' }}>{item.name}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{qty.toFixed(2)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{price.toFixed(1)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{(price * qty).toFixed(2)}</span>
                </div>
              );
            })}

            <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>SUB TOTAL</span><span>{pSubtotal.toFixed(2)}</span>
            </div>

            {pTaxRate > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>Add S GST({pHalfRate.toFixed(3)}%) on {pSubtotal.toFixed(2)}</span>
                  <span>{pSgst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>Add C GST({pHalfRate.toFixed(3)}%) on {pSubtotal.toFixed(2)}</span>
                  <span>{pCgst.toFixed(2)}</span>
                </div>
              </>
            )}

            {pDiscountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span>Discount {pDiscountPercent}%</span>
                <span>-{pDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '11px', marginTop: '4px' }}>
              <span>Amount Incl of All Taxes</span><span>{pTotal.toFixed(2)}</span>
            </div>

            <hr style={{ border: 'none', borderTop: '2px dashed #000', margin: '4px 0' }} />

            {billLayout.showCashier !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span>Cashier : {pCashierName}</span><span>E & C E</span>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '6px', fontWeight: 700 }}>
               {billLayout.footerLine1 || 'Thank you for your visit'}
            </div>
            {billLayout.footerLine2 && <div style={{ textAlign: 'center', fontWeight: 700 }}>{billLayout.footerLine2}</div>}
            {billLayout.footerLine3 && <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '2px' }}>{billLayout.footerLine3}</div>}
            
            {/* RestoGrow Branding */}
            <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '8px', color: '#999', fontStyle: 'italic' }}>
              Powered by RestoGrow
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
