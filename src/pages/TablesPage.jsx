import { useState, useCallback } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { createOrder, addTable, deleteTable, addSection, updateSection, deleteSection } from '../store/data';
import { Plus, Edit3, Trash2, Settings, X } from 'lucide-react';

export default function TablesPage() {
  const { tables = [], sections = [], refresh, currentSession } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [customerModal, setCustomerModal] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [addTableModal, setAddTableModal] = useState(null);
  const [newTableForm, setNewTableForm] = useState({ label: '', seats: 4 });
  const [sectionModal, setSectionModal] = useState(null);
  const [sectionForm, setSectionForm] = useState({ name: '', icon: '🏠', color: '#00B894' });

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
    } else if (table.status === 'occupied' || table.status === 'billing') {
      navigate(`/order/${table.id}`);
    } else if (table.status === 'reserved') {
      setCustomerModal(table);
    }
  }, [navigate, editMode, currentSession, addToast]);

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
      setSectionForm({ name: '', icon: '🏠', color: '#00B894' });
    } catch (e) { addToast(e.message || 'Failed', 'error'); }
  };

  const handleEditSection = (section) => {
    setSectionForm({ name: section.name, icon: section.icon, color: section.color });
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
        <div style={{ display: 'flex', gap: '4px' }}>
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
                  <div className="table-status-badge">
                    {table.status === 'available' ? 'FREE' : table.status === 'occupied' ? 'BUSY' : (table.status || 'UNKNOWN').toUpperCase()}
                  </div>
                  {table.customerName && (
                    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                      {table.customerName}
                    </div>
                  )}
                  {table.seats > 0 && (
                    <div style={{ fontSize: '8px', color: 'var(--text-tertiary)' }}>
                      {table.seats} seats
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
            setSectionForm({ name: '', icon: '🏠', color: '#00B894' });
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
                <input
                  className="input"
                  placeholder="Optional"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleStartOrder(); }}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input
                  className="input"
                  placeholder="Optional"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStartOrder(); }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCustomerModal(null)}>
                Cancel
              </button>
              <button className="btn btn-success btn-lg" onClick={handleStartOrder}>
                START ORDER
              </button>
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

      {/* Section Modal */}
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
