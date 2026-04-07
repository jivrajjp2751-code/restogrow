import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  updateTable, createOrder, generateBill,
} from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';
import {
  Search, Plus, Minus, Trash2, ArrowLeft, Printer, Wine, Coffee,
  X, StickyNote, LogOut, Receipt, CreditCard, Banknote, Smartphone
} from 'lucide-react';

export default function StaffMobileDashboard() {
  const { tables, sections, menuItems, categories, config, refresh, currentSession, logout } = useApp();
  const { addToast } = useToast();

  const [selectedTable, setSelectedTable] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuTab, setActiveMenuTab] = useState('bar');
  const [activeCategory, setActiveCategory] = useState('all');
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [customerModal, setCustomerModal] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [billModal, setBillModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [order, setOrder] = useState(null);

  // Load order for selected table
  const loadOrder = useCallback(async () => {
    if (selectedTable) {
      try {
        const existingOrder = await getOrderForTable(selectedTable.id);
        setOrder(existingOrder);
      } catch { setOrder(null); }
    } else {
      setOrder(null);
    }
  }, [selectedTable]);

  useEffect(() => { loadOrder(); }, [loadOrder, tables]);

  const refreshOrder = useCallback(async () => {
    await loadOrder();
    refresh();
  }, [loadOrder, refresh]);

  const barCategories = categories.filter(c => c.type === 'bar');
  const kitchenCategories = categories.filter(c => c.type === 'kitchen');

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const tabCats = activeMenuTab === 'bar' ? barCategories : kitchenCategories;
    const tabCatIds = tabCats.map(c => c.id);
    let items = menuItems.filter(i => tabCatIds.includes(i.categoryId));
    if (activeCategory !== 'all') items = items.filter(i => i.categoryId === activeCategory);
    if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q));
    return items;
  }, [menuItems, activeMenuTab, activeCategory, searchQuery, barCategories, kitchenCategories]);

  const handleTableClick = async (table) => {
    if (!currentSession) { addToast('Start a session first!', 'warning'); return; }
    if (table.status === 'available') {
      setCustomerModal(table);
    } else {
      setSelectedTable(table);
    }
  };

  const handleStartOrder = async () => {
    if (!customerModal) return;
    const table = customerModal;
    try {
      await createOrder(table.id, table.label || `T${table.number}`, customerName);
      refresh();
      addToast(`${table.label} — Order started`, 'success');
      setCustomerModal(null);
      setCustomerName('');
      setSelectedTable(table);
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handleAddItem = async (menuItem) => {
    if (!order) return;
    if (menuItem.stock <= 0) { addToast(`${menuItem.name} — OUT OF STOCK`, 'error'); return; }
    try {
      const cat = categories.find(c => c.id === menuItem.categoryId);
      await addItemToOrder(order.id, { ...menuItem, categoryType: cat?.type || 'bar' });
      await refreshOrder();
      addToast(`+ ${menuItem.name}`, 'success');
    } catch (e) { addToast('Failed', 'error'); }
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
    try {
      await removeOrderItem(order.id, itemId);
      await refreshOrder();
    } catch (e) { addToast('Failed', 'error'); }
  };

  const handleAddNote = async () => {
    if (!order || !noteModal) return;
    try {
      await updateOrderItem(order.id, noteModal.id, { note: noteText });
      await refreshOrder();
      setNoteModal(null);
      setNoteText('');
    } catch (e) { addToast('Failed', 'error'); }
  };

  const handlePrintSplitKOT = () => {
    if (!order || order.items.length === 0) { addToast('No items to print', 'warning'); return; }
    const tableLabel = selectedTable?.label || selectedTable?.number;
    const result = printSplitKOT(order, tableLabel, categories);
    if (result.kitchenKOT && result.barKOT) addToast('✅ Kitchen KOT + Bar KOT printed', 'success');
    else if (result.kitchenKOT) addToast('✅ Kitchen KOT printed', 'success');
    else if (result.barKOT) addToast('✅ Bar KOT printed', 'success');
  };

  const handleGenerateBill = async () => {
    if (!order || order.items.length === 0) return;
    try {
      const result = await generateBill(order.id, paymentMode, discount);
      if (result.bill) {
        printBillDirect({ ...result.bill, currency: config.currency });
        refresh();
        addToast('✅ Bill generated & printed', 'success');
        setBillModal(false);
        setSelectedTable(null);
      } else {
        addToast('Failed', 'error');
      }
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const subtotal = order?.items.reduce((s, i) => s + (i.price * i.quantity), 0) || 0;
  const tax = (subtotal * (config.taxRate || 0)) / 100;
  const serviceCharge = (subtotal * (config.serviceChargeRate || 0)) / 100;
  const discountAmt = (subtotal * discount) / 100;
  const total = subtotal + tax + serviceCharge - discountAmt;

  const barOrderItems = order?.items.filter(i => i.categoryType !== 'kitchen') || [];
  const kitchenOrderItems = order?.items.filter(i => i.categoryType === 'kitchen') || [];

  // ===== TABLE VIEW =====
  if (!selectedTable) {
    return (
      <div className="staff-mobile">
        <div className="staff-mobile-header">
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
          <button className="staff-logout-btn" onClick={logout}><LogOut size={16} /></button>
        </div>

        <div className="staff-tables-scroll">
          {sections.map(section => {
            const sectionTables = tables.filter(t => t.sectionId === section.id);
            if (sectionTables.length === 0) return null;
            return (
              <div key={section.id} className="staff-section">
                <div className="staff-section-header" style={{ '--sec-color': section.color }}>
                  <span>{section.icon} {section.name}</span>
                  <span className="staff-section-count">{sectionTables.filter(t => t.status === 'occupied').length}/{sectionTables.length}</span>
                </div>
                <div className="staff-table-grid">
                  {sectionTables.map(table => (
                    <div key={table.id} className={`staff-table-card ${table.status}`} onClick={() => handleTableClick(table)}>
                      <div className="staff-table-label">{table.label}</div>
                      <div className={`staff-table-status ${table.status}`}>
                        {table.status === 'available' ? 'FREE' : table.status === 'occupied' ? 'BUSY' : table.status.toUpperCase()}
                      </div>
                      {table.customerName && <div className="staff-table-customer">{table.customerName}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

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
                <button className="btn btn-success btn-lg" onClick={handleStartOrder}>START ORDER</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== ORDER VIEW =====
  const activeCats = activeMenuTab === 'bar' ? barCategories : kitchenCategories;

  return (
    <div className="staff-mobile">
      <div className="staff-order-header">
        <button className="staff-back-btn" onClick={() => { setSelectedTable(null); setSearchQuery(''); setActiveCategory('all'); }}>
          <ArrowLeft size={18} />
        </button>
        <div className="staff-order-table-info">
          <div className="staff-order-table-name">{selectedTable.label}</div>
          {selectedTable.customerName && <div className="staff-order-customer">{selectedTable.customerName}</div>}
        </div>
        <button className="staff-kot-btn" onClick={handlePrintSplitKOT} disabled={!order || order.items.length === 0}>
          <Printer size={14} /> KOT
        </button>
        <button className="staff-bill-btn" onClick={() => setBillModal(true)} disabled={!order || order.items.length === 0}>
          <Receipt size={14} /> BILL
        </button>
      </div>

      {order && order.items.length > 0 && (
        <div className="staff-order-items">
          <div className="staff-order-items-header">
            <span>ORDER ({order.items.length})</span>
            <span className="staff-order-total">{config.currency}{subtotal}</span>
          </div>
          <div className="staff-order-items-list">
            {barOrderItems.length > 0 && (
              <>
                <div className="staff-order-section-label bar"><Wine size={12} /> BAR ({barOrderItems.length})</div>
                {barOrderItems.map(item => renderOrderItem(item))}
              </>
            )}
            {kitchenOrderItems.length > 0 && (
              <>
                <div className="staff-order-section-label kitchen"><Coffee size={12} /> KITCHEN ({kitchenOrderItems.length})</div>
                {kitchenOrderItems.map(item => renderOrderItem(item))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="staff-menu-search">
        <Search size={16} />
        <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {searchQuery && <button className="staff-search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
      </div>

      <div className="staff-menu-toggle">
        <button className={`staff-toggle-btn ${activeMenuTab === 'bar' ? 'active bar' : ''}`}
          onClick={() => { setActiveMenuTab('bar'); setActiveCategory('all'); }}>
          <Wine size={14} /> BAR
        </button>
        <button className={`staff-toggle-btn ${activeMenuTab === 'kitchen' ? 'active kitchen' : ''}`}
          onClick={() => { setActiveMenuTab('kitchen'); setActiveCategory('all'); }}>
          <Coffee size={14} /> KITCHEN
        </button>
      </div>

      <div className="staff-category-scroll">
        <button className={`staff-cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}>ALL</button>
        {activeCats.map(cat => (
          <button key={cat.id} className={`staff-cat-tab ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}>{cat.icon} {cat.name}</button>
        ))}
      </div>

      <div className="staff-menu-grid">
        {filteredItems.map(item => {
          const isOOS = item.stock <= 0;
          return (
            <div key={item.id} className={`staff-menu-card ${isOOS ? 'oos' : ''}`}
              onClick={() => !isOOS && handleAddItem(item)}>
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
              <button className="btn btn-primary" onClick={handleAddNote}>Save</button>
            </div>
          </div>
        </div>
      )}

      {billModal && (
        <div className="modal-backdrop" onClick={() => setBillModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 className="modal-title">BILL — {selectedTable.label}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setBillModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '12px', maxHeight: '200px', overflow: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                {order?.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
                    <span>{item.name} ×{item.quantity}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{config.currency}{item.price * item.quantity}</span>
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
                  onChange={e => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))} min="0" max="100" />
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
              <button className="btn btn-success btn-lg" onClick={handleGenerateBill}>
                <Receipt size={14} /> GENERATE & PRINT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderOrderItem(item) {
    return (
      <div key={item.id} className="staff-order-item">
        <div className="staff-order-item-left">
          <div className="staff-order-item-details">
            <div className="staff-order-item-name">{item.name}</div>
            {item.note && <div className="staff-order-item-note">→ {item.note}</div>}
          </div>
        </div>
        <div className="staff-order-item-right">
          <div className="staff-qty-controls">
            <button className="staff-qty-btn" onClick={() => handleQtyChange(item.id, -1)}><Minus size={12} /></button>
            <span className="staff-qty-val">{item.quantity}</span>
            <button className="staff-qty-btn" onClick={() => handleQtyChange(item.id, 1)}><Plus size={12} /></button>
          </div>
          <div className="staff-order-item-price">{config.currency}{item.price * item.quantity}</div>
          <div className="staff-order-item-actions">
            <button className="staff-action-btn" onClick={() => { setNoteModal(item); setNoteText(item.note || ''); }}><StickyNote size={12} /></button>
            <button className="staff-action-btn danger" onClick={() => handleRemoveItem(item.id)}><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
    );
  }
}
