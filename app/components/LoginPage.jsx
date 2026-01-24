
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import LoginPleasantIcon from './LoginPleasantIcon';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const from = (location.state && location.state.from && location.state.from.pathname) || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const ok = await auth.login(username, password);
    if (ok) {
      navigate(from, { replace: true });
    } else {
      setError('Invalid credentials');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-light) 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0
    }}>
      <div className="card shadow-lg" style={{
        width: 370,
        background: 'var(--color-bg-light)',
        border: 'none',
        borderRadius: 'var(--border-radius)',
        color: 'var(--color-text)',
        boxShadow: '0 4px 32px 0 rgba(0,0,0,0.18)'
      }}>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', padding: '2.2rem 2rem 2rem 2rem'}}>
          <LoginPleasantIcon style={{width: 80, height: 80, marginBottom: 18, boxShadow:'0 2px 12px #10131a55'}} />
          <h3 style={{fontWeight:'var(--font-weight-bold)', color:'var(--color-primary)', marginBottom: 18}}>Sign In</h3>
          <form onSubmit={handleSubmit} style={{width:'100%'}}>
            <div className="mb-3">
              <label className="form-label" style={{color:'var(--color-text-muted)'}}>Username</label>
              <input
                className="form-control"
                style={{background:'var(--color-bg)', color:'var(--color-text)', border:'1px solid var(--color-border)'}}
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="form-label" style={{color:'var(--color-text-muted)'}}>Password</label>
              <input
                type="password"
                className="form-control"
                style={{background:'var(--color-bg)', color:'var(--color-text)', border:'1px solid var(--color-border)'}}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="mb-2" style={{color:'var(--color-accent)', fontWeight:500}}>{error}</div>}
            <button type="submit" className="btn btn-primary w-100" style={{background:'var(--color-primary)', border:'none', color:'var(--color-bg)', fontWeight:600, fontSize:'1.08rem', borderRadius:'var(--border-radius)', marginTop:6}}>Login</button>
          </form>
        </div>
      </div>
    </div>
  );
}
