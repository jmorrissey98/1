import { useState } from 'react';
import { AlertCircle, Loader2, Check, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { safePost } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Default pricing tiers
const DEFAULT_PRICING_TIERS = [
  {
    id: 'individual_coach',
    name: 'Individual Coach',
    monthlyPrice: 5,
    annualPrice: 50,
  },
  {
    id: 'coach_developer',
    name: 'Coach Developer',
    monthlyPrice: 15,
    annualPrice: 150,
  },
  {
    id: 'club',
    name: 'Club',
    monthlyPrice: 60,
    annualPrice: 600,
  }
];

/**
 * Trial Expired Modal
 * This modal blocks access to the app when a user's trial has expired.
 * It cannot be dismissed - user must subscribe to continue.
 */
export function TrialExpiredModal({ 
  open, 
  trialTierKey,
  trialTierName,
  onSubscribe 
}) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedTier, setSelectedTier] = useState(trialTierKey || 'coach_developer');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    
    try {
      const result = await safePost(`${API_URL}/api/payments/checkout`, {
        tier_id: selectedTier,
        billing_period: isAnnual ? 'annual' : 'monthly',
        origin_url: window.location.origin + '/settings'
      });
      
      if (result.ok && (result.data?.url || result.data?.checkout_url)) {
        window.location.href = result.data.url || result.data.checkout_url;
      } else {
        toast.error(result.data?.detail || 'Failed to start checkout');
      }
    } catch (err) {
      toast.error('Failed to process subscription');
    } finally {
      setLoading(false);
    }
  };

  const currentTier = DEFAULT_PRICING_TIERS.find(t => t.id === selectedTier) || DEFAULT_PRICING_TIERS[1];
  const price = isAnnual ? currentTier.annualPrice : currentTier.monthlyPrice;

  return (
    <Dialog open={open} onOpenChange={() => {/* Cannot be closed */}}>
      <DialogContent 
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <DialogTitle className="text-xl font-bold text-center">
            Your Free Trial Has Ended
          </DialogTitle>
          <DialogDescription className="text-center">
            Subscribe now to continue using My Coach Developer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reassurance message */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Your data is safe!
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    All your coaches, observations, and data are preserved. 
                    Subscribe to pick up right where you left off.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Select your plan:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DEFAULT_PRICING_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedTier === tier.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  data-testid={`expired-plan-${tier.id}`}
                >
                  <p className="font-medium text-sm text-slate-900">{tier.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    £{isAnnual ? tier.annualPrice : tier.monthlyPrice}/{isAnnual ? 'yr' : 'mo'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 py-2">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              data-testid="expired-billing-toggle"
            />
            <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                2 months free
              </Badge>
            )}
          </div>

          {/* Price Summary */}
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">
              £{price}
              <span className="text-sm font-normal text-slate-500">
                /{isAnnual ? 'year' : 'month'}
              </span>
            </p>
            {isAnnual && (
              <p className="text-xs text-slate-500 mt-1">
                That's just £{(price / 12).toFixed(0)}/month
              </p>
            )}
          </div>
        </div>

        <Button 
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-800"
          size="lg"
          data-testid="expired-subscribe-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Subscribe to {currentTier.name}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-slate-500 mt-2">
          Secure payment powered by Stripe. Cancel anytime.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default TrialExpiredModal;
