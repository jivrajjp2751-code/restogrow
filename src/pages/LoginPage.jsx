import { useState, useEffect } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { authenticateUser } from '../store/data';
import { Loader2, ShieldCheck, HelpCircle } from 'lucide-react';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, config, tenantId } = useApp();
  const { addToast } = useToast();

  const handlePush = (digit) => {
    if (pin.length < 4) setPin(p => p + digit);
  };
  const handleClear = () => setPin('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!tenantId || loading) return;
      if (e.key >= '0' && e.key <= '9') {
        setPin(p => p.length < 4 ? p + e.key : p);
      } else if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1));
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Delete') {
        setPin('');
      } else if (e.key === 'Enter') {
        // Find the login button and click it to trigger the state-dependent login logic
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn && !loginBtn.disabled) loginBtn.click();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tenantId, loading]);

  const handleLogin = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const user = await authenticateUser(pin);
      login(user);
      addToast(`Welcome back, ${user.name}!`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="login-container splash" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="resto-logo-spin" style={{ marginBottom: '24px' }}>RG</div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>RestoGrow POS</h1>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ShieldCheck size={40} style={{ color: '#6C5CE7', marginBottom: '12px' }} />
          <p style={{ color: '#5A5E73', fontSize: '14px', lineHeight: 1.6 }}>
             This is a private RestoGrow terminal.<br/>
             Please open your <b>assigned restaurant link</b> to access the PIN keypad.
          </p>
        </div>
        <p style={{ color: '#31344B', fontSize: '11px', marginTop: '40px' }}>&copy; 2026 RestoGrow Cloud Platforms</p>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
           <div className="resto-logo-small">RG</div>
           <h2>{config.restaurantName || 'RestoGrow POS'}</h2>
           <p>Enter your personnel PIN</p>
        </div>

        <div className="pin-dots">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`dot ${pin.length > i ? 'active' : ''}`} />
          ))}
        </div>

        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} className="key" onClick={() => handlePush(num.toString())}>{num}</button>
          ))}
          <button className="key clear" onClick={handleClear}>C</button>
          <button className="key" onClick={() => handlePush('0')}>0</button>
          <button className="key login-btn" disabled={pin.length < 4 || loading} onClick={handleLogin}>
            {loading ? <Loader2 className="animate-spin" /> : '➜'}
          </button>
        </div>

        <div className="login-footer">
          <HelpCircle size={14} /> Forgot PIN? Contact your administrator.
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: '20px', color: '#31344B', fontSize: '10px', left: '50%', transform: 'translateX(-50%)' }}>
        RestoGrow v1.0.0-Cloud | Multi-Tenant ID: {tenantId.substring(0, 8)}...
      </div>
    </div>
  );
}
