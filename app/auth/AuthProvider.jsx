import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginApi, logoutApi, sessionCheckApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  let init = false;
  let initUserId = '';
  try {
    init = localStorage.getItem('isAuthenticated') === 'true';
    initUserId = localStorage.getItem('userId') || '';
  } catch (e) {
    init = false;
    initUserId = '';
  }
  const [isAuthenticated, setIsAuthenticated] = useState(init);
  const [userId, setUserId] = useState(initUserId);
  useEffect(() => {
    // validate session with backend on mount
    let mounted = true;
    (async function check() {
      try {
        const valid = await sessionCheckApi({ user: userId });
        if (!valid && mounted) {
          // sessionCheck in reference returned non-ok to indicate invalid session
          logout();
          // Redirect to login after logout
          window.location.href = '/login';
        }
      } catch (e) {
        // treat errors (like 401) as invalid session
        console.log('Session check failed, logging out:', e.message);
        if (mounted && isAuthenticated) {
          logout();
          // Redirect to login after logout
          window.location.href = '/login';
        }
      }
    })();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  async function login(username, password) {
    try {
      const obj = await loginApi(username, password);
      // reference handleResponse returned { user: JSON.parse(data.user), redirectUrl }
      // backend returned obj.user and maybe obj.redirectUrl
      const savedUser = obj.user || obj;
      const savedUserId = savedUser?.id || savedUser?.username || username;
      if (savedUser?.token) {
        // keep full user object like reference did
        localStorage.setItem('user', JSON.stringify(savedUser));
      }
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userId', savedUserId);
      setIsAuthenticated(true);
      setUserId(savedUserId);
      // handle redirectUrl if provided by backend
      if (obj.redirectUrl) {
        try { window.location.href = obj.redirectUrl; } catch (e) { /* ignore */ }
      }
      return true;
    } catch (err) {
      console.error('Login failed', err);
      return false;
    }
  }

  async function logout() {
    try {
      await logoutApi();
    } catch (e) {
      // ignore logout errors
    }
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUserId('');
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, userId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
