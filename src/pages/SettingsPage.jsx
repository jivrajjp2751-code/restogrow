import { useState } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { updateConfig, injectFakeData } from '../store/data';
import { Settings, Store, Receipt, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const { config = {}, refresh } = useApp();
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...config });

  const handleSave = async () => {
    try { await updateConfig(form); refresh(); addToast('Settings saved', 'success'); }
    catch (e) { addToast('Failed', 'error'); }
  };

  const handleReset = () => {
    if (confirm('RESET ALL DATA? This clears everything and cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title"><Settings size={16} /> SETTINGS</div>
        <button className="btn btn-success" onClick={handleSave}>SAVE</button>
      </div>

      <div className="config-section">
        <h3 className="config-section-title"><Store size={14} /> RESTAURANT</h3>
        <div className="config-grid">
          <div className="input-group"><label className="input-label">Name</label>
            <input className="input" value={form.restaurantName} onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div className="input-group" style={{ gridColumn: '1/-1' }}><label className="input-label">Address</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
        </div>
      </div>

      <div className="config-section">
        <h3 className="config-section-title"><Receipt size={14} /> BILLING</h3>
        <div className="config-grid">
          <div className="input-group"><label className="input-label">GST Number</label>
            <input className="input" value={form.gstNumber} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">Currency</label>
            <input className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">Tax Rate (%)</label>
            <input type="number" className="input" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} min="0" max="100" /></div>
          <div className="input-group"><label className="input-label">Service Charge (%)</label>
            <input type="number" className="input" value={form.serviceChargeRate} onChange={e => setForm(f => ({ ...f, serviceChargeRate: Number(e.target.value) }))} min="0" max="100" /></div>
        </div>
      </div>

      <div className="config-section">
        <h3 className="config-section-title">🏢 DEPARTMENTS</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '12px' }}>
          Add or remove service areas like Kitchen, Bar, Shisha Lounge, etc.
        </p>
        <div className="config-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}]).map((dept, idx) => (
             <div key={dept.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
               <input className="input" value={dept.name} onChange={e => {
                  const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                  newDepts[idx].name = e.target.value;
                  setForm(f => ({ ...f, departments: newDepts }));
               }} />
               <button className="btn btn-ghost" style={{ color: 'var(--brand-danger)' }} onClick={() => {
                  const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                  newDepts.splice(idx, 1);
                  setForm(f => ({ ...f, departments: newDepts }));
               }}>X</button>
             </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => {
             const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
             newDepts.push({ id: 'dept_' + Date.now(), name: 'New Dept' });
             setForm(f => ({ ...f, departments: newDepts }));
          }}>+ ADD DEPARTMENT</button>
        </div>
      </div>



      <div className="config-section" style={{ borderColor: 'rgba(255,107,107,0.3)' }}>
        <h3 className="config-section-title" style={{ color: 'var(--brand-danger)' }}><RefreshCw size={14} /> DANGER ZONE</h3>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '10px' }}>Reset clears ALL data — orders, bills, menu, inventory, sessions.</p>
        <button className="btn btn-danger" onClick={handleReset}>RESET ALL DATA</button>
      </div>
    </div>
  );
}
