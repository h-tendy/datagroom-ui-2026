import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function PrivateRoute({ children }) {
  const location = useLocation();

  if (typeof window === 'undefined') {
    // Server-side render: avoid accessing localStorage and don't attempt navigation.
    // Return children during SSR so the server can render the app shell.
    return children;
  }

  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
