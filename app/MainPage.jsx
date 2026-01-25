import React from 'react';
import { useAuth } from './auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import SidebarLayout from './SidebarLayout';
import 'bootstrap/dist/css/bootstrap.min.css';
import AllDsPage from './pages/AllDs/AllDsPage';

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
          <AllDsPage currentUserId={auth.userId} />
        </div>
    </SidebarLayout>
  );
}
