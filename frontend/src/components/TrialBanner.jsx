import { useState } from 'react';
import { Clock, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Trial Banner Component
 * Shows a persistent banner for trial users displaying:
 * - Days remaining in trial
 * - Upgrade CTA
 * Can be dismissed but reappears on page reload
 */
export function TrialBanner({ daysRemaining, tierName, onUpgradeClick }) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show if dismissed or no data
  if (dismissed || daysRemaining === null || daysRemaining === undefined) {
    return null;
  }
  
  // Determine urgency level for styling
  const isUrgent = daysRemaining <= 3;
  const isWarning = daysRemaining <= 7 && !isUrgent;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-center gap-4 text-sm ${
        isUrgent 
          ? 'bg-red-500 text-white' 
          : isWarning 
            ? 'bg-amber-500 text-white'
            : 'bg-blue-500 text-white'
      }`}
      data-testid="trial-banner"
    >
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <Clock className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        <span>
          <strong>{tierName || 'Trial'}</strong>
          {' - '}
          {daysRemaining === 0 ? (
            <span>Expires today!</span>
          ) : daysRemaining === 1 ? (
            <span>1 day remaining</span>
          ) : (
            <span>{daysRemaining} days remaining</span>
          )}
        </span>
      </div>
      
      <Button
        size="sm"
        variant="secondary"
        className={`h-7 px-3 text-xs font-medium ${
          isUrgent 
            ? 'bg-white text-red-600 hover:bg-red-50' 
            : isWarning
              ? 'bg-white text-amber-600 hover:bg-amber-50'
              : 'bg-white text-blue-600 hover:bg-blue-50'
        }`}
        onClick={onUpgradeClick}
        data-testid="trial-upgrade-btn"
      >
        Subscribe Now
      </Button>

      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 p-1 hover:bg-white/20 rounded"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default TrialBanner;
