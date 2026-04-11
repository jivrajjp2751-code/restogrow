import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp, useToast } from '../context/AppContext';
import {
  getOrderForTable, addItemToOrder, updateOrderItem, removeOrderItem,
  createOrder, generateBill, cancelOrder, createPrintJob
} from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';
import {
  Search, Plus, Minus, Trash2, ArrowLeft, Printer, Wine, Coffee,
  X, StickyNote, LogOut, Receipt, CreditCard, Banknote, Smartphone, RefreshCw, Package
} from 'lucide-react';

export default function StaffMobileDashboard() {
  const { tables = [], sections = [], menuItems = [], config = {}, refresh, currentSession, logout, refreshing = false } = useApp();
  const { addToast } = useToast();

  const [selectedTableId, setSelectedTableId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedTable = useMemo(() => tables.find(t => t.id === selectedTableId) || null, [tables, selectedTableId]);

  const depts = useMemo(() => {
    const allDepts = config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}];
    return allDepts.filter(d => {
       if (!d.section_ids || d.section_ids.length === 0) return true;
       return selectedTable?.sectionId && d.section_ids.includes(selectedTable.sectionId);
    });
  }, [config, selectedTable]);

  const [activeDeptId, setActiveDeptId] = useState(depts[0]?.id);
  useEffect(() => { if (!activeDeptId && depts.length > 0) setActiveDeptId(depts[0].id); }, [depts]);
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [customerModal, setCustomerModal] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [billModal, setBillModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);



  const loadOrder = useCallback(async () => {
    if (!selectedTableId) { setOrder(null); return; }
    try {
      const o = await getOrderForTable(selectedTableId);
      setOrder(o);
    } catch { setOrder(null); }
  }, [selectedTableId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (menuItems || []).filter(i => {
      const matchDept = i.deptId === activeDeptId || (!i.deptId && activeDeptId === 'bar');
      const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q);
      const isAllowedSection = (!i.section_ids || i.section_ids.length === 0) 
        || (selectedTable?.sectionId && i.section_ids.includes(selectedTable.sectionId));
      return matchDept && matchSearch && isAllowedSection;
    });
  }, [menuItems, activeDeptId, searchQuery, selectedTable]);

  const handleTableClick = (table) => {
    if (!currentSession) { addToast('Start a session first!', 'warning'); return; }
    if (table.status === 'available') setCustomerModal(table);
    else setSelectedTableId(table.id);
  };

  const handleStartOrder = async () => {
    if (!customerModal || busy) return;
    setBusy(true);
    try {
      await createOrder(customerModal.id, customerModal.label || `T${customerModal.number}`, customerName);
      await refresh();
      setSelectedTableId(customerModal.id);
      setCustomerModal(null);
      setCustomerName('');
    } catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };

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
    const item = order.items?.find(i => i.id === itemId);
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

  const handlePrintKOT = async () => {
    if (!order || !order.items || order.items.length === 0 || busy) return;
    setBusy(true);
    try {
      if (localStorage.getItem('isPrintStation') === 'true') {
        const { printSplitKOT } = await import('../utils/print');
        printSplitKOT(order, selectedTable?.label || selectedTable?.number, null, config);
        addToast('Printing KOT...', 'success');
      } else {
        await createPrintJob('KOT', { order, tableLabel: selectedTable?.label || selectedTable?.number });
        addToast('KOT sent to printer queue', 'success');
      }
    } catch (e) {
      addToast('Print failed: ' + e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const subtotal = order?.items?.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0) || 0;

  if (!selectedTableId) {
    return (
      <div className="staff-mobile">
        <div className="staff-mobile-header">
          <div className="staff-mobile-brand">
            <div className="staff-brand-icon">RG</div>
            <div className="staff-brand-name">{config.restaurantName || 'RestoGrow'}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
             <button className="staff-sync-btn" onClick={refresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></button>
             <button className="staff-logout-btn" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
        <div className="staff-tables-scroll">
          {(sections || []).map(section => (
            <div key={section.id} className="staff-section">
              <div className="staff-section-header"><span>{section.icon} {section.name}</span></div>
              <div className="staff-table-grid">
                {(tables || []).filter(t => t.sectionId === section.id).map(table => (
                  <div key={table.id} className={`staff-table-card ${table.status}`} onClick={() => handleTableClick(table)}>
                    <div className="staff-table-label">{table.label}</div>
                    <div className="staff-table-status">{(table.status || 'free').toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {customerModal && (
          <div className="modal-backdrop" onClick={() => setCustomerModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:'300px'}}>
              <div className="modal-header"><h3 className="modal-title">New Order</h3></div>
              <div className="modal-body">
                <input className="input" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} autoFocus />
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" onClick={handleStartOrder}>Start</button>
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
        <button className="staff-back-btn" onClick={() => setSelectedTableId(null)}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1, fontWeight: 700 }}>{selectedTable?.label}</div>
      </div>

      <div className="staff-menu-search">
        <Search size={16} />
        <input placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      <div className="staff-menu-toggle">
        {depts.map(dept => (
          <button key={dept.id} className={`staff-toggle-btn ${activeDeptId === dept.id ? 'active' : ''}`} onClick={() => setActiveDeptId(dept.id)}>
            {dept.name.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="staff-menu-grid">
        {filteredItems.map(item => (
          <div key={item.id} className="staff-menu-card" onClick={() => handleAddItem(item)}>
            <div className="staff-menu-card-name">{item.name}</div>
            <div className="staff-menu-card-price">{config.currency}{item.price}</div>
          </div>
        ))}
      </div>

      {order?.items?.length > 0 && (
        <div className="staff-order-summary" style={{ position: 'sticky', bottom: 0, background: '#fff', padding: '12px', boxShadow: '0 -4px 15px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 800 }}>{order.items.length} Items</div>
          <button className="btn btn-primary" onClick={handlePrintKOT} disabled={busy} style={{ minWidth: '120px', padding: '12px' }}>
             <Printer size={16} style={{ marginRight: '6px' }}/> {busy ? 'Sending...' : 'Print KOT'}
          </button>
        </div>
      )}
    </div>
  );
}
