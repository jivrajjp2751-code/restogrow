import { useState } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { addStock, addMenuItem, addCategory, updateCategory, deleteCategory, getInventoryLog, getLowStockItems } from '../store/data';
import { Package, AlertTriangle, Plus, Search, PlusCircle, Wine, Coffee, Edit3, Trash2 } from 'lucide-react';

export default function InventoryPage() {
  const { menuItems = [], inventory_log = [], categories = [], config = {}, refresh, currentUser } = useApp();
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockModal, setStockModal] = useState(null);
  const [addQty, setAddQty] = useState('');
  const [addItemModal, setAddItemModal] = useState(null); // 'bar' or 'kitchen'
  const [newItemForm, setNewItemForm] = useState({
    name: '', code: '', price: '', categoryId: '', stock: '', unit: 'bottle', isVeg: true,
  });
  // Category management
  const [catModal, setCatModal] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', color: '#6C5CE7', icon: '🍽️', shortcut: '', type: 'bar' });

  const lowStockItems = getLowStockItems(menuItems);
  const inventoryLog = getInventoryLog(inventory_log).reverse().slice(0, 50);

  const isKitchenEnabled = config.isKitchenEnabled !== false;
  const isBarEnabled = config.isBarEnabled !== false;
  const barLabel = config.barLabel || 'Bar';
  const kitchenLabel = config.kitchenLabel || 'Kitchen';

  // Classify categories
  const barCats = categories.filter(c => c.type === 'bar');
  const kitchenCats = categories.filter(c => c.type === 'kitchen');
  const barCatIds = barCats.map(c => c.id);
  const kitchenCatIds = kitchenCats.map(c => c.id);

  // Filter by search across all items
  const searchFiltered = menuItems.filter(i =>
    !searchQuery || i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const barItems = isBarEnabled ? searchFiltered.filter(i => barCatIds.includes(i.categoryId)) : [];
  const kitchenItems = isKitchenEnabled ? searchFiltered.filter(i => kitchenCatIds.includes(i.categoryId)) : [];
  const uncategorized = isBarEnabled ? searchFiltered.filter(i => !barCatIds.includes(i.categoryId) && !kitchenCatIds.includes(i.categoryId)) : [];

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

  const openAddItem = (type) => {
    const typeCats = type === 'bar' ? barCats : kitchenCats;
    setNewItemForm({
      name: '', code: `ITM${Date.now().toString().slice(-4)}`,
      price: '', categoryId: typeCats[0]?.id || '',
      stock: '50', unit: type === 'bar' ? 'bottle' : 'plate', isVeg: true,
    });
    setAddItemModal(type);
  };

  const handleAddNewItem = async () => {
    if (!newItemForm.name || !newItemForm.price) { addToast('Name & Price required', 'error'); return; }
    try {
      await addMenuItem({
        ...newItemForm,
        price: Number(newItemForm.price),
        stock: Number(newItemForm.stock) || 0,
      });
      refresh();
      addToast(`${newItemForm.name} added`, 'success');
      setAddItemModal(null);
    } catch { addToast('Failed', 'error'); }
  };

  // Category handlers
  const openCatNew = (type) => {
    setCatForm({ name: '', color: type === 'bar' ? '#6C5CE7' : '#FDCB6E', icon: type === 'bar' ? '🍸' : '🍽️', shortcut: '', type });
    setCatModal('new');
  };
  const openCatEdit = (cat) => {
    setCatForm({ name: cat.name, color: cat.color, icon: cat.icon, shortcut: cat.shortcut || '', type: cat.type || 'bar' });
    setCatModal(cat);
  };
  const handleSaveCat = async () => {
    if (!catForm.name) { addToast('Name required', 'error'); return; }
    try {
      if (catModal === 'new') { await addCategory(catForm); addToast('Category added', 'success'); }
      else { await updateCategory(catModal.id, catForm); addToast('Category updated', 'success'); }
      refresh();
      setCatModal(null);
    } catch { addToast('Failed', 'error'); }
  };
  const handleDeleteCat = async (id) => {
    if (confirm('Delete this category?')) {
      try { await deleteCategory(id); refresh(); addToast('Deleted', 'info'); }
      catch { addToast('Failed', 'error'); }
    }
  };

  // Render stock table
  const renderStockTable = (items, emptyMsg) => (
    <table className="data-table">
      <thead>
        <tr>
          <th>ITEM</th>
          <th>CODE</th>
          <th>CATEGORY</th>
          <th>PRICE</th>
          <th>STOCK</th>
          <th>STATUS</th>
          <th>ACTION</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          const cat = categories.find(c => c.id === item.categoryId);
          return (
            <tr key={item.id}>
              <td style={{ fontWeight: 600 }}>{item.name}</td>
              <td><code style={{ fontSize: '10px', padding: '1px 4px', background: 'var(--bg-tertiary)', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>{item.code}</code></td>
              <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cat?.icon} {cat?.name || '—'}</td>
              <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{config.currency}{item.price}</td>
              <td>
                <div className="stock-indicator">
                  <div className="stock-bar">
                    <div
                      className={`stock-bar-fill ${item.stock > 30 ? 'high' : item.stock > 10 ? 'medium' : 'low'}`}
                      style={{ width: `${Math.min(100, (item.stock / 100) * 100)}%` }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.stock}</span>
                </div>
              </td>
              <td>
                {item.stock <= 0 ? <span className="badge badge-danger">OUT</span>
                  : item.stock <= 10 ? <span className="badge badge-warning">LOW</span>
                  : <span className="badge badge-success">OK</span>}
              </td>
              <td>
                <button className="btn btn-sm btn-primary" onClick={() => { setStockModal(item); setAddQty(''); }}>
                  <Plus size={10} /> ADD
                </button>
              </td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '11px' }}>{emptyMsg}</td></tr>
        )}
      </tbody>
    </table>
  );

  // Render category list for a type
  const renderCategoryList = (type) => {
    const cats = type === 'bar' ? barCats : kitchenCats;
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '6px 8px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
        {cats.map(cat => (
          <div key={cat.id} style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)', fontSize: '10px',
          }}>
            <span>{cat.icon}</span>
            <span style={{ fontWeight: 600 }}>{cat.name}</span>
            {isAdmin && (
              <>
                <button className="btn btn-ghost" style={{ padding: '1px', minHeight: 0 }} onClick={() => openCatEdit(cat)}>
                  <Edit3 size={9} />
                </button>
                <button className="btn btn-ghost" style={{ padding: '1px', minHeight: 0, color: 'var(--brand-danger)' }} onClick={() => handleDeleteCat(cat.id)}>
                  <Trash2 size={9} />
                </button>
              </>
            )}
          </div>
        ))}
        {isAdmin && (
          <button className="btn btn-sm btn-ghost" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => openCatNew(type)}>
            <Plus size={9} /> Add
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title">
          <Package size={16} /> INVENTORY
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {menuItems.length} items · {lowStockItems.length} low
          </span>
        </div>
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>STOCK</button>
          <button className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>LOG</button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="low-stock-alert" style={{ marginBottom: '10px' }}>
          <AlertTriangle size={14} />
          <span>
            <b>{lowStockItems.length} LOW:</b>&nbsp;
            {lowStockItems.slice(0, 5).map(i => `${i.name}(${i.stock})`).join(', ')}
            {lowStockItems.length > 5 && ` +${lowStockItems.length - 5} more`}
          </span>
        </div>
      )}

      {activeTab === 'stock' && (
        <>
          {/* Single search bar */}
          <div className="search-input-wrapper" style={{ marginBottom: '12px', maxWidth: '400px' }}>
            <Search />
            <input className="input" placeholder="Search bar & kitchen items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          {/* Horizontal split: BAR | KITCHEN */}
          <div className="inventory-split-container" style={{ 
            display: 'grid', 
            gridTemplateColumns: isBarEnabled && isKitchenEnabled ? '1fr 1fr' : '1fr', 
            gap: '12px' 
          }}>
            {/* BAR ITEMS SECTION */}
            {isBarEnabled && (
              <div className="inventory-section">
                <div className="inventory-section-header bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wine size={16} />
                    <span className="inventory-section-title">{barLabel.toUpperCase()} ITEMS</span>
                    <span className="badge badge-info">{barItems.length + uncategorized.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                      {(barItems.concat(uncategorized)).filter(i => i.stock <= 10).length} low
                    </span>
                    {isAdmin && (
                      <button className="btn btn-sm btn-success" onClick={() => openAddItem('bar')}>
                        <PlusCircle size={10} /> ADD
                      </button>
                    )}
                  </div>
                </div>
                {renderCategoryList('bar')}
                <div className="inventory-section-body">
                  {renderStockTable([...barItems, ...uncategorized], searchQuery ? 'No items match' : 'No items')}
                </div>
              </div>
            )}

            {/* KITCHEN ITEMS SECTION */}
            {isKitchenEnabled && (
              <div className="inventory-section">
                <div className="inventory-section-header kitchen">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Coffee size={16} />
                    <span className="inventory-section-title">{kitchenLabel.toUpperCase()} ITEMS</span>
                    <span className="badge badge-warning">{kitchenItems.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                      {kitchenItems.filter(i => i.stock <= 10).length} low
                    </span>
                    {isAdmin && (
                      <button className="btn btn-sm btn-success" onClick={() => openAddItem('kitchen')}>
                        <PlusCircle size={10} /> ADD
                      </button>
                    )}
                  </div>
                </div>
                {renderCategoryList('kitchen')}
                <div className="inventory-section-body">
                  {renderStockTable(kitchenItems, searchQuery ? 'No items match' : 'No items')}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'log' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0, maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>ITEM</th><th>TYPE</th><th>QTY</th><th>REMAINING</th><th>TIME</th></tr>
              </thead>
              <tbody>
                {inventoryLog.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{log.itemName}</td>
                    <td>
                      {log.type === 'add'
                        ? <span className="badge badge-success">+ADD</span>
                        : <span className="badge badge-danger">-USE</span>}
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{log.quantity}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{log.remainingStock}</td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
                {inventoryLog.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No activity</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {stockModal && (
        <div className="modal-backdrop" onClick={() => setStockModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">ADD STOCK — {stockModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setStockModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                Current: <b>{stockModal.stock} {stockModal.unit}</b>
              </p>
              <div className="input-group">
                <label className="input-label">Quantity to Add</label>
                <input
                  type="number" className="input" value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  placeholder="Enter qty" autoFocus min="1"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddStock(); }}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                {[5, 10, 20, 50, 100].map(n => (
                  <button key={n} className="btn btn-sm btn-secondary" onClick={() => setAddQty(String(n))}>+{n}</button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleAddStock}>ADD STOCK</button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {addItemModal && (
        <div className="modal-backdrop" onClick={() => setAddItemModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                ADD {addItemModal === 'bar' ? barLabel.toUpperCase() : kitchenLabel.toUpperCase()} ITEM
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setAddItemModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="config-grid">
                <div className="input-group">
                  <label className="input-label">Item Name *</label>
                  <input className="input" value={newItemForm.name}
                    onChange={e => setNewItemForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Item Name" autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">Code</label>
                  <input className="input" value={newItemForm.code}
                    onChange={e => setNewItemForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. ITM01" />
                </div>
                <div className="input-group">
                  <label className="input-label">Price ({config.currency}) *</label>
                  <input type="number" className="input" value={newItemForm.price}
                    onChange={e => setNewItemForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select className="select" value={newItemForm.categoryId}
                    onChange={e => setNewItemForm(f => ({ ...f, categoryId: e.target.value }))}>
                    {(addItemModal === 'bar' ? barCats : kitchenCats).map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Initial Stock</label>
                  <input type="number" className="input" value={newItemForm.stock}
                    onChange={e => setNewItemForm(f => ({ ...f, stock: e.target.value }))}
                    placeholder="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <select className="select" value={newItemForm.unit}
                    onChange={e => setNewItemForm(f => ({ ...f, unit: e.target.value }))}>
                    {addItemModal === 'bar' ? (
                      <>
                        <option value="bottle">Bottle</option>
                        <option value="peg">Peg</option>
                        <option value="glass">Glass</option>
                        <option value="can">Can</option>
                        <option value="pitcher">Pitcher</option>
                        <option value="shot">Shot</option>
                        <option value="session">Session</option>
                        <option value="piece">Piece</option>
                      </>
                    ) : (
                      <>
                        <option value="plate">Plate</option>
                        <option value="piece">Piece</option>
                        <option value="kg">Kg</option>
                        <option value="liter">Liter</option>
                        <option value="cup">Cup</option>
                        <option value="bottle">Bottle</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAddItemModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleAddNewItem}>ADD TO INVENTORY</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModal && (
        <div className="modal-backdrop" onClick={() => setCatModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{catModal === 'new' ? 'ADD CATEGORY' : 'EDIT CATEGORY'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setCatModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group"><label className="input-label">Name *</label>
                <input className="input" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
              <div className="input-group"><label className="input-label">Icon (Emoji)</label>
                <input className="input" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Type</label>
                <select className="select" value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="bar">{barLabel}</option>
                  <option value="kitchen">{kitchenLabel}</option>
                </select></div>
              <div className="input-group"><label className="input-label">Color</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                  <input className="input" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} style={{ width: '100px' }} />
                </div></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCatModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveCat}>{catModal === 'new' ? 'ADD' : 'SAVE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
