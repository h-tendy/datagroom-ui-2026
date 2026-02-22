import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginApi, logoutApi, sessionCheckApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  let init = false;
  let initUserId = '';
  let hasValidToken = false;
  
  try {
    init = localStorage.getItem('isAuthenticated') === 'true';
    initUserId = localStorage.getItem('userId') || '';
    
    // Verify we have a valid token in localStorage
    if (init) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          hasValidToken = !!(user && user.token);
          if (!hasValidToken) {
            console.warn('No token found in localStorage, clearing auth state');
            // Clear invalid auth state
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userId');
            init = false;
            initUserId = '';
          }
        } catch (e) {
          console.error('Failed to parse user from localStorage:', e);
          // Clear corrupted data
          localStorage.removeItem('user');
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('userId');
          init = false;
          initUserId = '';
        }
      } else {
        console.warn('isAuthenticated=true but no user in localStorage, clearing auth state');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('userId');
        init = false;
        initUserId = '';
      }
    }
  } catch (e) {
    init = false;
    initUserId = '';
  }
  
  const [isAuthenticated, setIsAuthenticated] = useState(init);
  const [userId, setUserId] = useState(initUserId);
  
  useEffect(() => {
    // Only validate session if we're authenticated AND have a valid token
    if (!isAuthenticated) return;
    
    // Double-check token exists before calling sessionCheck
    let userToken = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        userToken = user?.token;
      }
    } catch (e) {
      console.error('Failed to get token from localStorage:', e);
    }
    
    if (!userToken) {
      console.warn('No token available for sessionCheck, logging out');
      logout();
      window.location.href = '/login';
      return;
    }
    
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
      // loginApi now returns { user: parsedUserObject, redirectUrl }
      if (!obj || !obj.user) {
        console.error('Login response missing user data');
        return false;
      }
      const savedUser = obj.user;
      const savedUserId = savedUser.id || savedUser.username || username;
      
      // Store user object with token (critical for Bearer auth)
      if (savedUser.token) {
        localStorage.setItem('user', JSON.stringify(savedUser));
        console.log('Login successful, token stored:', savedUser.token.substring(0, 20) + '...');
      } else {
        console.warn('Login response missing token!');
        return false;
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
