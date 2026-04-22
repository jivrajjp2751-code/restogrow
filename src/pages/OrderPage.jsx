import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  createOrder, cancelOrder, createPrintJob
} from '../store/data';
import { Search, ArrowLeft, Printer, StickyNote, Edit3, XCircle } from 'lucide-react';
import { printSplitKOT } from '../utils/print';

export default function OrderPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { tables = [], sections = [], menuItems = [], config = {}, refresh } = useApp();
  const { addToast } = useToast();

  const table = useMemo(() => (tables || []).find(t => t.id === tableId), [tables, tableId]);
  const isCancelling = React.useRef(false);
  const [order, setOrder] = useState(null);
  const depts = useMemo(() => {
    const allDepts = config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}];
    return allDepts.filter(d => {
      if (!d.section_ids || d.section_ids.length === 0) return true;
      return table?.sectionId && d.section_ids.includes(table.sectionId);
    });
  }, [config, table]);
  const [activeDeptId, setActiveDeptId] = useState(depts[0]?.id);
  useEffect(() => { if (!activeDeptId && depts.length > 0) setActiveDeptId(depts[0].id); }, [depts, activeDeptId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [orderLoading, setOrderLoading] = useState(true);
  const [priceEditModal, setPriceEditModal] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  // Get section info for the current table
  const sectionInfo = useMemo(() => {
    if (!table?.sectionId || !sections?.length) return null;
    return sections.find(s => s.id === table.sectionId) || null;
  }, [table, sections]);

  const tableSurcharge = sectionInfo?.surcharge || 0;
  const surchargeDepts = useMemo(() => sectionInfo?.surchargeDepts || [], [sectionInfo]);

  const loadOrder = useCallback(async () => {
    if (!tableId || isCancelling.current) return;
    try {
      let existingOrder = await getOrderForTable(tableId);
      if (!existingOrder && table?.status === 'available') {
        await createOrder(tableId, table.label || `T${table.number}`);
        existingOrder = await getOrderForTable(tableId);
        refresh();
      }
      setOrder(existingOrder);
    } catch {
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
      const isAllowedSection = (!i.section_ids || i.section_ids.length === 0) 
        || (table?.sectionId && i.section_ids.includes(table.sectionId));
      return matchDept && matchSearch && isAllowedSection;
    });
  }, [menuItems, activeDeptId, q, table]);

  // Check if surcharge is applicable for a given dept
  const isSurchargeApplicable = useCallback((deptId) => {
    if (tableSurcharge <= 0) return false;
    if (surchargeDepts.length === 0) return true; // empty = all
    return surchargeDepts.includes(deptId);
  }, [tableSurcharge, surchargeDepts]);

  const handleAddItem = async (menuItem) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await addItemToOrder(order.id, { ...menuItem, categoryType: menuItem.deptId || 'bar' });
      await loadOrder();
      addToast(`+ ${menuItem.name}`, 'success');
    } catch (e) { 
      console.error("ADD ITEM ERROR:", e);
      addToast(`Error: ${e.message || 'Check connection'}`, 'error'); 
    }
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

  const handleAddNote = async () => {
    if (!order || !noteModal || busy) return;
    setBusy(true);
    try { await updateOrderItem(order.id, noteModal.id, { note: noteText }); await loadOrder(); }
    catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
    setNoteModal(null);
    setNoteText('');
  };

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
      addToast(`Price → ${config.currency}${newPrice}`, 'success');
    } catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
    setPriceEditModal(null);
  };

  const handlePrintKOT = async () => {
    if (!order || !safeItems || safeItems.length === 0) {
      addToast('No items to print', 'warning');
      return;
    }
    setBusy(true);
    try {
      if (localStorage.getItem('isPrintStation') === 'true') {
        const result = printSplitKOT(order, table?.label || table?.number, null, config);
        if (result.success) addToast('KOT printed successfully', 'success');
        else addToast('No items found for departments', 'warning');
      } else {
        await createPrintJob('KOT', { order, tableLabel: table?.label || table?.number });
        addToast('KOT sent to printer queue', 'success');
      }
    } catch (e) {
      addToast('Print failed: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    if (!confirm('Cancel this order? All items will be removed.')) return;
    isCancelling.current = true;
    setBusy(true);
    try {
      await cancelOrder(order.id, tableId);
      await refresh();
      addToast('Order cancelled', 'info');
      navigate('/tables');
    } catch (e) { addToast('Cancel failed: ' + e.message, 'error'); }
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
            <span className="badge badge-warning" style={{ fontSize: '9px' }}>+{tableSurcharge}%</span>
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
              {isSurchargeApplicable(dept.id) && <span style={{ fontSize: '8px', marginLeft: '3px', color: 'var(--brand-warning)' }}>+{tableSurcharge}%</span>}
            </button>
          ))}
        </div>

        <div className="menu-items-grid compact" style={{ padding: '10px', overflowY: 'auto', height: 'calc(100% - 140px)' }}>
          {deptItems.map(item => {
            const deptApplicable = isSurchargeApplicable(item.deptId || activeDeptId);
            const displayPrice = deptApplicable
              ? Math.round(item.price * (1 + tableSurcharge / 100))
              : item.price;
            return (
              <div key={item.id} className="menu-item-card" onClick={() => handleAddItem({...item, price: displayPrice})}>
                <div className="menu-item-name">{item.name}</div>
                <div className="menu-item-price">
                  {config.currency}{displayPrice}
                  {deptApplicable && tableSurcharge > 0 && (
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
        <div className="order-panel-header">
          <span>ORDER</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="badge badge-info">{safeItems.length}</span>
            {order && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--brand-danger)', fontSize: '10px' }} onClick={handleCancelOrder}>
                <XCircle size={12} /> CANCEL ORDER
              </button>
            )}
          </div>
        </div>
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
            <button className="btn btn-secondary" onClick={handlePrintKOT}><Printer size={14}/> KOT</button>
            <button className="btn btn-success" onClick={async () => {
              setBusy(true);
              try { await refresh(); } catch { /* ignore */ }
              setBusy(false);
              navigate(`/billing/${order.id}`);
            }} disabled={busy}>BILL</button>
          </div>
        </div>
      </div>

      {/* Note Modal */}
      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'300px'}}>
            <div className="modal-header"><h3 className="modal-title">Note</h3></div>
            <div className="modal-body">
              <input className="input" value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }} />
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
                <input type="number" className="input" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSavePrice(); }}
                  style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Original: {config.currency}{priceEditModal.price} × {priceEditModal.quantity} = {config.currency}{priceEditModal.price * priceEditModal.quantity}
              </p>
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
