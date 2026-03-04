// Subscription and limits API
// Handles fetching subscription tier info and observation limits

import { safeGet, safePost, safePut } from './safeFetch';

const API_URL = '';

// Cache for limits summary (short TTL since it can change)
let limitsSummaryCache = null;
let limitsSummaryCacheTime = 0;
const LIMITS_CACHE_TTL = 60 * 1000; // 1 minute

// Cache for migration status
let migrationStatusCache = null;
let migrationStatusCacheTime = 0;

// Cache for coach observation status (per request cache)
const coachObservationStatusCache = new Map();

/**
 * Get the complete limits summary for the current user's organization.
 * This includes tier info, coach limits, observation limits, etc.
 */
export const fetchLimitsSummary = async (forceRefresh = false) => {
  const now = Date.now();
  
  // Return cached if valid and not forcing refresh
  if (!forceRefresh && limitsSummaryCache && (now - limitsSummaryCacheTime < LIMITS_CACHE_TTL)) {
    return { ok: true, data: limitsSummaryCache, fromCache: true };
  }
  
  const result = await safeGet(`${API_URL}/api/subscriptions/limits-summary`);
  
  if (result.ok && result.data) {
    limitsSummaryCache = result.data;
    limitsSummaryCacheTime = now;
  }
  
  return result;
};

/**
 * Get migration status for the current user's organization.
 * Used to show migration banner for legacy users.
 */
export const fetchMigrationStatus = async (forceRefresh = false) => {
  const now = Date.now();
  
  // Return cached if valid and not forcing refresh
  if (!forceRefresh && migrationStatusCache && (now - migrationStatusCacheTime < LIMITS_CACHE_TTL)) {
    return { ok: true, data: migrationStatusCache, fromCache: true };
  }
  
  const result = await safeGet(`${API_URL}/api/subscriptions/my-migration-status`);
  
  if (result.ok && result.data) {
    migrationStatusCache = result.data;
    migrationStatusCacheTime = now;
  }
  
  return result;
};

/**
 * Migrate early to the new tier system.
 * @param {string} targetTier - Optional target tier (defaults to mapped tier)
 */
export const migrateEarly = async (targetTier = null) => {
  const result = await safePost(`${API_URL}/api/subscriptions/migrate-early`, {
    target_tier: targetTier
  });
  
  // Clear caches after migration
  if (result.ok) {
    migrationStatusCache = null;
    limitsSummaryCache = null;
  }
  
  return result;
};

/**
 * Clear all subscription caches.
 * Call this after subscription changes.
 */
export const clearSubscriptionCaches = () => {
  limitsSummaryCache = null;
  limitsSummaryCacheTime = 0;
  migrationStatusCache = null;
  migrationStatusCacheTime = 0;
  coachObservationStatusCache.clear();
};

/**
 * Get observation limit status for a specific coach.
 * Returns: { can_observe, current_count, limit, is_unlimited, message, tier_key }
 */
export const fetchCoachObservationLimit = async (coachId) => {
  if (!coachId || coachId === 'none') {
    return { ok: false, error: 'No coach ID provided' };
  }
  
  const result = await safeGet(`${API_URL}/api/subscriptions/observation-limit/${coachId}`);
  return result;
};

/**
 * Get observation status for multiple coaches at once.
 * More efficient than calling fetchCoachObservationLimit for each coach.
 * 
 * @param {string[]} coachIds - Array of coach IDs
 * @returns Object mapping coach_id -> observation status
 */
export const fetchBulkCoachObservationStatus = async (coachIds) => {
  if (!coachIds || coachIds.length === 0) {
    return { ok: true, data: {} };
  }
  
  // Filter out invalid IDs
  const validIds = coachIds.filter(id => id && id !== 'none');
  if (validIds.length === 0) {
    return { ok: true, data: {} };
  }
  
  const result = await safePost(`${API_URL}/api/subscriptions/observation-limit/batch`, {
    coach_ids: validIds
  });
  
  return result;
};

/**
 * Get all available subscription tiers for display.
 */
export const fetchAvailableTiers = async () => {
  const result = await safeGet(`${API_URL}/api/subscriptions/available-tiers`);
  return result;
};

/**
 * Get pricing comparison data for pricing pages.
 */
export const fetchPricingComparison = async () => {
  const result = await safeGet(`${API_URL}/api/subscriptions/pricing-comparison`);
  return result;
};

/**
 * Clear the limits summary cache.
 * Call this after subscription changes.
 * @deprecated Use clearSubscriptionCaches() instead
 */
export const clearLimitsCache = () => {
  clearSubscriptionCaches();
};

/**
 * Format observation limit for display.
 * @returns string like "3/10 observations" or "Unlimited"
 */
export const formatObservationLimit = (status) => {
  if (!status) return '';
  
  if (status.is_unlimited || status.limit === null) {
    return 'Unlimited';
  }
  
  return `${status.current_count}/${status.limit}`;
};

/**
 * Get CSS class for observation limit status.
 */
export const getObservationLimitClass = (status) => {
  if (!status) return '';
  
  if (status.is_unlimited || status.limit === null) {
    return 'text-green-600';
  }
  
  if (!status.can_observe) {
    return 'text-red-600';
  }
  
  // Warning when at 80% or more
  const percentage = (status.current_count / status.limit) * 100;
  if (percentage >= 80) {
    return 'text-amber-600';
  }
  
  return 'text-slate-600';
};

/**
 * Check if the user can observe a specific coach.
 * Returns a user-friendly result object.
 */
export const canObserveCoach = (status) => {
  if (!status) {
    return {
      allowed: true,
      reason: null,
      showWarning: false
    };
  }
  
  if (status.is_unlimited || status.limit === null) {
    return {
      allowed: true,
      reason: null,
      showWarning: false
    };
  }
  
  if (!status.can_observe) {
    return {
      allowed: false,
      reason: status.message || `This coach has reached the observation limit (${status.limit}). Upgrade your subscription to continue.`,
      showWarning: true
    };
  }
  
  // Warning at 80% capacity
  const remaining = status.limit - status.current_count;
  if (remaining <= 2 && remaining > 0) {
    return {
      allowed: true,
      reason: `Only ${remaining} observation${remaining === 1 ? '' : 's'} remaining for this coach`,
      showWarning: true
    };
  }
  
  return {
    allowed: true,
    reason: null,
    showWarning: false
  };
};
