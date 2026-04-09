import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  createOrder, generateBill, cancelOrder
} from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';
import {
  Search, Plus, Minus, Trash2, ArrowLeft, Printer, Wine, Coffee,
  X, StickyNote, LogOut, Receipt, CreditCard, Banknote, Smartphone, RefreshCw, Package
} from 'lucide-react';

export default function StaffMobileDashboard() {
  const { tables = [], sections = [], menuItems = [], categories = [], config = {}, refresh, currentSession, logout, refreshing = false } = useApp();
  const { addToast } = useToast();

  const [selectedTableId, setSelectedTableId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const depts = useMemo(() => config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}], [config]);
  const [activeDeptId, setActiveDeptId] = useState(depts[0]?.id || 'kitchen');
  const [activeCategory, setActiveCategory] = useState('all');
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [customerModal, setCustomerModal] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [billModal, setBillModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedTable = useMemo(() =>
    tables.find(t => t.id === selectedTableId) || null,
  [tables, selectedTableId]);

  // Load order when table selected
  const loadOrder = useCallback(async () => {
    if (!selectedTableId) { setOrder(null); return; }
    try {
      const o = await getOrderForTable(selectedTableId);
      setOrder(o);
    } catch { setOrder(null); }
  }, [selectedTableId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  // Reload order when tables data refreshes (realtime)
  useEffect(() => {
    if (selectedTableId) loadOrder();
  }, [tables]); // eslint-disable-line

  const safeItems = order?.items || [];

  const deptCategories = useMemo(() => (categories || []).filter(c => c.type === activeDeptId), [categories, activeDeptId]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const tabCatIds = deptCategories.map(c => c.id);
    let items = (menuItems || []).filter(i => tabCatIds.includes(i.categoryId));
    if (activeCategory !== 'all') items = items.filter(i => i.categoryId === activeCategory);
    if (q) items = items.filter(i => i.name?.toLowerCase().includes(q) || i.code?.toLowerCase()?.includes(q));
    return items;
  }, [menuItems, activeDeptId, activeCategory, searchQuery, deptCategories]);

  const handleTableClick = (table) => {
    if (!currentSession) { addToast('Start a session first!', 'warning'); return; }
    if (table.status === 'available') {
      setCustomerModal(table);
    } else {
      setSelectedTableId(table.id);
    }
  };

  const handleBack = () => {
    setSelectedTableId(null);
    setOrder(null);
    setSearchQuery('');
    setActiveCategory('all');
  };

  const handleStartOrder = async () => {
    if (!customerModal || busy) return;
    setBusy(true);
    const table = customerModal;
    try {
      await createOrder(table.id, table.label || `T${table.number}`, customerName);
      await refresh();
      addToast(`${table.label} — Order started`, 'success');
      setCustomerModal(null);
      setCustomerName('');
      setSelectedTableId(table.id);
    } catch (e) { addToast('Failed: ' + (e.message || 'Unknown error'), 'error'); }
    finally { setBusy(false); }
  };

  const handleAddItem = async (menuItem) => {
    if (!order) { addToast("Order not initialized yet", "warning"); return; }
    if (busy) return;
    // Removed strict stock check to allow adding items when inventory isn't explicitly tracked

    setBusy(true);
    try {
      const cat = (categories || []).find(c => c.id === menuItem.categoryId);
      await addItemToOrder(order.id, { ...menuItem, categoryType: cat?.type || 'bar' });
      // Just reload order, don't do full app sync for speed
      await loadOrder();
      addToast(`+ ${menuItem.name}`, 'success');
    } catch (e) {
      addToast(e.message || 'Failed to add item', 'error');
    } finally { setBusy(false); }
  };

  const handleQtyChange = async (itemId, delta) => {
    if (!order || busy) return;
    const item = safeItems.find(i => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    setBusy(true);
    try {
      if (newQty <= 0) await removeOrderItem(order.id, itemId);
      else await updateOrderItem(order.id, itemId, { quantity: newQty });
      await loadOrder();
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleRemoveItem = async (itemId) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await removeOrderItem(order.id, itemId);
      await loadOrder();
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleAddNote = async () => {
    if (!order || !noteModal || busy) return;
    setBusy(true);
    try {
      await updateOrderItem(order.id, noteModal.id, { note: noteText });
      await loadOrder();
      setNoteModal(null);
      setNoteText('');
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleCancelOrder = async () => {
    if (!order || busy) return;
    if (!window.confirm('Cancel this order and free the table?')) return;
    setBusy(true);
    try {
      await cancelOrder(order.id, selectedTableId);
      await refresh();
      addToast('Order cancelled', 'info');
      handleBack();
    } catch (e) {
      addToast('Failed: ' + (e.message || ''), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePrintSplitKOT = () => {
    if (!order || safeItems.length === 0) { addToast('No items to print', 'warning'); return; }
    try {
      const tableLabel = selectedTable?.label || selectedTable?.number;
      printSplitKOT(order, tableLabel, categories, config);
      addToast('KOT printed', 'success');
    } catch (e) { addToast('Print failed: ' + (e.message || ''), 'error'); }
  };

  const handleGenerateBill = async () => {
    if (!order || safeItems.length === 0 || busy) return;
    setBusy(true);
    try {
      const result = await generateBill(order.id, paymentMode, discount);
      if (result?.bill) {
        try { printBillDirect({ ...result.bill, currency: config.currency }); } catch {}
        await refresh();
        addToast('Bill generated & printed', 'success');
        setBillModal(false);
        setSelectedTableId(null);
        setOrder(null);
      } else {
        addToast('Failed to generate bill', 'error');
      }
    } catch (e) { addToast('Failed: ' + (e.message || ''), 'error'); }
    finally { setBusy(false); }
  };

  const subtotal = safeItems.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0);
  const tax = (subtotal * (config.taxRate || 0)) / 100;
  const serviceCharge = (subtotal * (config.serviceChargeRate || 0)) / 100;
  const discountAmt = (subtotal * discount) / 100;
  const total = subtotal + tax + serviceCharge - discountAmt;



  // ===== TABLE VIEW =====
  if (!selectedTableId) {
    return (
      <div className="staff-mobile">
        <div className="staff-mobile-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
          <div className="staff-mobile-brand">
            <div className="staff-brand-icon">RG</div>
            <div>
              <div className="staff-brand-name">{config.restaurantName || 'RestoGrow'}</div>
              <div className="staff-brand-sub">
                {currentSession
                  ? <span className="staff-session-live"><span className="pulse-dot-sm" /> LIVE</span>
                  : <span style={{ color: 'var(--brand-danger)' }}>NO SESSION</span>
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="staff-sync-btn" onClick={refresh} disabled={refreshing} title="Refresh">
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            </button>
            <button className="staff-logout-btn" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>

        {refreshing && tables.length === 0 ? (
          <div className="resto-loader">
            <div className="resto-logo-spin">RG</div>
            <div className="resto-loader-text">Syncing...</div>
          </div>
        ) : (
          <div className="staff-tables-scroll">
            {(sections || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
                <p>No sections found</p>
                <button className="btn btn-secondary" onClick={refresh} style={{ marginTop: '8px' }}>Try Re-syncing</button>
              </div>
            )}
            {(sections || []).map(section => {
              const sectionTables = (tables || []).filter(t => t.sectionId === section.id);
              if (sectionTables.length === 0) return null;
              return (
                <div key={section.id} className="staff-section">
                  <div className="staff-section-header" style={{ '--sec-color': section.color }}>
                    <span>{section.icon} {section.name}</span>
                    <span className="staff-section-count">{sectionTables.filter(t => t.status === 'occupied').length}/{sectionTables.length}</span>
                  </div>
                  <div className="staff-table-grid">
                    {sectionTables.map(table => (
                      <div key={table.id} className={`staff-table-card ${table.status || 'available'}`} onClick={() => handleTableClick(table)}>
                        <div className="staff-table-label">{table.label}</div>
                        <div className={`staff-table-status ${table.status || 'available'}`}>
                          {table.status === 'available' ? 'FREE' : table.status === 'occupied' ? 'BUSY' : (table.status || 'FREE').toUpperCase()}
                        </div>
                        {table.customerName && <div className="staff-table-customer">{table.customerName}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {customerModal && (
          <div className="modal-backdrop" onClick={() => setCustomerModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
              <div className="modal-header">
                <h3 className="modal-title">NEW ORDER — {customerModal.label}</h3>
                <button className="btn btn-ghost btn-icon" onClick={() => setCustomerModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">Customer Name (Optional)</label>
                  <input className="input" placeholder="Enter name..." value={customerName}
                    onChange={e => setCustomerName(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleStartOrder(); }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setCustomerModal(null)}>Cancel</button>
                <button className="btn btn-success btn-lg" onClick={handleStartOrder} disabled={busy}>
                  {busy ? 'STARTING...' : 'START ORDER'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }



  return (
    <div className="staff-mobile">
      <div className="staff-order-header">
        <button className="staff-back-btn" onClick={handleBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="staff-order-table-info">
          <div className="staff-order-table-name">{selectedTable?.label || 'Table'}</div>
          {selectedTable?.customerName && <div className="staff-order-customer">{selectedTable.customerName}</div>}
        </div>
        <button className="staff-kot-btn" onClick={handlePrintSplitKOT} disabled={safeItems.length === 0}>
          <Printer size={14} /> KOT
        </button>
        <button className="staff-bill-btn" onClick={() => setBillModal(true)} disabled={safeItems.length === 0}>
          <Receipt size={14} /> BILL
        </button>
      </div>

      {safeItems.length > 0 && (
        <>
        <div className="staff-order-items">
          <div className="staff-order-items-header">
            <span>ORDER ({safeItems.length})</span>
            <span className="staff-order-total">{config.currency}{subtotal}</span>
          </div>
          <div className="staff-order-items-list">
            {depts.map(dept => {
               const deptCatIds = categories.filter(c => c.type === dept.id).map(c => c.id);
               const deptOrderItems = safeItems.filter(i => deptCatIds.includes(i.categoryId));
               if (deptOrderItems.length === 0) return null;
               return (
                 <div key={dept.id}>
                   <div className="staff-order-section-label"><Package size={12} /> {dept.name.toUpperCase()} ({deptOrderItems.length})</div>
                   {deptOrderItems.map(item => <OrderItemRow key={item.id} item={item} config={config} busy={busy}
                     onQty={handleQtyChange} onRemove={handleRemoveItem} onNote={(it) => { setNoteModal(it); setNoteText(it.note || ''); }} />)}
                 </div>
               );
            })}
          </div>
        </div>
        <div style={{ padding: '0 12px 12px 12px' }}>
            <button className="btn btn-ghost" style={{ color: 'var(--brand-danger)', width: '100%', fontSize: '12px' }} onClick={handleCancelOrder} disabled={busy}>
              CANCEL ORDER
            </button>
        </div>
        </>
      )}

      <div className="staff-menu-search">
        <Search size={16} />
        <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {searchQuery && <button className="staff-search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
      </div>

      <div className="staff-menu-toggle" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {depts.map(dept => (
          <button key={dept.id} className={`staff-toggle-btn ${activeDeptId === dept.id ? 'active' : ''}`}
            onClick={() => { setActiveDeptId(dept.id); setActiveCategory('all'); }}>
            {dept.name.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="staff-category-scroll">
        <button className={`staff-cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}>ALL</button>
        {deptCategories.map(cat => (
          <button key={cat.id} className={`staff-cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}>{cat.icon} {cat.name}</button>
        ))}
      </div>

      <div className="staff-menu-grid">
        {filteredItems.map(item => {
          const isOOS = false; // Bypass OOS completely so items can be selected unconditionally
          return (
            <div
              key={item.id}
              className={`staff-menu-card ${isOOS ? 'oos' : ''}`}
              onClick={() => !isOOS && handleAddItem(item)}
              style={busy && !isOOS ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
            >
              <div className="staff-menu-card-name">{item.name}</div>
              <div className="staff-menu-card-bottom">
                <span className="staff-menu-card-price">{config.currency}{item.price}</span>
              </div>
              {isOOS && <div className="staff-oos-badge">OUT</div>}
            </div>
          );
        })}
        {filteredItems.length === 0 && <div className="staff-empty">No items found</div>}
      </div>

      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 className="modal-title">NOTE — {noteModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setNoteModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <textarea className="input" placeholder="e.g., No ice, extra lime..." value={noteText}
                onChange={e => setNoteText(e.target.value)} rows={2} autoFocus />
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                {['No ice', 'Extra lime', 'On the rocks', 'Neat', 'With soda', 'Spicy', 'Less salt'].map(q => (
                  <button key={q} className="btn btn-sm btn-secondary" onClick={() => setNoteText(prev => prev ? `${prev}, ${q}` : q)}>{q}</button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNoteModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddNote} disabled={busy}>Save</button>
            </div>
          </div>
        </div>
      )}

      {billModal && (
        <div className="modal-backdrop" onClick={() => setBillModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 className="modal-title">BILL — {selectedTable?.label || 'Table'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setBillModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '12px', maxHeight: '200px', overflow: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                {safeItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
                    <span>{item.name} ×{item.quantity}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{config.currency}{(item.price || 0) * (item.quantity || 0)}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>PAYMENT</div>
              <div className="payment-modes" style={{ marginBottom: '12px' }}>
                {[{ mode: 'Cash', icon: Banknote }, { mode: 'Card', icon: CreditCard }, { mode: 'UPI', icon: Smartphone }].map(p => (
                  <button key={p.mode} className={`payment-mode-btn ${paymentMode === p.mode ? 'active' : ''}`}
                    onClick={() => setPaymentMode(p.mode)}><p.icon size={18} /><span>{p.mode}</span></button>
                ))}
              </div>
              <div className="input-group">
                <label className="input-label">Discount (%)</label>
                <input type="number" className="input" value={discount}
                  onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} min="0" max="100" />
              </div>
              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                <div className="order-summary-row"><span>Subtotal</span><span>{config.currency}{subtotal}</span></div>
                {(config.taxRate || 0) > 0 && <div className="order-summary-row"><span>Tax {config.taxRate}%</span><span>{config.currency}{Math.round(tax)}</span></div>}
                {discount > 0 && <div className="order-summary-row" style={{ color: 'var(--brand-success)' }}><span>Discount {discount}%</span><span>-{config.currency}{Math.round(discountAmt)}</span></div>}
                <div className="order-summary-row total"><span>TOTAL</span><span>{config.currency}{Math.round(total)}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setBillModal(false)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleGenerateBill} disabled={busy}>
                <Receipt size={14} /> {busy ? 'GENERATING...' : 'GENERATE & PRINT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Extracted to prevent re-render issues
function OrderItemRow({ item, config, busy, onQty, onRemove, onNote }) {
  return (
    <div className="staff-order-item">
      <div className="staff-order-item-left">
        <div className="staff-order-item-details">
          <div className="staff-order-item-name">{item.name}</div>
          {item.note && <div className="staff-order-item-note">→ {item.note}</div>}
        </div>
      </div>
      <div className="staff-order-item-right">
        <div className="staff-qty-controls">
          <button className="staff-qty-btn" onClick={() => onQty(item.id, -1)} disabled={busy}><Minus size={12} /></button>
          <span className="staff-qty-val">{item.quantity}</span>
          <button className="staff-qty-btn" onClick={() => onQty(item.id, 1)} disabled={busy}><Plus size={12} /></button>
        </div>
        <div className="staff-order-item-price">{config.currency}{(item.price || 0) * (item.quantity || 0)}</div>
        <div className="staff-order-item-actions">
          <button className="staff-action-btn" onClick={() => onNote(item)}><StickyNote size={12} /></button>
          <button className="staff-action-btn danger" onClick={() => onRemove(item.id)} disabled={busy}><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}
