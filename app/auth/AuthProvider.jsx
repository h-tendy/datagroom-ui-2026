import React, { createContext, useContext, useEffect, useState } from 'react';

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
    console.log('AuthProvider: isAuthenticated', isAuthenticated);
  }, [isAuthenticated]);

  function login(username, password) {
    // simple demo auth
    if (username === 'admin' && password === 'password') {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userId', username);
      setIsAuthenticated(true);
      setUserId(username);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
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
