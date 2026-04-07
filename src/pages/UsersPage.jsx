import { useState } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { addUser, updateUser, deleteUser } from '../store/data';
import { Plus, Edit3, Trash2, Shield, User } from 'lucide-react';

export default function UsersPage() {
  const { users, refresh, currentUser } = useApp();
  const { addToast } = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', pin: '', role: 'staff' });

  const openNew = () => { setForm({ name: '', email: '', pin: '', role: 'staff' }); setModal('new'); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, pin: u.pin, role: u.role }); setModal(u); };
  const handleSave = async () => {
    if (!form.name || !form.pin || form.pin.length !== 4) { addToast('Name + 4-digit PIN required', 'error'); return; }
    try {
      if (modal === 'new') { await addUser(form); addToast('User created', 'success'); }
      else { await updateUser(modal.id, form); addToast('Updated', 'success'); }
      setModal(null); refresh();
    } catch (e) { addToast('Failed', 'error'); }
  };
  const handleDelete = async (id) => {
    if (id === currentUser?.id) { addToast("Can't delete yourself", 'error'); return; }
    if (confirm('Delete?')) { try { await deleteUser(id); refresh(); } catch (e) { addToast('Failed', 'error'); } }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title"><User size={16} /> USERS</div>
        <button className="btn btn-success" onClick={openNew}><Plus size={12} /> ADD</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
        {users.map(user => (
          <div key={user.id} className="card">
            <div className="card-body" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: user.role === 'admin' ? 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))' : 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: user.role === 'admin' ? 'white' : 'var(--text-secondary)', flexShrink: 0,
              }}>
                {user.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '12px' }}>{user.name}</div>
                <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`} style={{ textTransform: 'uppercase' }}>{user.role}</span>
              </div>
              <div style={{ display: 'flex', gap: '2px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(user)}><Edit3 size={12} /></button>
                <button className="btn btn-ghost btn-sm" style={{ color: user.id === currentUser?.id ? 'var(--text-tertiary)' : 'var(--brand-danger)' }}
                  onClick={() => handleDelete(user.id)} disabled={user.id === currentUser?.id}><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modal === 'new' ? 'ADD USER' : 'EDIT USER'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group"><label className="input-label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
              <div className="input-group"><label className="input-label">4-Digit PIN *</label>
                <input className="input" value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} maxLength={4} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.3em' }} /></div>
              <div className="input-group"><label className="input-label">Role</label>
                <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">Admin</option><option value="staff">Staff</option>
                </select></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{modal === 'new' ? 'CREATE' : 'SAVE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
