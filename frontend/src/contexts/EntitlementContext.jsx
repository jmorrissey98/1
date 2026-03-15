/**
 * EntitlementContext - Manages subscription entitlement state
 * 
 * Checks if user is entitled to use the app based on subscription status.
 * Shows blocking modal when not entitled.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { safeGet } from '../lib/safeFetch';
import { useAuth } from './AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const EntitlementContext = createContext(null);

export function EntitlementProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [entitlement, setEntitlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check entitlement from backend
  const checkEntitlement = useCallback(async () => {
    if (!user) {
      setEntitlement(null);
      setLoading(false);
      return;
    }

    // Skip entitlement check for admin users
    if (user.role === 'admin') {
      setEntitlement({
        is_entitled: true,
        reason: 'admin_user',
        subscription_status: null
      });
      setLoading(false);
      return;
    }

    try {
      const result = await safeGet(`${API_URL}/api/billing/entitlement`);
      
      if (result.ok && result.data) {
        setEntitlement(result.data);
        setError(null);
      } else {
        // On API error, fail open (allow access)
        console.error('Entitlement check failed:', result);
        setEntitlement({
          is_entitled: true,
          reason: 'api_error_fail_open',
          subscription_status: null
        });
        setError(result.data?.detail || 'Failed to check entitlement');
      }
    } catch (err) {
      console.error('Entitlement check error:', err);
      // Fail open on errors
      setEntitlement({
        is_entitled: true,
        reason: 'error_fail_open',
        subscription_status: null
      });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check entitlement when user changes
  useEffect(() => {
    if (!authLoading) {
      checkEntitlement();
    }
  }, [user, authLoading, checkEntitlement]);

  // Refresh entitlement (call after subscription changes)
  const refreshEntitlement = useCallback(async () => {
    setLoading(true);
    await checkEntitlement();
  }, [checkEntitlement]);

  const value = {
    entitlement,
    loading: loading || authLoading,
    error,
    isEntitled: entitlement?.is_entitled ?? true, // Default to true
    reason: entitlement?.reason,
    subscriptionStatus: entitlement?.subscription_status,
    cancelAtPeriodEnd: entitlement?.cancel_at_period_end,
    currentPeriodEnd: entitlement?.current_period_end,
    activeTier: entitlement?.active_tier,
    refreshEntitlement,
    // Trial-specific fields
    isTrial: entitlement?.is_trial ?? false,
    trialExpired: entitlement?.trial_expired ?? false,
    trialEndDate: entitlement?.trial_end_date,
    trialDaysRemaining: entitlement?.trial_days_remaining,
    trialTierName: entitlement?.trial_tier_name
  };

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement() {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlement must be used within an EntitlementProvider');
  }
  return context;
}
