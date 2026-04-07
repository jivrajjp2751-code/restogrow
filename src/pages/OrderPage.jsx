import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  updateTable, createOrder, generateBill,
} from '../store/data';
import { printSplitKOT, printKitchenKOT, printBarKOT, printBillDirect } from '../utils/print';
import { Search, ArrowLeft, Plus, Minus, Trash2, StickyNote, Printer, Wine, Coffee, CreditCard, Banknote, Smartphone, Receipt } from 'lucide-react';

export default function OrderPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { tables, menuItems, categories, config, refresh, currentUser } = useApp();
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const table = tables.find(t => t.id === tableId);
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

  useEffect(() => {
    if (table) {
      const loadOrder = async () => {
        let existingOrder = await getOrderForTable(tableId);
        if (!existingOrder && table.status === 'available') {
          await createOrder(tableId, table.label || `T${table.number}`);
          existingOrder = await getOrderForTable(tableId);
          refresh();
        }
        setOrder(existingOrder);
      };
      loadOrder();
    }
  }, [tableId, table]);

  const refreshOrder = async () => {
    const updated = await getOrderForTable(tableId);
    setOrder(updated);
    refresh();
  };

  // Classify categories
  const barCategories = categories.filter(c => c.type === 'bar');
  const kitchenCategories = categories.filter(c => c.type === 'kitchen');
  const barCatIds = barCategories.map(c => c.id);
  const kitchenCatIds = kitchenCategories.map(c => c.id);

  // Filter items
  const isSearching = searchQuery.length > 0;
  const q = searchQuery.toLowerCase();

  const barItems = useMemo(() => {
    let items = menuItems.filter(i => barCatIds.includes(i.categoryId));
    if (barCategory !== 'all') items = items.filter(i => i.categoryId === barCategory);
    if (isSearching) items = items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
    return items;
  }, [menuItems, barCategory, searchQuery, barCatIds]);

  const kitchenItems = useMemo(() => {
    let items = menuItems.filter(i => kitchenCatIds.includes(i.categoryId));
    if (kitchenCategory !== 'all') items = items.filter(i => i.categoryId === kitchenCategory);
    if (isSearching) items = items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
    return items;
  }, [menuItems, kitchenCategory, searchQuery, kitchenCatIds]);

  const handleAddItem = async (menuItem) => {
    if (!order) return;
    if (menuItem.stock <= 0) { addToast(`${menuItem.name} — OUT OF STOCK`, 'error'); return; }
    try {
      const cat = categories.find(c => c.id === menuItem.categoryId);
      await addItemToOrder(order.id, { ...menuItem, categoryType: cat?.type || 'bar' });
      await refreshOrder();
      addToast(`+ ${menuItem.name}`, 'success');
    } catch (e) { addToast(e.message || 'Failed', 'error'); console.error('Add Item Error:', e); }
  };

  const handleQtyChange = async (itemId, delta) => {
    if (!order) return;
    const item = order.items.find(i => i.id === itemId);
    if (item) {
      const newQty = item.quantity + delta;
      try {
        if (newQty <= 0) await removeOrderItem(order.id, itemId);
        else await updateOrderItem(order.id, itemId, { quantity: newQty });
        await refreshOrder();
      } catch (e) { addToast('Failed', 'error'); }
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!order) return;
    try { await removeOrderItem(order.id, itemId); await refreshOrder(); }
    catch (e) { addToast('Failed', 'error'); }
  };

  const handleAddNote = async () => {
    if (!order || !noteModal) return;
    try { await updateOrderItem(order.id, noteModal.id, { note: noteText }); await refreshOrder(); }
    catch (e) { addToast('Failed', 'error'); }
    setNoteModal(null);
    setNoteText('');
  };

  const handleGoToBilling = async () => {
    if (!order || order.items.length === 0) { addToast('Add items first', 'warning'); return; }
    try {
      await updateTable(tableId, { status: 'billing' });
      refresh();
      navigate(`/billing/${order.id}`);
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  // ===== KOT PRINT OPTIONS (Admin/Counter) =====
  const handlePrintSplitKOT = () => {
    if (!order || order.items.length === 0) { addToast('No items', 'warning'); return; }
    const tableLabel = table?.label || table?.number;
    const result = printSplitKOT(order, tableLabel, categories);
    if (result.kitchenKOT && result.barKOT) addToast('Kitchen KOT + Bar KOT printed', 'success');
    else if (result.kitchenKOT) addToast('Kitchen KOT printed', 'success');
    else if (result.barKOT) addToast('Bar KOT printed', 'success');
    setShowKOTMenu(false);
  };

  const handlePrintKitchenOnly = () => {
    if (!order) return;
    const tableLabel = table?.label || table?.number;
    const success = printKitchenKOT(order, tableLabel, categories);
    if (success) addToast('Kitchen KOT printed', 'success');
    else addToast('No kitchen items', 'warning');
    setShowKOTMenu(false);
  };

  const handlePrintBarOnly = () => {
    if (!order) return;
    const tableLabel = table?.label || table?.number;
    const success = printBarKOT(order, tableLabel, categories);
    if (success) addToast('Bar KOT printed', 'success');
    else addToast('No bar items', 'warning');
    setShowKOTMenu(false);
  };

  // ===== DIRECT BILL (no KOT — for counter items) =====
  const handleDirectBill = async () => {
    if (!order || order.items.length === 0) { addToast('Add items first', 'warning'); return; }
    try {
      const result = await generateBill(order.id, paymentMode, discount);
      if (result.bill) {
        printBillDirect({...result.bill, currency: config.currency});
        refresh();
        addToast('✅ Direct bill generated & printed', 'success');
        setDirectBillModal(false);
        navigate('/tables');
      } else {
        addToast('Failed to generate bill', 'error');
      }
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const subtotal = order?.items.reduce((s, i) => s + (i.price * i.quantity), 0) || 0;
  const tax = (subtotal * config.taxRate) / 100;
  const serviceCharge = (subtotal * config.serviceChargeRate) / 100;
  const total = subtotal + tax + serviceCharge;

  // Count items by type
  const kitchenCount = order?.items.filter(i => i.categoryType === 'kitchen').length || 0;
  const barCount = order?.items.filter(i => i.categoryType !== 'kitchen').length || 0;

  if (!table) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <p className="empty-state-title">Table not found</p>
          <button className="btn btn-primary" onClick={() => navigate('/tables')}>Back</button>
        </div>
      </div>
    );
  }

  // Render a menu item card
  const renderItemCard = (item) => (
    <div
      key={item.id}
      className="menu-item-card"
      onClick={() => handleAddItem(item)}
      style={{ opacity: item.stock <= 0 ? 0.3 : 1, pointerEvents: item.stock <= 0 ? 'none' : 'auto' }}
    >
      <div className="menu-item-name">{item.name}</div>
      <div className="menu-item-code">{item.code}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px' }}>
        <div className="menu-item-price">{config.currency}{item.price}</div>
        {item.stock <= 5 && item.stock > 0 && (
          <span style={{ fontSize: '9px', color: 'var(--brand-danger)', fontFamily: 'var(--font-mono)' }}>LOW:{item.stock}</span>
        )}
        {item.stock <= 0 && <span className="badge badge-danger">OUT</span>}
      </div>
    </div>
  );

  return (
    <div className="order-layout">
      {/* Left: Menu — split into bar and kitchen horizontally */}
      <div className="menu-panel">
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/tables')} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
              {table.label || `T${table.number}`} {table.customerName && `— ${table.customerName}`}
            </div>
          </div>
          {/* KOT dropdown for admin/counter */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowKOTMenu(!showKOTMenu)}
              title="Print KOT"
            >
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

        {/* Search — searches across both */}
        <div className="search-input-wrapper">
          <Search />
          <input
            className="input"
            placeholder="Search all items..."
            value={searchQuery}
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

        {/* Two-column split: BAR | KITCHEN */}
        <div className="menu-split-container">
          {/* BAR SECTION */}
          <div className="menu-split-section bar">
            <div className="menu-split-header bar">
              <Wine size={14} />
              <span>BAR</span>
              <span style={{ fontSize: '9px', opacity: 0.6 }}>{barItems.length}</span>
            </div>
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
              {barItems.length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1/-1', padding: '12px' }}>
                  <p className="empty-state-text" style={{ fontSize: '10px' }}>No bar items</p>
                </div>
              )}
            </div>
          </div>

          {/* KITCHEN SECTION */}
          <div className="menu-split-section kitchen">
            <div className="menu-split-header kitchen">
              <Coffee size={14} />
              <span>KITCHEN</span>
              <span style={{ fontSize: '9px', opacity: 0.6 }}>{kitchenItems.length}</span>
            </div>
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
              {kitchenItems.length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1/-1', padding: '12px' }}>
                  <p className="empty-state-text" style={{ fontSize: '10px' }}>No kitchen items</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Order Panel */}
      <div className="order-panel">
        <div className="order-panel-header">
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>ORDER</span>
          <span className="badge badge-info">{order?.items.length || 0} items</span>
        </div>

        <div className="order-items-list">
          {order?.items.length > 0 ? (
            order.items.map(item => (
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
                  <button className="qty-btn" onClick={() => handleQtyChange(item.id, -1)}><Minus size={10} /></button>
                  <span className="qty-value">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => handleQtyChange(item.id, 1)}><Plus size={10} /></button>
                </div>
                <div className="order-item-price">{config.currency}{(item.price * item.quantity)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setNoteModal(item); setNoteText(item.note || ''); }}>
                    <StickyNote size={10} />
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-danger)' }} onClick={() => handleRemoveItem(item.id)}>
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

        {order?.items.length > 0 && (
          <>
            <div className="order-summary">
              <div className="order-summary-row">
                <span>Subtotal</span><span>{config.currency}{subtotal}</span>
              </div>
              {config.taxRate > 0 && (
                <div className="order-summary-row">
                  <span>Tax {config.taxRate}%</span><span>{config.currency}{Math.round(tax)}</span>
                </div>
              )}
              {config.serviceChargeRate > 0 && (
                <div className="order-summary-row">
                  <span>Service {config.serviceChargeRate}%</span><span>{config.currency}{Math.round(serviceCharge)}</span>
                </div>
              )}
              <div className="order-summary-row total">
                <span>TOTAL</span><span>{config.currency}{Math.round(total)}</span>
              </div>
            </div>
            <div className="order-actions" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr 1fr' : '1fr 1fr' }}>
              <button className="btn btn-secondary btn-lg" onClick={handlePrintSplitKOT}>
                <Printer size={14} /> KOT
              </button>
              {isAdmin && (
                <button className="btn btn-warning btn-lg" onClick={() => setDirectBillModal(true)} title="Direct bill without KOT — for counter items">
                  <Receipt size={14} /> DIRECT
                </button>
              )}
              <button className="btn btn-success btn-lg" onClick={handleGoToBilling}>
                BILL
              </button>
            </div>
          </>
        )}
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
              <textarea
                className="input"
                placeholder="e.g., No ice, extra lime..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
              />
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                {['No ice', 'Extra lime', 'On the rocks', 'Neat', 'With soda', 'Double'].map(q => (
                  <button key={q} className="btn btn-sm btn-secondary" onClick={() => setNoteText(prev => prev ? `${prev}, ${q}` : q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNoteModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddNote}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Bill Modal (no KOT — paper saving) */}
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

              {/* Items preview */}
              <div style={{ marginBottom: '12px', maxHeight: '150px', overflow: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                {order?.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
                    <span>{item.name} ×{item.quantity}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{config.currency}{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Payment mode */}
              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '8px', color: 'var(--text-secondary)' }}>PAYMENT</div>
              <div className="payment-modes" style={{ marginBottom: '12px' }}>
                {[{ mode: 'Cash', icon: Banknote }, { mode: 'Card', icon: CreditCard }, { mode: 'UPI', icon: Smartphone }].map(p => (
                  <button key={p.mode}
                    className={`payment-mode-btn ${paymentMode === p.mode ? 'active' : ''}`}
                    onClick={() => setPaymentMode(p.mode)}>
                    <p.icon size={18} />
                    <span>{p.mode}</span>
                  </button>
                ))}
              </div>

              {/* Discount */}
              <div className="input-group">
                <label className="input-label">Discount (%)</label>
                <input type="number" className="input" value={discount}
                  onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                  min="0" max="100" />
              </div>

              {/* Total */}
              <div className="order-summary-row total" style={{ marginTop: '8px' }}>
                <span>TOTAL</span>
                <span>{config.currency}{Math.round(total - (subtotal * discount / 100))}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDirectBillModal(false)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleDirectBill}>
                <Receipt size={14} /> GENERATE & PRINT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside KOT menu to close */}
      {showKOTMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowKOTMenu(false)} />
      )}
    </div>
  );
}
