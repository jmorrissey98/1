import { createContext, useContext, useState, useEffect } from 'react';
import { safeGet, safePost, setAuthToken, clearAuthToken, getAuthToken } from '../lib/safeFetch';
import { identifyUser, clearUserIdentity } from '../lib/analytics';

const AuthContext = createContext(null);

export const USER_ROLES = {
  COACH_DEVELOPER: 'coach_developer',
  COACH: 'coach'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use explicit backend URL for API calls
  const API_URL = process.env.REACT_APP_BACKEND_URL || '';

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Only try to check auth if we have a token stored
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      const result = await safeGet(`${API_URL}/api/auth/me`);
      
      // On network error or not authenticated, just set user to null (don't show error)
      if (result.networkError || !result.ok || !result.data) {
        setUser(null);
        // Clear invalid token
        if (result.status === 401) {
          clearAuthToken();
        }
      } else {
        setUser(result.data);
        // Identify user in analytics
        if (result.data?.user_id) {
          identifyUser(result.data.user_id);
        }
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

      // Store token if provided
      if (result.data?.token) {
        setAuthToken(result.data.token);
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
    clearAuthToken();
    setUser(null);
  };

  const isCoachDeveloper = () => {
    // Admin users have coach developer privileges
    return user?.role === USER_ROLES.COACH_DEVELOPER || user?.role === 'admin';
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
