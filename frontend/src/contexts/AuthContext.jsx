import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const USER_ROLES = {
  COACH_DEVELOPER: 'coach_developer',
  COACH: 'coach'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL || '';

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const text = await response.text();
        let userData;
        try {
          userData = text ? JSON.parse(text) : null;
        } catch (parseErr) {
          console.error('Failed to parse user data:', parseErr);
          setUser(null);
          return;
        }
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const processSessionId = async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ session_id: sessionId })
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        console.error('Failed to parse auth response:', text);
        throw new Error('Authentication failed - server error');
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      setUser(data);
      return data;
    } catch (err) {
      setError(err.message || 'Authentication failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
  };

  const isCoachDeveloper = () => {
    return user?.role === USER_ROLES.COACH_DEVELOPER;
  };

  const isCoach = () => {
    return user?.role === USER_ROLES.COACH;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout,
      processSessionId,
      checkAuth,
      isCoachDeveloper,
      isCoach,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
