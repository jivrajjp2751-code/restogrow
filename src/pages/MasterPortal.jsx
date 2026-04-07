import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Loader2, ShieldCheck, Plus, Store, Users, ExternalLink, RefreshCw } from 'lucide-react';

export default function MasterPortal() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0 });
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setDbError('');
    try {
      if (!supabase) throw new Error("Supabase client not initialized. Check Env Vars.");
      const { data: res, error } = await supabase.from('restaurants').select('*');
      if (error) throw error;
      setRestaurants(res || []);
      setStats({
        total: res?.length || 0,
        active: res?.filter(r => r.status === 'active').length || 0
      });
    } catch (e) {
      console.error(e);
      setDbError(e.message || 'Failed to connect. Have you added VITE_SUPABASE_URL to Vercel?');
    }
    finally { setLoading(false); }
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name');
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    try {
      const { data: rest, error: rError } = await supabase
        .from('restaurants')
        .insert([{ name, slug, status: 'active' }])
        .select().single();

      if (rError) throw rError;

      // 2. Create Initial Admin User for that restaurant with PIN 1234
      const { error: uError } = await supabase
        .from('users')
        .insert([{ 
          restaurant_id: rest.id, 
          name: 'Admin', 
          pin: '1234', 
          role: 'admin'
        }]);

      if (uError) throw uError;

      setShowAdd(false);
      fetchData();
    } catch (err) {
      alert('Error creating restaurant: ' + (err.message || 'Check database connection.'));
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#F8F9FC', overflowY: 'auto', padding: '32px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1A1B2E', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={32} style={{ color: '#6C5CE7' }} /> RestoGrow Master Fleet
          </h1>
          <p style={{ color: '#5A5E73', fontSize: '15px', marginTop: '4px' }}>Control center for all restaurant tenants</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> NEW RESTAURANT
          </button>
        </div>
      </header>

      {dbError && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>⚠️ {dbError}</span>
          <span style={{ fontSize: '13px' }}>If you are on Vercel, ensure you have added <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> in your project settings -> Environment Variables. Then redeploy.</span>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="stat-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0' }}>
          <div style={{ color: '#6C5CE7', marginBottom: '12px' }}><Store size={24} /></div>
          <div style={{ color: '#5A5E73', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Restaurants</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '4px' }}>{stats.total}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0' }}>
          <div style={{ color: '#00CEC9', marginBottom: '12px' }}><Users size={24} /></div>
          <div style={{ color: '#5A5E73', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Instances</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '4px' }}>{stats.active}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#6C5CE7', gap: '12px', fontSize: '16px', fontWeight: 600 }}>
          <Loader2 className="animate-spin" size={24} /> Initializing Fleet...
        </div>
      ) : (
        <div className="card" style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <div className="card-header" style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: '14px', color: '#1A1B2E', display: 'flex', justifyContent: 'space-between' }}>
            <span>RESTAURANT TENANTS</span>
            <span style={{ color: '#6C5CE7' }}>{restaurants.length} deployed</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                   <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>NAME</th>
                   <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>TENANT ID</th>
                   <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>STATUS</th>
                   <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>CREATED</th>
                   <th style={{ textAlign: 'right', paddingRight: '24px', color: '#64748B', fontWeight: 600, fontSize: '12px' }}>ACCESS</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No restaurants deployed yet. Click 'New Restaurant' to begin.</td>
                  </tr>
                ) : (
                  restaurants.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0F172A' }}>{r.name}</td>
                      <td style={{ padding: '16px 24px', fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>{r.id}</td>
                      <td style={{ padding: '16px 24px' }}><span className="badge badge-success" style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '11px', background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>{r.status.toUpperCase()}</span></td>
                      <td style={{ padding: '16px 24px', fontSize: '13px', color: '#64748B' }}>{new Date(r.createdAt || r.created_at || new Date()).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                         <a href={`/#/login?rid=${r.id}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', gap: '6px', display: 'inline-flex', alignItems: 'center', background: '#F1F5F9', color: '#334155', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, transition: 'all 0.2s' }}>
                           LOGIN AS ADMIN <ExternalLink size={14} />
                         </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form className="modal" onSubmit={handleAdd} style={{ background: '#fff', padding: '32px', borderRadius: '20px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C5CE7' }}>
                <Store size={20} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Deploy Restaurant</h2>
            </div>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
               <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Restaurant Name</label>
               <input name="name" className="input" placeholder="e.g. Blue Lagoon Bar & Grill" required style={{ width: '100%', padding: '12px 16px', border: '1px solid #CBD5E1', borderRadius: '10px', fontSize: '15px', color: '#0F172A', outline: 'none', transition: 'border 0.2s' }} />
               <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>An admin user with PIN '1234' will be automatically created.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
               <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }} onClick={() => setShowAdd(false)}>Cancel</button>
               <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, background: '#6C5CE7', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px rgba(108, 92, 231, 0.2)' }}>Deploy Client</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
