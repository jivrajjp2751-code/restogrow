import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  createOrder, generateBill, cancelOrder
} from '../store/data';
import { printSplitKOT, printKitchenKOT, printBarKOT, printBillDirect } from '../utils/print';
import { Search, ArrowLeft, Plus, Minus, Trash2, StickyNote, Printer, Wine, Coffee, CreditCard, Banknote, Smartphone, Receipt } from 'lucide-react';

export default function OrderPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { tables = [], menuItems = [], categories = [], config = {}, refresh, currentUser } = useApp();
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const table = useMemo(() => (tables || []).find(t => t.id === tableId), [tables, tableId]);
  const [order, setOrder] = useState(null);
  const [barCategory, setBarCategory] = useState('all');
  const [kitchenCategory, setKitchenCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [showKOTMenu, setShowKOTMenu] = useState(false);
  const [directBillModal, setDirectBillModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [orderLoading, setOrderLoading] = useState(true);

  // Load order on mount
  const loadOrder = useCallback(async () => {
    if (!tableId) return;
    try {
      let existingOrder = await getOrderForTable(tableId);
      if (!existingOrder && table?.status === 'available') {
        await createOrder(tableId, table.label || `T${table.number}`);
        existingOrder = await getOrderForTable(tableId);
        refresh();
      }
      setOrder(existingOrder);
    } catch (e) {
      console.error('Load order error:', e);
      setOrder(null);
    } finally {
      setOrderLoading(false);
    }
  }, [tableId, table]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const safeItems = order?.items || [];

  // Classify categories
  const barCategories = useMemo(() => (categories || []).filter(c => c.type === 'bar'), [categories]);
  const kitchenCategories = useMemo(() => (categories || []).filter(c => c.type === 'kitchen'), [categories]);
  const barCatIds = useMemo(() => barCategories.map(c => c.id), [barCategories]);
  const kitchenCatIds = useMemo(() => kitchenCategories.map(c => c.id), [kitchenCategories]);

  // Filter items
  const isSearching = searchQuery.length > 0;
  const q = searchQuery.toLowerCase();

  const barItems = useMemo(() => {
    let items = (menuItems || []).filter(i => barCatIds.includes(i.categoryId));
    if (barCategory !== 'all') items = items.filter(i => i.categoryId === barCategory);
    if (isSearching) items = items.filter(i => i.name?.toLowerCase().includes(q) || i.code?.toLowerCase()?.includes(q));
    return items;
  }, [menuItems, barCategory, searchQuery, barCatIds]);

  const kitchenItems = useMemo(() => {
    let items = (menuItems || []).filter(i => kitchenCatIds.includes(i.categoryId));
    if (kitchenCategory !== 'all') items = items.filter(i => i.categoryId === kitchenCategory);
    if (isSearching) items = items.filter(i => i.name?.toLowerCase().includes(q) || i.code?.toLowerCase()?.includes(q));
    return items;
  }, [menuItems, kitchenCategory, searchQuery, kitchenCatIds]);

  const handleAddItem = async (menuItem) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      const cat = (categories || []).find(c => c.id === menuItem.categoryId);
      await addItemToOrder(order.id, { ...menuItem, categoryType: cat?.type || 'bar' });
      await loadOrder();
      addToast(`+ ${menuItem.name}`, 'success');
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
    finally { setBusy(false); }
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
    } catch (e) { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleRemoveItem = async (itemId) => {
    if (!order || busy) return;
    setBusy(true);
    try { await removeOrderItem(order.id, itemId); await loadOrder(); }
    catch (e) { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleAddNote = async () => {
    if (!order || !noteModal || busy) return;
    setBusy(true);
    try { await updateOrderItem(order.id, noteModal.id, { note: noteText }); await loadOrder(); }
    catch (e) { addToast('Failed', 'error'); }
    finally { setBusy(false); }
    setNoteModal(null);
    setNoteText('');
  };

  const handleGoToBilling = async () => {
    if (!order || safeItems.length === 0) { addToast('Add items first', 'warning'); return; }
    navigate(`/billing/${order.id}`);
  };

  // KOT print
  const handlePrintSplitKOT = () => {
    if (!order || safeItems.length === 0) { addToast('No items', 'warning'); return; }
    try {
      const tableLabel = table?.label || table?.number;
      const result = printSplitKOT(order, tableLabel, categories);
      if (result?.kitchenKOT && result?.barKOT) addToast('Kitchen KOT + Bar KOT printed', 'success');
      else if (result?.kitchenKOT) addToast('Kitchen KOT printed', 'success');
      else if (result?.barKOT) addToast('Bar KOT printed', 'success');
      else addToast('KOT sent', 'success');
    } catch (e) { addToast('Print failed', 'error'); }
    setShowKOTMenu(false);
  };

  const handlePrintKitchenOnly = () => {
    if (!order) return;
    try {
      const tableLabel = table?.label || table?.number;
      const success = printKitchenKOT(order, tableLabel, categories);
      addToast(success ? 'Kitchen KOT printed' : 'No kitchen items', success ? 'success' : 'warning');
    } catch (e) { addToast('Print failed', 'error'); }
    setShowKOTMenu(false);
  };

  const handlePrintBarOnly = () => {
    if (!order) return;
    try {
      const tableLabel = table?.label || table?.number;
      const success = printBarKOT(order, tableLabel, categories);
      addToast(success ? 'Bar KOT printed' : 'No bar items', success ? 'success' : 'warning');
    } catch (e) { addToast('Print failed', 'error'); }
    setShowKOTMenu(false);
  };

  // Direct bill
  const handleCancelOrder = async () => {
    if (!order || busy) return;
    if (!window.confirm('Cancel this order and free the table?')) return;
    setBusy(true);
    try {
      await cancelOrder(order.id, table.id);
      await refresh();
      addToast('Order cancelled', 'info');
      navigate('/tables');
    } catch (e) {
      addToast('Failed: ' + (e.message || ''), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDirectBill = async () => {
    if (!order || safeItems.length === 0 || busy) return;
    setBusy(true);
    try {
      const result = await generateBill(order.id, paymentMode, discount);
      if (result?.bill) {
        try { printBillDirect({ ...result.bill, currency: config.currency }); } catch {}
        await refresh();
        addToast('Direct bill generated & printed', 'success');
        setDirectBillModal(false);
        navigate('/tables');
      } else {
        addToast('Failed to generate bill', 'error');
      }
    } catch (e) { addToast('Failed: ' + (e.message || ''), 'error'); }
    finally { setBusy(false); }
  };

  const subtotal = safeItems.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0);
  const tax = (subtotal * (config.taxRate || 0)) / 100;
  const serviceCharge = (subtotal * (config.serviceChargeRate || 0)) / 100;
  const total = subtotal + tax + serviceCharge;
  const kitchenCount = safeItems.filter(i => i.categoryType === 'kitchen').length;
  const barCount = safeItems.filter(i => i.categoryType !== 'kitchen').length;

  if (!table && !orderLoading) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <p className="empty-state-title">Table not found</p>
          <button className="btn btn-primary" onClick={() => navigate('/tables')}>Back</button>
        </div>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div className="page-content">
        <div className="resto-loader">
          <div className="resto-logo-spin">RG</div>
          <div className="resto-loader-text">Loading order...</div>
        </div>
      </div>
    );
  }

  const renderItemCard = (item) => {
    // Only gray out if they are actively using stock tracking (e.g. stock <= 0 and they manually manage it)
    // To prevent false blockages, we won't block clicking here anymore.
    const isOOS = false; // Bypass visual OOS for now so users can select unconditionally
    return (
      <div
        key={item.id}
        className="menu-item-card"
        onClick={() => !isOOS && handleAddItem(item)}
        style={{
          opacity: isOOS ? 0.25 : busy ? 0.6 : 1,
          pointerEvents: isOOS || busy ? 'none' : 'auto',
          filter: isOOS ? 'grayscale(1)' : undefined,
        }}
      >
        <div className="menu-item-name">{item.name}</div>
        {item.code && <div className="menu-item-code">{item.code}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
          <div className="menu-item-price">{config.currency}{item.price}</div>
          {item.stock !== undefined && item.stock !== null && item.stock <= 5 && item.stock > 0 && (
            <span style={{ fontSize: '9px', color: 'var(--brand-danger)', fontFamily: 'var(--font-mono)' }}>LOW:{item.stock}</span>
          )}
          {isOOS && <span className="badge badge-danger">OUT</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="order-layout">
      {/* Left: Menu */}
      <div className="menu-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/tables')} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
              {table?.label || `T${table?.number}`} {table?.customerName && `— ${table.customerName}`}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowKOTMenu(!showKOTMenu)} title="Print KOT">
              <Printer size={12} /> KOT ▾
            </button>
            {showKOTMenu && (
              <div className="kot-dropdown">
                <button className="kot-dropdown-item" onClick={handlePrintSplitKOT}>
                  <Printer size={12} /> <span>Print All KOT</span>
                  <span className="kot-dropdown-sub">Kitchen + Bar auto‑split</span>
                </button>
                <button className="kot-dropdown-item kitchen" onClick={handlePrintKitchenOnly}>
                  <Coffee size={12} /> <span>Kitchen KOT Only</span>
                  <span className="kot-dropdown-sub">{kitchenCount} kitchen items</span>
                </button>
                <button className="kot-dropdown-item bar" onClick={handlePrintBarOnly}>
                  <Wine size={12} /> <span>Bar KOT Only</span>
                  <span className="kot-dropdown-sub">{barCount} bar items</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="search-input-wrapper">
          <Search />
          <input className="input" placeholder="Search all items..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const allResults = [...barItems, ...kitchenItems];
                if (allResults.length === 1) { handleAddItem(allResults[0]); setSearchQuery(''); }
              }
              if (e.key === 'Escape') { setSearchQuery(''); e.target.blur(); }
            }}
          />
        </div>

        <div className="menu-split-container">
          <div className="menu-split-section bar">
            <div className="menu-split-header bar"><Wine size={14} /><span>BAR</span><span style={{ fontSize: '9px', opacity: 0.6 }}>{barItems.length}</span></div>
            {!isSearching && (
              <div className="category-tabs compact">
                <button className={`category-tab ${barCategory === 'all' ? 'active' : ''}`} onClick={() => setBarCategory('all')}>ALL</button>
                {barCategories.map(cat => (
                  <button key={cat.id} className={`category-tab ${barCategory === cat.id ? 'active' : ''}`} onClick={() => setBarCategory(cat.id)}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            )}
            <div className="menu-items-grid compact">
              {barItems.map(renderItemCard)}
              {barItems.length === 0 && <div className="empty-state" style={{ gridColumn: '1/-1', padding: '12px' }}><p className="empty-state-text" style={{ fontSize: '10px' }}>No bar items</p></div>}
            </div>
          </div>

          <div className="menu-split-section kitchen">
            <div className="menu-split-header kitchen"><Coffee size={14} /><span>KITCHEN</span><span style={{ fontSize: '9px', opacity: 0.6 }}>{kitchenItems.length}</span></div>
            {!isSearching && (
              <div className="category-tabs compact">
                <button className={`category-tab ${kitchenCategory === 'all' ? 'active' : ''}`} onClick={() => setKitchenCategory('all')}>ALL</button>
                {kitchenCategories.map(cat => (
                  <button key={cat.id} className={`category-tab ${kitchenCategory === cat.id ? 'active' : ''}`} onClick={() => setKitchenCategory(cat.id)}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            )}
            <div className="menu-items-grid compact">
              {kitchenItems.map(renderItemCard)}
              {kitchenItems.length === 0 && <div className="empty-state" style={{ gridColumn: '1/-1', padding: '12px' }}><p className="empty-state-text" style={{ fontSize: '10px' }}>No kitchen items</p></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Order Panel */}
      <div className="order-panel">
        <div className="order-panel-header">
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>ORDER</span>
          <span className="badge badge-info">{safeItems.length} items</span>
        </div>

        <div className="order-items-list">
          {safeItems.length > 0 ? (
            safeItems.map(item => (
              <div key={item.id} className="order-item">
                <div className="order-item-info">
                  <div className="order-item-name">
                    {item.name}
                    <span style={{
                      fontSize: '8px', marginLeft: '4px', padding: '1px 3px',
                      borderRadius: '2px', fontWeight: 700,
                      background: item.categoryType === 'kitchen' ? 'rgba(253, 203, 110, 0.2)' : 'rgba(108, 92, 231, 0.2)',
                      color: item.categoryType === 'kitchen' ? 'var(--brand-warning)' : 'var(--brand-primary-light)',
                    }}>
                      {item.categoryType === 'kitchen' ? 'K' : 'B'}
                    </span>
                  </div>
                  {item.note && <div className="order-item-note">→ {item.note}</div>}
                </div>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => handleQtyChange(item.id, -1)} disabled={busy}><Minus size={10} /></button>
                  <span className="qty-value">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => handleQtyChange(item.id, 1)} disabled={busy}><Plus size={10} /></button>
                </div>
                <div className="order-item-price">{config.currency}{(item.price || 0) * (item.quantity || 0)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setNoteModal(item); setNoteText(item.note || ''); }}>
                    <StickyNote size={10} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={() => handleRemoveItem(item.id)} disabled={busy}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p className="empty-state-title" style={{ fontSize: '11px' }}>Empty</p>
              <p className="empty-state-text">Click items to add</p>
            </div>
          )}
        </div>

        {/* Order Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', padding: '12px' }}>
          {safeItems.length > 0 && (
            <div className="order-actions" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <button className="btn btn-secondary btn-lg" onClick={handlePrintSplitKOT}><Printer size={14} /> KOT</button>
              {isAdmin && (
                <button className="btn btn-warning btn-lg" onClick={() => setDirectBillModal(true)} title="Direct bill without KOT">
                  <Receipt size={14} /> DIRECT
                </button>
              )}
              <button className="btn btn-success btn-lg" onClick={handleGoToBilling}>BILL</button>
            </div>
          )}
          <button className="btn btn-ghost" style={{ color: 'var(--brand-danger)', width: '100%' }} onClick={handleCancelOrder} disabled={busy}>
             CANCEL ORDER
          </button>
        </div>
      </div>

      {/* Note Modal */}
      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">NOTE — {noteModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setNoteModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <textarea className="input" placeholder="e.g., No ice, extra lime..." value={noteText}
                onChange={e => setNoteText(e.target.value)} rows={2} autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
              />
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                {['No ice', 'Extra lime', 'On the rocks', 'Neat', 'With soda', 'Double'].map(q => (
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

      {/* Direct Bill Modal */}
      {directBillModal && (
        <div className="modal-backdrop" onClick={() => setDirectBillModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">DIRECT BILL — No KOT</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setDirectBillModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Generate bill directly without printing KOT. Ideal for counter items and takeaway.
              </p>
              <div style={{ marginBottom: '12px', maxHeight: '150px', overflow: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                {safeItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
                    <span>{item.name} ×{item.quantity}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{config.currency}{(item.price || 0) * (item.quantity || 0)}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '8px', color: 'var(--text-secondary)' }}>PAYMENT</div>
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
              <div className="order-summary-row total" style={{ marginTop: '8px' }}>
                <span>TOTAL</span>
                <span>{config.currency}{Math.round(total - (subtotal * discount / 100))}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDirectBillModal(false)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleDirectBill} disabled={busy}>
                <Receipt size={14} /> {busy ? 'GENERATING...' : 'GENERATE & PRINT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showKOTMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowKOTMenu(false)} />}
    </div>
  );
}
