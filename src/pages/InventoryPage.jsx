import React, { useState, useMemo, useCallback } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { addStock, addMenuItem, deleteMenuItem, updateMenuItem, getInventoryLog, getLowStockItems } from '../store/data';
import { Package, AlertTriangle, Plus, Search, Wine, Coffee, Trash2, Edit3 } from 'lucide-react';

export default function InventoryPage() {
  const { menuItems = [], inventory_log = [], config = {}, refresh, currentUser } = useApp();
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockModal, setStockModal] = useState(null);
  const [addQty, setAddQty] = useState('');
  const [addItemModal, setAddItemModal] = useState(null); // department ID
  const [newItemForm, setNewItemForm] = useState({
    name: '', code: '', price: '', buyingPrice: '', deptId: '', stock: '50', unit: 'bottle', isVeg: true,
  });

  // Edit item modal state
  const [editItemModal, setEditItemModal] = useState(null);
  const [editItemForm, setEditItemForm] = useState({
    name: '', code: '', price: '', buyingPrice: '', stock: '',
  });

  const lowStockItems = useMemo(() => getLowStockItems(menuItems), [menuItems]);
  const inventoryLog = useMemo(() => getInventoryLog(inventory_log).reverse().slice(0, 50), [inventory_log]);

  const searchFiltered = useMemo(() => menuItems.filter(i =>
    !searchQuery || i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.code?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [menuItems, searchQuery]);

  const handleAddStock = async () => {
    if (!stockModal || !addQty || Number(addQty) <= 0) { addToast('Enter valid qty', 'error'); return; }
    try {
      await addStock(stockModal.id, Number(addQty), 'Manual restock');
      refresh();
      addToast(`+${addQty} ${stockModal.unit} → ${stockModal.name}`, 'success');
      setStockModal(null);
      setAddQty('');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const openAddItem = useCallback((deptId) => {
    setNewItemForm({
      name: '', code: `ITM${Date.now().toString().slice(-4)}`,
      price: '', buyingPrice: '', deptId: deptId,
      stock: '50', unit: deptId === 'bar' ? 'bottle' : 'plate', isVeg: true,
    });
    setAddItemModal(deptId);
  }, []);

  const handleAddNewItem = async () => {
    if (!newItemForm.name || !newItemForm.price) { addToast('Name & Price required', 'error'); return; }
    try {
      await addMenuItem({
        ...newItemForm,
        price: Number(newItemForm.price),
        buyingPrice: Number(newItemForm.buyingPrice) || 0,
        stock: Number(newItemForm.stock) || 0,
      });
      refresh();
      addToast(`${newItemForm.name} added`, 'success');
      setAddItemModal(null);
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Delete "${item.name}" from inventory? This cannot be undone.`)) return;
    try {
      await deleteMenuItem(item.id);
      refresh();
      addToast(`${item.name} deleted`, 'info');
    } catch (e) { addToast('Delete failed: ' + e.message, 'error'); }
  };

  const openEditItem = (item) => {
    setEditItemForm({
      name: item.name || '',
      code: item.code || '',
      price: item.price || '',
      buyingPrice: item.buyingPrice || '',
      stock: item.stock || 0,
    });
    setEditItemModal(item);
  };

  const handleEditItem = async () => {
    if (!editItemModal) return;
    if (!editItemForm.name || !editItemForm.price) { addToast('Name & Price required', 'error'); return; }
    try {
      await updateMenuItem(editItemModal.id, {
        name: editItemForm.name,
        code: editItemForm.code,
        price: Number(editItemForm.price),
        buyingPrice: Number(editItemForm.buyingPrice) || 0,
        stock: Number(editItemForm.stock) || 0,
        deptId: editItemModal.deptId,
      });
      refresh();
      addToast(`${editItemForm.name} updated`, 'success');
      setEditItemModal(null);
    } catch (e) { addToast('Update failed: ' + e.message, 'error'); }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title"><Package size={16} /> INVENTORY</div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="search-pill" style={{ margin: 0 }}>
            <Search size={14} />
            <input type="text" placeholder="Search menu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="tab-pills">
            <button className={`tab-pill ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>STOCK</button>
            <button className={`tab-pill ${activeTab === 'low' ? 'active' : ''}`} onClick={() => setActiveTab('low')}>LOW STOCK {lowStockItems.length > 0 && <span className="badge badge-danger" style={{marginLeft:'4px'}}>{lowStockItems.length}</span>}</button>
            <button className={`tab-pill ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>LOGS</button>
          </div>
        </div>
      </div>

      {activeTab === 'stock' && (
        <div className="inventory-grid">
          <div className="inventory-sections">
            {(config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}]).map(dept => {
              const deptItems = searchFiltered.filter(i => i.deptId === dept.id || (!i.deptId && dept.id === 'bar'));
              return (
                <div className="inventory-section" key={dept.id}>
                  <div className="section-header">
                    <div className="section-title">
                      {dept.id === 'bar' ? <Wine size={14} /> : <Coffee size={14} />} {dept.name.toUpperCase()}
                      <span className="badge badge-info" style={{ marginLeft: '8px' }}>{deptItems.length} items</span>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => openAddItem(dept.id)}>+ ADD ITEM</button>
                  </div>

                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>ITEM</th>
                        <th>CODE</th>
                        <th>PRICE</th>
                        <th>STOCK</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptItems.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td><code style={{ fontSize: '10px', padding: '1px 4px', background: 'var(--bg-tertiary)', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>{item.code}</code></td>
                          <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{config.currency}{item.price}</td>
                          <td>
                            <div className="stock-indicator">
                              <div className="stock-bar">
                                <div className={`stock-bar-fill ${item.stock > 30 ? 'high' : item.stock > 10 ? 'medium' : 'low'}`} style={{ width: `${Math.min(100, (item.stock / 100) * 100)}%` }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.stock}</span>
                            </div>
                          </td>
                          <td>
                            {item.stock <= 0 ? <span className="badge badge-danger">OUT</span> : item.stock <= 10 ? <span className="badge badge-warning">LOW</span> : <span className="badge badge-success">OK</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => { setStockModal(item); setAddQty(''); }}>+ STOCK</button>
                              <button className="btn btn-sm btn-ghost" title="Edit item" onClick={() => openEditItem(item)}><Edit3 size={12} /></button>
                              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--brand-danger)' }} title="Delete item" onClick={() => handleDeleteItem(item)}><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {deptItems.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)' }}>No items in this department</td></tr>}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'low' && (
        <div className="card">
          <div className="section-header">
            <h3 className="section-title"><AlertTriangle size={14} color="var(--brand-danger)" /> CRITICAL LOW STOCK</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr><th>ITEM</th><th>CURRENT STOCK</th><th>ACTION</th></tr>
            </thead>
            <tbody>
              {lowStockItems.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td style={{ color: 'var(--brand-danger)', fontWeight: 700 }}>{item.stock} {item.unit}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => { setStockModal(item); setAddQty(''); }}>+ REFILL</button>
                  </td>
                </tr>
              ))}
              {lowStockItems.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '40px' }}>Everything is in stock!</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'log' && (
        <div className="card">
          <div className="section-header"><h3 className="section-title">INVENTORY TRANSACTION LOG</h3></div>
          <div className="log-list">
            {inventoryLog.map(log => (
              <div key={log.id} className="log-item">
                <div className="log-icon">{log.qty > 0 ? <Plus size={14} color="var(--brand-success)" /> : <Trash2 size={14} color="var(--brand-danger)" />}</div>
                <div className="log-details">
                  <div className="log-msg"><strong>{log.itemName}</strong>: {log.qty > 0 ? '+' : ''}{log.qty} {log.reason}</div>
                  <div className="log-time">{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {stockModal && (
        <div className="modal-backdrop" onClick={() => setStockModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-header">
               <h3 className="modal-title">UPDATE STOCK — {stockModal.name}</h3>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Quantity to Add</label>
                <input type="number" className="input" placeholder="e.g. 10" value={addQty} onChange={e => setAddQty(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddStock}>Update Stock</button>
            </div>
          </div>
        </div>
      )}

      {addItemModal && (
        <div className="modal-backdrop" onClick={() => setAddItemModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">ADD ITEM TO {config.departments?.find(d => d.id === addItemModal)?.name?.toUpperCase() || addItemModal?.toUpperCase()}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAddItemModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Item Name *</label>
                <input className="input" value={newItemForm.name} onChange={e => setNewItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Whiskey" />
              </div>
              <div className="config-grid">
                <div className="input-group">
                  <label className="input-label">Code</label>
                  <input className="input" value={newItemForm.code} onChange={e => setNewItemForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. ITM01" />
                </div>
                <div className="input-group">
                  <label className="input-label">Selling Price ({config.currency}) *</label>
                  <input type="number" className="input" value={newItemForm.price} onChange={e => setNewItemForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Buying Price ({config.currency})</label>
                  <input type="number" className="input" value={newItemForm.buyingPrice} onChange={e => setNewItemForm(f => ({ ...f, buyingPrice: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Stock</label>
                  <input type="number" className="input" value={newItemForm.stock} onChange={e => setNewItemForm(f => ({ ...f, stock: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddItemModal(null)}>Cancel</button>
              <button className="btn btn-success btn-lg" onClick={handleAddNewItem} style={{ width: '100%' }}>ADD TO INVENTORY</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editItemModal && (
        <div className="modal-backdrop" onClick={() => setEditItemModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">EDIT — {editItemModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditItemModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Item Name *</label>
                <input className="input" value={editItemForm.name} onChange={e => setEditItemForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="config-grid">
                <div className="input-group">
                  <label className="input-label">Code</label>
                  <input className="input" value={editItemForm.code} onChange={e => setEditItemForm(f => ({ ...f, code: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Selling Price ({config.currency}) *</label>
                  <input type="number" className="input" value={editItemForm.price} onChange={e => setEditItemForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Buying Price ({config.currency})</label>
                  <input type="number" className="input" value={editItemForm.buyingPrice} onChange={e => setEditItemForm(f => ({ ...f, buyingPrice: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Current Stock</label>
                  <input type="number" className="input" value={editItemForm.stock} onChange={e => setEditItemForm(f => ({ ...f, stock: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditItemModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-lg" onClick={handleEditItem} style={{ width: '100%' }}>SAVE CHANGES</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
