/**
 * useDataPrefetch - Prefetches data for offline usage
 * 
 * Runs after successful authentication to cache critical data:
 * - Coaches list
 * - Observation templates
 * - Reflection templates
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchCoaches } from '../lib/offlineApi';
import { fetchObservationTemplates } from '../lib/observationTemplatesApi';
import { fetchReflectionTemplates } from '../lib/reflectionTemplatesApi';

export function useDataPrefetch() {
  const { user, loading: authLoading } = useAuth();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    // Only prefetch once per session when user is authenticated
    if (authLoading || !user || hasPrefetched.current) {
      return;
    }

    // Skip for admin users
    if (user.role === 'admin') {
      return;
    }

    const prefetchData = async () => {
      console.log('[DataPrefetch] Starting data prefetch for offline usage...');
      
      try {
        // Prefetch coaches (most important for offline observations)
        const coachesResult = await fetchCoaches();
        if (coachesResult.ok) {
          console.log(`[DataPrefetch] Cached ${coachesResult.data?.length || 0} coaches`);
        }
      } catch (err) {
        console.error('[DataPrefetch] Failed to prefetch coaches:', err);
      }

      try {
        // Prefetch observation templates
        const templatesResult = await fetchObservationTemplates();
        if (templatesResult.ok) {
          console.log(`[DataPrefetch] Cached ${templatesResult.data?.length || 0} observation templates`);
        }
      } catch (err) {
        console.error('[DataPrefetch] Failed to prefetch observation templates:', err);
      }

      try {
        // Prefetch reflection templates
        const reflectionResult = await fetchReflectionTemplates();
        if (reflectionResult) {
          console.log(`[DataPrefetch] Cached ${reflectionResult?.length || 0} reflection templates`);
        }
      } catch (err) {
        console.error('[DataPrefetch] Failed to prefetch reflection templates:', err);
      }

      console.log('[DataPrefetch] Data prefetch complete');
      hasPrefetched.current = true;
    };

    // Delay prefetch slightly to not block initial render
    const timeoutId = setTimeout(prefetchData, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [user, authLoading]);

  // Reset prefetch flag when user changes (logout/login)
  useEffect(() => {
    if (!user) {
      hasPrefetched.current = false;
    }
  }, [user]);
}

export default useDataPrefetch;
