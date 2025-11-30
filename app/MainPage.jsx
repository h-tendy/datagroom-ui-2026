import React from 'react';
import { useAuth } from './auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import SidebarLayout from './SidebarLayout';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function MainPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    auth.logout();
    navigate('/login');
  }

  React.useEffect(() => {
    console.log('MainPage: rendered, isAuthenticated:', auth.isAuthenticated);
  }, [auth.isAuthenticated]);
  return (
    <SidebarLayout onLogout={handleLogout}>
      <div style={{ position: 'relative', width: '100%', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center', zIndex: 1, pointerEvents: 'none' }}>
          <h2 style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-bold)', margin: 0, paddingTop: 0, paddingBottom: 18 }}>Main Page</h2>
        </div>
        <div style={{ paddingTop: 60 }}>
          <p>You're logged in.</p>
          <div style={{marginTop:12, color:'var(--color-primary)', fontWeight:500}}>User ID: {auth.userId}</div>
        </div>
      </div>
    </SidebarLayout>
  );
}
