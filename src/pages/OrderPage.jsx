import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  createOrder, generateBill, cancelOrder, createPrintJob
} from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';
import { Search, ArrowLeft, Plus, Minus, Trash2, StickyNote, Printer, CreditCard, Banknote, Smartphone, Receipt, Edit3 } from 'lucide-react';

export default function OrderPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { tables = [], sections = [], menuItems = [], config = {}, refresh, currentUser } = useApp();
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const table = useMemo(() => (tables || []).find(t => t.id === tableId), [tables, tableId]);
  const [order, setOrder] = useState(null);
  const depts = useMemo(() => config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}], [config]);
  const [activeDeptId, setActiveDeptId] = useState(depts[0]?.id || 'kitchen');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [showKOTMenu, setShowKOTMenu] = useState(false);
  const [directBillModal, setDirectBillModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [orderLoading, setOrderLoading] = useState(true);

  // Price editing state
  const [priceEditModal, setPriceEditModal] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  // Get section surcharge for the current table
  const tableSurcharge = useMemo(() => {
    if (!table?.sectionId || !sections?.length) return 0;
    const section = sections.find(s => s.id === table.sectionId);
    return section?.surcharge || 0;
  }, [table, sections]);

  const surchargeFactor = 1 + (tableSurcharge / 100);

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
      addToast('Order loading failed', 'error');
    } finally {
      setOrderLoading(false);
    }
  }, [tableId, table, refresh, addToast]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const safeItems = order?.items || [];
  const q = searchQuery.toLowerCase();

  const deptItems = useMemo(() => {
    return (menuItems || []).filter(i => {
      const matchDept = i.deptId === activeDeptId || (!i.deptId && activeDeptId === 'bar');
      const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q);
      return matchDept && matchSearch;
    });
  }, [menuItems, activeDeptId, q]);

  const handleAddItem = async (menuItem) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await addItemToOrder(order.id, { ...menuItem, categoryType: menuItem.deptId || 'bar' });
      await loadOrder();
      addToast(`+ ${menuItem.name}`, 'success');
    } catch { addToast('Failed', 'error'); }
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
    } catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleRemoveItem = async (itemId) => {
    if (!order || busy) return;
    setBusy(true);
    try { await removeOrderItem(order.id, itemId); await loadOrder(); }
    catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleAddNote = async () => {
    if (!order || !noteModal || busy) return;
    setBusy(true);
    try { await updateOrderItem(order.id, noteModal.id, { note: noteText }); await loadOrder(); }
    catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
    setNoteModal(null);
    setNoteText('');
  };

  // Price edit handlers
  const openPriceEdit = (item) => {
    setPriceEditModal(item);
    setEditPrice(String(item.price || ''));
  };

  const handleSavePrice = async () => {
    if (!priceEditModal || busy) return;
    const newPrice = Number(editPrice);
    if (isNaN(newPrice) || newPrice < 0) { addToast('Enter valid price', 'error'); return; }
    setBusy(true);
    try {
      await updateOrderItem(order.id, priceEditModal.id, { price: newPrice });
      await loadOrder();
      addToast(`Price updated to ${config.currency}${newPrice}`, 'success');
    } catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
    setPriceEditModal(null);
    setEditPrice('');
  };

  const handlePrintSplitKOT = async () => {
    if (!order || safeItems.length === 0) return;
    try {
      await createPrintJob('KOT', { order, tableLabel: table?.label || table?.number });
      addToast('Printing KOT...', 'info');
    } catch { addToast('Print request failed', 'error'); }
    setShowKOTMenu(false);
  };

  const handleDirectBill = async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      const result = await generateBill(order.id, paymentMode, discount);
      if (result?.bill) {
        try { await createPrintJob('BILL', { bill: result.bill }); } catch {}
        await refresh();
        navigate('/tables');
      }
    } catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };

  const subtotal = safeItems.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0);
  const total = subtotal + (subtotal * (config.taxRate || 0) / 100);

  if (orderLoading) return <div className="resto-loader"><div className="resto-logo-spin">RG</div></div>;

  return (
    <div className="order-layout">
      <div className="menu-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/tables')}><ArrowLeft size={16} /></button>
          <div style={{ fontWeight: 800, fontSize: '13px' }}>{table?.label || 'Table'}</div>
          {tableSurcharge > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '9px' }}>+{tableSurcharge}% surcharge</span>
          )}
        </div>

        <div className="search-input-wrapper">
          <Search size={14} />
          <input className="input" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <div className="category-tabs compact">
          {depts.map(dept => (
             <button key={dept.id} className={`category-tab ${activeDeptId === dept.id ? 'active' : ''}`} onClick={() => setActiveDeptId(dept.id)}>
                {dept.name}
             </button>
          ))}
        </div>

        <div className="menu-items-grid compact" style={{ padding: '10px', overflowY: 'auto', height: 'calc(100% - 140px)' }}>
          {deptItems.map(item => {
            // Show the surcharge-adjusted price in the menu
            const displayPrice = tableSurcharge > 0
              ? Math.round(item.price * surchargeFactor)
              : item.price;
            return (
              <div key={item.id} className="menu-item-card" onClick={() => handleAddItem(item)}>
                <div className="menu-item-name">{item.name}</div>
                <div className="menu-item-price">
                  {config.currency}{displayPrice}
                  {tableSurcharge > 0 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px', textDecoration: 'line-through' }}>
                      {item.price}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="order-panel">
        <div className="order-panel-header"><span>ORDER</span> <span className="badge badge-info">{safeItems.length}</span></div>
        <div className="order-items-list">
          {safeItems.map(item => (
            <div key={item.id} className="order-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '12px' }}>{item.name}</div>
                {item.note && <div style={{ fontSize: '10px', color: 'var(--brand-primary)' }}>→ {item.note}</div>}
              </div>
              <div className="qty-controls">
                <button className="qty-btn" onClick={() => handleQtyChange(item.id, -1)}>-</button>
                <span className="qty-value">{item.quantity}</span>
                <button className="qty-btn" onClick={() => handleQtyChange(item.id, 1)}>+</button>
              </div>
              <div
                style={{ width: '65px', textAlign: 'right', fontWeight: 700, cursor: 'pointer', color: 'var(--brand-success)', fontSize: '12px' }}
                onClick={() => openPriceEdit(item)}
                title="Click to edit price"
              >
                {config.currency}{item.price * item.quantity}
                <Edit3 size={9} style={{ marginLeft: '2px', opacity: 0.5 }} />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => {setNoteModal(item); setNoteText(item.note||'');}}><StickyNote size={12}/></button>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
            <span>TOTAL</span><span>{config.currency}{Math.round(total)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handlePrintSplitKOT}><Printer size={14}/> KOT</button>
            <button className="btn btn-success" onClick={() => navigate(`/billing/${order.id}`)}>BILL</button>
          </div>
        </div>
      </div>

      {/* Note Modal */}
      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'300px'}}>
            <div className="modal-header"><h3 className="modal-title">Note</h3></div>
            <div className="modal-body">
              <input className="input" value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleAddNote}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Price Edit Modal */}
      {priceEditModal && (
        <div className="modal-backdrop" onClick={() => setPriceEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '320px' }}>
            <div className="modal-header">
              <h3 className="modal-title">EDIT PRICE — {priceEditModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setPriceEditModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Price per unit ({config.currency})</label>
                <input
                  type="number"
                  className="input"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePrice(); }}
                  style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                />
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Original: {config.currency}{priceEditModal.price} × {priceEditModal.quantity} =
                {config.currency}{priceEditModal.price * priceEditModal.quantity}
              </p>
              {editPrice && Number(editPrice) !== priceEditModal.price && (
                <p style={{ fontSize: '10px', color: 'var(--brand-primary)', marginTop: '2px', fontWeight: 700 }}>
                  New: {config.currency}{Number(editPrice)} × {priceEditModal.quantity} =
                  {config.currency}{Number(editPrice) * priceEditModal.quantity}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPriceEditModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleSavePrice}>UPDATE PRICE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
