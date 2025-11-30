import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function RequireAuth({ children }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = React.useState(auth.isAuthenticated);

  useEffect(() => {
    setIsReady(auth.isAuthenticated);
    if (!auth.isAuthenticated) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [auth.isAuthenticated, navigate, location]);

  if (!isReady) {
    return <div>Loading...</div>;
  }
  return children;
}
