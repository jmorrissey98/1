import { createContext, useContext, useState, useEffect } from 'react';
import { safeGet, safePost } from '../lib/safeFetch';

const AuthContext = createContext(null);

export const USER_ROLES = {
  COACH_DEVELOPER: 'coach_developer',
  COACH: 'coach'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use relative URL for API calls - this ensures cookies work correctly
  // since frontend and backend are served from the same domain
  const API_URL = '';

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const result = await safeGet(`${API_URL}/api/auth/me`);
      
      // On network error or not authenticated, just set user to null (don't show error)
      if (result.networkError || !result.ok || !result.data) {
        setUser(null);
      } else {
        setUser(result.data);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Google login has been removed - email/password auth only
  const login = () => {
    console.warn('Google login has been disabled. Please use email/password.');
  };

  const processSessionId = async (sessionId) => {
    try {
      const result = await safePost(`${API_URL}/api/auth/session`, { session_id: sessionId });
      
      // Handle network errors gracefully
      if (result.networkError) {
        throw new Error(result.data?.detail || 'Connection failed. Please try again.');
      }
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Authentication failed');
      }

      setUser(result.data);
      return result.data;
    } catch (err) {
      setError(err.message || 'Authentication failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await safePost(`${API_URL}/api/auth/logout`, {});
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

  const isAdmin = () => {
    return user?.role === 'admin';
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
      isAdmin,
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
