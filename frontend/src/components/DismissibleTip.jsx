import { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';

const DISMISSED_TIPS_KEY = 'mcd_dismissed_tips';

// Get list of dismissed tip IDs from localStorage
const getDismissedTips = () => {
  try {
    const stored = localStorage.getItem(DISMISSED_TIPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save dismissed tip ID to localStorage
const saveDismissedTip = (tipId) => {
  try {
    const dismissed = getDismissedTips();
    if (!dismissed.includes(tipId)) {
      dismissed.push(tipId);
      localStorage.setItem(DISMISSED_TIPS_KEY, JSON.stringify(dismissed));
    }
  } catch (e) {
    console.warn('Failed to save dismissed tip:', e);
  }
};

// Check if a tip has been dismissed
export const isTipDismissed = (tipId) => {
  return getDismissedTips().includes(tipId);
};

export default function DismissibleTip({ tipId, children, className = '' }) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    // Check localStorage on mount
    setIsDismissed(isTipDismissed(tipId));
  }, [tipId]);

  const handleDismiss = () => {
    saveDismissedTip(tipId);
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 ${className}`}>
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          {children}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-100 -mt-1 -mr-1"
          title="Dismiss this tip permanently"
          data-testid={`dismiss-tip-${tipId}`}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
