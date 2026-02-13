import { createContext, useContext, useState, useEffect } from 'react';
import { safeGet, safePut } from '../lib/safeFetch';
import { useAuth } from './AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      loadOrganization();
    } else if (!authLoading && !user) {
      setOrganization(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  const loadOrganization = async () => {
    try {
      const result = await safeGet(`${API_URL}/api/organization`);
      if (result.ok && result.data) {
        setOrganization(result.data);
      }
    } catch (err) {
      console.error('Failed to load organization:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (data) => {
    try {
      const result = await safePut(`${API_URL}/api/organization`, data);
      if (result.ok && result.data) {
        setOrganization(result.data);
        return { ok: true, data: result.data };
      }
      return { ok: false, error: result.data?.detail || 'Failed to update' };
    } catch (err) {
      console.error('Failed to update organization:', err);
      return { ok: false, error: err.message };
    }
  };

  return (
    <OrganizationContext.Provider value={{ 
      organization, 
      loading, 
      updateOrganization,
      refreshOrganization: loadOrganization 
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
