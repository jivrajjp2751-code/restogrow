import { useState } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { authenticateUser } from '../store/data';
import { Loader2, ShieldCheck, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const { addToast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const user = await authenticateUser(email, password);
      login(user); // AppContext handles tenant routing automatically
      addToast(`Welcome back!`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ width: '400px', padding: '48px 40px' }}>
        <div className="login-header">
           <div className="resto-logo-spin">RG</div>
           <h2 style={{ marginTop: '24px' }}>RestoGrow Access</h2>
           <p>Enter your hotel credentials</p>
        </div>

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
             <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase' }}>Email Address</label>
             <div style={{ position: 'relative' }}>
               <Mail size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
               <input 
                 type="email" 
                 required
                 value={email}
                 onChange={e => setEmail(e.target.value)}
                 placeholder="admin@hotel.com" 
                 style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px', color: 'white', outline: 'none', transition: 'all 0.2s' }} 
                 onFocus={e => e.target.style.borderColor = '#00CEC9'}
                 onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
               />
             </div>
          </div>

          <div className="input-group" style={{ marginBottom: '8px' }}>
             <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '8px', textTransform: 'uppercase' }}>Secure Password</label>
             <div style={{ position: 'relative' }}>
               <Lock size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
               <input 
                 type="password" 
                 required
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 placeholder="••••••••" 
                 style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '14px', color: 'white', outline: 'none', transition: 'all 0.2s', letterSpacing: '2px' }} 
                 onFocus={e => e.target.style.borderColor = '#00CEC9'}
                 onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
               />
             </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', background: '#6C5CE7', color: 'white', fontSize: '15px', fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px', boxShadow: '0 8px 16px rgba(108, 92, 231, 0.3)', transition: 'all 0.2s' }}
            onMouseOver={e => !loading && (e.target.style.transform = 'translateY(-2px)')}
            onMouseOut={e => !loading && (e.target.style.transform = 'none')}
          >
            {loading ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={18} /> SECURE LOGIN</>}
          </button>
        </form>
      </div>
      
      <div style={{ position: 'fixed', bottom: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '11px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Lock size={12} /> RestoGrow Multi-Tenant Architecture | v1.2.0-Cloud
      </div>
    </div>
  );
}
