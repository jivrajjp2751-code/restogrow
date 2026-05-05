import { useState, useCallback } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { createOrder, addTable, deleteTable, addSection, updateSection, deleteSection } from '../store/data';
import { Plus, Edit3, Trash2, Settings, X, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';

export default function TablesPage() {
  const { tables = [], sections = [], config = {}, refresh, currentSession, bills = [], orders = [] } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [customerModal, setCustomerModal] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [addTableModal, setAddTableModal] = useState(null);
  const [newTableForm, setNewTableForm] = useState({ label: '', seats: 4 });
  const [sectionModal, setSectionModal] = useState(null);
  const [sectionForm, setSectionForm] = useState({ name: '', icon: '🏠', color: '#00B894', surcharge: 0, surchargeDepts: [] });
  const [settleModal, setSettleModal] = useState(null);
  const [settleMode, setSettleMode] = useState('Cash');

  const depts = config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}];
  const getTablesForSection = (sectionId) => tables.filter(t => t.sectionId === sectionId);

  const filteredTables = (sectionId) => {
    const sectionTables = getTablesForSection(sectionId);
    if (filter === 'all') return sectionTables;
    return sectionTables.filter(t => t.status === filter);
  };

  const statusCounts = {
    all: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    billing: tables.filter(t => t.status === 'billing').length,
  };

  const handleTableClick = useCallback((table) => {
    if (editMode) return;
    if (!currentSession) {
      addToast('Start a session first!', 'warning');
      navigate('/session');
      return;
    }
    if (table.status === 'available') {
      setCustomerModal(table);
    } else if (table.status === 'occupied') {
      navigate(`/order/${table.id}`);
    } else if (table.status === 'billing') {
      // Find active bill for this table
      const activeBill = bills.find(b => {
         const o = orders.find(ord => ord.id === b.orderId);
         return o && o.tableId === table.id && (!b.paymentMode || b.paymentMode === 'Unsettled');
      });
      if (activeBill) {
        setSettleModal(activeBill);
        setSettleMode('Cash');
      } else {
        addToast('No active bill found', 'error');
      }
    } else if (table.status === 'reserved') {
      setCustomerModal(table);
    }
  }, [navigate, editMode, currentSession, addToast, bills, orders]);

  const handleStartOrder = async () => {
    if (!customerModal) return;
    const table = customerModal;
    try {
      await createOrder(table.id, table.label || `T${table.number}`, customerName);
      refresh();
      addToast(`${table.label} — Order started`, 'success');
      setCustomerModal(null);
      setCustomerName('');
      setCustomerPhone('');
      navigate(`/order/${table.id}`);
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handleSettle = async () => {
    if (!settleModal || busy) return;
    setBusy(true);
    try {
      const { settleBill } = await import('../store/data');
      await settleBill(settleModal.id, settleMode);
      await refresh();
      addToast(`Bill ${settleModal.billNumber} settled via ${settleMode}`, 'success');
      setSettleModal(null);
    } catch (e) { addToast('Settlement failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  };

  const handleAddTable = async (sectionId) => {
    if (!newTableForm.label) { addToast('Enter table label', 'error'); return; }
    const sectionTables = getTablesForSection(sectionId);
    try {
      await addTable({ number: sectionTables.length + 1, label: newTableForm.label, seats: Number(newTableForm.seats) || 4, sectionId });
      refresh();
      addToast(`Table ${newTableForm.label} added`, 'success');
      setAddTableModal(null);
      setNewTableForm({ label: '', seats: 4 });
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
  };

  const handleDeleteTable = async (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (table?.status === 'occupied') { addToast('Cannot delete occupied table', 'error'); return; }
    if (confirm('Delete this table?')) {
      try { await deleteTable(tableId); refresh(); addToast('Table removed', 'info'); }
      catch (e) { addToast(e.message || 'Failed', 'error'); }
    }
  };

  const handleAddSection = async () => {
    if (!sectionForm.name) { addToast('Enter section name', 'error'); return; }
    try {
      await addSection(sectionForm);
      refresh();
      addToast(`Section "${sectionForm.name}" added`, 'success');
      setSectionModal(null);
      setSectionForm({ name: '', icon: '🏠', color: '#00B894', surcharge: 0, surchargeDepts: [] });
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
  };

  const handleEditSection = (section) => {
    setSectionForm({
      name: section.name,
      icon: section.icon,
      color: section.color,
      surcharge: section.surcharge || 0,
      surchargeDepts: section.surchargeDepts || [],
    });
    setSectionModal(section);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.name) { addToast('Enter section name', 'error'); return; }
    if (sectionModal === 'new') {
      await handleAddSection();
    } else {
      try {
        await updateSection(sectionModal.id, sectionForm);
        refresh();
        addToast('Section updated', 'success');
        setSectionModal(null);
      } catch (e) { addToast(e.message || 'Failed', 'error'); }
    }
  };

  const handleDeleteSection = (sectionId) => {
    const sectionTables = getTablesForSection(sectionId);
    if (sectionTables.some(t => t.status === 'occupied')) {
      addToast('Cannot delete section with active orders', 'error');
      return;
    }
    if (confirm('Delete this section and all its tables?')) {
      deleteSection(sectionId);
      refresh();
      addToast('Section removed', 'info');
    }
  };

  const toggleSurchargeDept = (deptId) => {
    setSectionForm(f => {
      const current = f.surchargeDepts || [];
      if (current.includes(deptId)) {
        return { ...f, surchargeDepts: current.filter(d => d !== deptId) };
      } else {
        return { ...f, surchargeDepts: [...current, deptId] };
      }
    });
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">
          TABLES
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {statusCounts.available} free · {statusCounts.occupied} active
          </span>
          {!currentSession && (
            <span className="badge badge-warning" style={{ marginLeft: '8px' }}>NO SESSION</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'ALL' },
            { key: 'available', label: 'FREE' },
            { key: 'occupied', label: 'BUSY' },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f.key)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
            >
              {f.label}
            </button>
          ))}
          <button
            className={`btn btn-sm ${editMode ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setEditMode(m => !m)}
            title="Edit tables & sections"
          >
            <Settings size={12} /> {editMode ? 'DONE' : 'EDIT'}
          </button>
        </div>
      </div>

      {/* Section-based table layout */}
      {sections.map(section => {
        const sectionTables = filteredTables(section.id);
        return (
          <div key={section.id} className="table-section" style={{ '--section-color': section.color }}>
            <div className="table-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{section.icon}</span>
                <span className="table-section-title">{section.name}</span>
                <span className="badge badge-info">{getTablesForSection(section.id).length} tables</span>
                {section.surcharge > 0 && (
                  <span className="badge badge-warning" style={{ fontSize: '9px' }}>+{section.surcharge}%</span>
                )}
              </div>
              {editMode && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-sm btn-success" onClick={() => {
                    const secTables = getTablesForSection(section.id);
                    const prefix = section.name.substring(0, 3).toUpperCase();
                    setNewTableForm({ label: `${prefix}-${secTables.length + 1}`, seats: 4 });
                    setAddTableModal(section.id);
                  }}>
                    <Plus size={10} /> ADD TABLE
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleEditSection(section)}>
                    <Edit3 size={10} />
                  </button>
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--brand-danger)' }} onClick={() => handleDeleteSection(section.id)}>
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </div>

            <div className="table-grid">
              {sectionTables.map(table => (
                <div
                  key={table.id}
                  className={`table-card ${table.status}`}
                  onClick={() => handleTableClick(table)}
                >
                  {editMode && (
                    <button
                      className="table-delete-btn"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                    >
                      <X size={10} />
                    </button>
                  )}
                  <div className="table-number">{table.label}</div>
                  {table.status === 'billing' ? (
                    <div 
                       style={{ fontSize: '10px', background: 'var(--brand-success)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, marginTop: '2px', cursor: 'pointer', fontFamily: 'var(--font-mono)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                       onClick={(e) => {
                          e.stopPropagation();
                          handleTableClick(table);
                       }}
                    >
                      SETTLE
                    </div>
                  ) : (
                    <div className="table-status-badge">
                      {table.status === 'available' ? 'FREE' : table.status === 'occupied' ? 'BUSY' : (table.status || 'UNKNOWN').toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              {sectionTables.length === 0 && (
                <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: '11px', fontStyle: 'italic' }}>
                  {filter === 'all' ? 'No tables in this section' : 'No matching tables'}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add Section Button */}
      {editMode && (
        <button
          className="btn btn-success"
          style={{ marginTop: '12px', width: '100%' }}
          onClick={() => {
            setSectionForm({ name: '', icon: '🏠', color: '#00B894', surcharge: 0, surchargeDepts: [] });
            setSectionModal('new');
          }}
        >
          <Plus size={14} /> ADD NEW SECTION
        </button>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '16px', marginTop: '16px', padding: '8px 12px',
        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)', fontSize: '10px', fontFamily: 'var(--font-mono)',
      }}>
        {[
          { s: 'FREE', c: 'var(--status-available)' },
          { s: 'BUSY', c: 'var(--status-occupied)' },
          { s: 'BILLING', c: 'var(--status-billing)' },
          { s: 'RESERVED', c: 'var(--status-reserved)' },
        ].map(l => (
          <div key={l.s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.c }} />
            <span style={{ color: 'var(--text-tertiary)' }}>{l.s}</span>
          </div>
        ))}
      </div>

      {/* Customer Modal */}
      {customerModal && (
        <div className="modal-backdrop" onClick={() => setCustomerModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">NEW ORDER — {customerModal.label}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCustomerModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Customer Name</label>
                <input className="input" placeholder="Optional" value={customerName}
                  onChange={e => setCustomerName(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleStartOrder(); }}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input className="input" placeholder="Optional" value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStartOrder(); }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCustomerModal(null)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleStartOrder}>START ORDER</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {addTableModal && (
        <div className="modal-backdrop" onClick={() => setAddTableModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">ADD TABLE</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAddTableModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Table Label</label>
                <input className="input" value={newTableForm.label}
                  onChange={e => setNewTableForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g., AC-6, OUT-4" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTable(addTableModal); }}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Seats</label>
                <input type="number" className="input" value={newTableForm.seats}
                  onChange={e => setNewTableForm(f => ({ ...f, seats: e.target.value }))}
                  min="0" max="20" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddTableModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={() => handleAddTable(addTableModal)}>ADD TABLE</button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settleModal && (
        <div className="modal-backdrop" onClick={() => setSettleModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 className="modal-title">SETTLE — {settleModal.billNumber}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSettleModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Table: {settleModal.tableNumber} · Total: {config.currency}{settleModal.total}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '8px', marginTop: '12px', color: 'var(--text-secondary)' }}>PAYMENT METHOD</div>
              <div className="payment-modes" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { mode: 'Cash', icon: Banknote },
                  { mode: 'Card', icon: CreditCard },
                  { mode: 'UPI', icon: Smartphone },
                ].map(p => (
                  <button key={p.mode} type="button"
                    className={`payment-mode-btn ${settleMode === p.mode ? 'active' : ''}`}
                    onClick={() => setSettleMode(p.mode)}>
                    <p.icon size={18} />
                    <span>{p.mode}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSettleModal(null)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleSettle} disabled={busy}>
                <CheckCircle size={14} /> SETTLE — {settleMode}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Modal — FIXED LAYOUT */}
      {sectionModal && (
        <div className="modal-backdrop" onClick={() => setSectionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{sectionModal === 'new' ? 'ADD SECTION' : 'EDIT SECTION'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSectionModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Section Name</label>
                <input className="input" value={sectionForm.name}
                  onChange={e => setSectionForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., VIP Lounge" autoFocus />
              </div>
              <div className="input-group">
                <label className="input-label">Icon (Emoji)</label>
                <input className="input" value={sectionForm.icon}
                  onChange={e => setSectionForm(f => ({ ...f, icon: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Color</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="color" value={sectionForm.color}
                    onChange={e => setSectionForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <input className="input" value={sectionForm.color}
                    onChange={e => setSectionForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: '100px' }} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Hidden Surcharge (%)</label>
                <input type="number" className="input" value={sectionForm.surcharge}
                  onChange={e => setSectionForm(f => ({ ...f, surcharge: Number(e.target.value) || 0 }))}
                  placeholder="e.g. 15" />
                <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Automatically adds % to item price in this section.</p>
              </div>

              {/* Department surcharge applicability */}
              {Number(sectionForm.surcharge) > 0 && (
                <div className="input-group">
                  <label className="input-label">Apply Surcharge To</label>
                  <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                    Select which departments get the surcharge. Items from unselected departments will sell at MRP.
                    {(sectionForm.surchargeDepts || []).length === 0 && ' (None selected = applies to ALL)'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {depts.map(dept => {
                      const isSelected = (sectionForm.surchargeDepts || []).includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => toggleSurchargeDept(dept.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-color)'}`,
                            background: isSelected ? 'rgba(94, 92, 230, 0.1)' : 'var(--bg-tertiary)',
                            color: isSelected ? 'var(--brand-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{dept.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSectionModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSection}>
                {sectionModal === 'new' ? 'ADD SECTION' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
