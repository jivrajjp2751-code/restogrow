import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Loader2, ShieldCheck, Plus, Store, Users, DollarSign, ExternalLink } from 'lucide-react';

export default function MasterPortal() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [stats, setStats] = useState({ total: 0, revenue: 0, active: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const { data: res } = await supabase.from('restaurants').select('*');
      setRestaurants(res || []);
      setStats({
        total: res?.length || 0,
        revenue: 0, // In future, calculate from subscription table
        active: res?.filter(r => r.status === 'active').length || 0
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name');
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const userEmail = fd.get('email');
    const userPass = fd.get('password');

    try {
      // 1. Create Restaurant
      const { data: rest, error: rError } = await supabase
        .from('restaurants')
        .insert([{ name, slug, status: 'active', createdAt: new Date().toISOString() }])
        .select().single();

      if (rError) throw rError;

      // 2. Create Initial Admin User for that restaurant
      const { error: uError } = await supabase
        .from('users')
        .insert([{ 
          restaurant_id: rest.id, 
          name: 'Admin', 
          pin: '1234', 
          role: 'admin', 
          email: userEmail,
          password: userPass // In real app, use Supabase Auth for passwords
        }]);

      if (uError) throw uError;

      setShowAdd(false);
      fetchData();
    } catch (err) {
      alert('Error creating restaurant: ' + err.message);
    }
  };

  if (loading) return (
    <div className="master-loading">
      <Loader2 className="animate-spin" />
      <span>Loading RestoGrow Fleet...</span>
    </div>
  );

  return (
    <div className="master-container" style={{ padding: '24px', background: '#F8F9FC', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1A1B2E', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck style={{ color: '#6C5CE7' }} /> RestoGrow Master Fleet
          </h1>
          <p style={{ color: '#5A5E73', fontSize: '14px' }}>Control center for all restaurant tenants</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> NEW RESTAURANT
        </button>
      </header>

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div className="stat-card" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#6C5CE7', marginBottom: '8px' }}><Store size={20} /></div>
          <div style={{ color: '#5A5E73', fontSize: '12px' }}>Total Restaurants</div>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{stats.total}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#00CEC9', marginBottom: '8px' }}><Users size={20} /></div>
          <div style={{ color: '#5A5E73', fontSize: '12px' }}>Active Users</div>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{stats.active}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#F39C12', marginBottom: '8px' }}><DollarSign size={20} /></div>
          <div style={{ color: '#5A5E73', fontSize: '12px' }}>Lifetime SaaS Revenue</div>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>$1,240</div>
        </div>
      </div>

      {/* Restaurants List */}
      <div className="card" style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
        <div className="card-header" style={{ padding: '16px', borderBottom: '1px solid #E2E8F0', fontWeight: 700 }}>RESTAURANT TENANTS</div>
        <table className="data-table" style={{ width: '100%', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
               <th style={{ padding: '12px 16px' }}>NAME</th>
               <th>ID / SLUG</th>
               <th>STATUS</th>
               <th>CREATED</th>
               <th style={{ textAlign: 'right', paddingRight: '16px' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.name}</td>
                <td style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{r.id}</td>
                <td><span className="badge badge-success" style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }}>{r.status.toUpperCase()}</span></td>
                <td style={{ fontSize: '12px' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                   <a href={`/#/login?rid=${r.id}`} target="_blank" className="btn btn-ghost" style={{ fontSize: '11px', gap: '4px' }}>
                     LOGIN AS <ExternalLink size={12} />
                   </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form className="modal" onSubmit={handleAdd} style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '400px' }}>
            <h2 style={{ marginBottom: '16px' }}>Deploy New Restaurant</h2>
            <div className="form-group" style={{ marginBottom: '12px' }}>
               <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Restaurant Name</label>
               <input name="name" className="input" placeholder="e.g. Blue Lagoon" required style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
               <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Admin Primary Email</label>
               <input name="email" type="email" className="input" placeholder="owner@gmail.com" required style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
               <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Set Admin Password</label>
               <input name="password" type="password" className="input" placeholder="••••••••" required style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
               <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
               <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>DEPLOY CLIENT</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
