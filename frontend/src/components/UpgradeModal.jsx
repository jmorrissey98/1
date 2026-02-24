import { useState } from 'react';
import { Star, Loader2, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { safePost } from '../lib/safeFetch';

// Use relative URL - works in both preview and production environments
const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const PRICING_TIERS = [
  {
    id: 'individual',
    name: 'Individual',
    subtitle: 'The Solo Developer',
    monthlyPrice: 20,
    annualPrice: 200,
    coaches: 5,
    admins: 1,
    dataRetention: '3 months',
    popular: false
  },
  {
    id: 'developer',
    name: 'Developer',
    subtitle: 'The Growth Specialist',
    monthlyPrice: 35,
    annualPrice: 350,
    coaches: 10,
    admins: 1,
    dataRetention: 'Unlimited',
    popular: true
  },
  {
    id: 'club',
    name: 'Club',
    subtitle: 'The Organization',
    monthlyPrice: 60,
    annualPrice: 600,
    coaches: 50,
    admins: 10,
    dataRetention: 'Unlimited',
    popular: false
  }
];

export function UpgradeModal({ open, onOpenChange, currentTier = null }) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingTier, setLoadingTier] = useState(null);

  const handleSelectPlan = async (tier) => {
    // Don't allow selecting the current tier
    if (tier.id === currentTier) {
      toast.info("You're already on this plan");
      return;
    }

    setLoadingTier(tier.id);
    
    try {
      // Use /api/payments/checkout endpoint - the correct Stripe checkout endpoint
      const result = await safePost(`${API_URL}/api/payments/checkout`, {
        tier_id: tier.id,
        billing_period: isAnnual ? 'annual' : 'monthly',
        origin_url: window.location.origin + '/settings'  // Redirect back to settings after payment
      });
      
      // The endpoint returns 'url' not 'checkout_url'
      if (result.ok && (result.data?.url || result.data?.checkout_url)) {
        window.location.href = result.data.url || result.data.checkout_url;
      } else {
        toast.error(result.data?.detail || 'Failed to start checkout');
      }
    } catch (err) {
      toast.error('Failed to process subscription');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Upgrade Your Plan</DialogTitle>
          <DialogDescription className="text-center">
            Choose the plan that fits your organization's needs
          </DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 py-4">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            data-testid="upgrade-billing-toggle"
          />
          <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
            Annual
          </span>
          <Badge variant="secondary" className="bg-green-100 text-green-700 ml-2">
            2 months free
          </Badge>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-4 p-2">
          {PRICING_TIERS.map((tier) => {
            const isCurrentTier = tier.id === currentTier;
            return (
              <Card 
                key={tier.id} 
                className={`relative ${tier.popular ? 'border-2 border-blue-500 shadow-lg' : 'border-slate-200'} ${isCurrentTier ? 'bg-slate-50' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-3 py-0.5 text-xs">
                      <Star className="w-3 h-3 mr-1 inline" />
                      Popular
                    </Badge>
                  </div>
                )}
                {isCurrentTier && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-emerald-500 text-white px-3 py-0.5 text-xs">
                      <Check className="w-3 h-3 mr-1 inline" />
                      Current
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2 pt-6">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">{tier.subtitle}</CardDescription>
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-slate-900">
                      £{isAnnual ? tier.annualPrice : tier.monthlyPrice}
                    </span>
                    <span className="text-slate-500 text-sm">/{isAnnual ? 'year' : 'month'}</span>
                  </div>
                  {isAnnual && (
                    <p className="text-xs text-green-600 mt-1">
                      £{(tier.annualPrice / 12).toFixed(0)}/month billed annually
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0 pb-2">
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Coach Developers</span>
                      <span className="font-medium text-slate-900">Up to {tier.admins}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Coaches</span>
                      <span className="font-medium text-slate-900">Up to {tier.coaches}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Data History</span>
                      <span className={`font-medium ${tier.dataRetention === 'Unlimited' ? 'text-green-600' : 'text-slate-900'}`}>
                        {tier.dataRetention}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    className={`w-full ${isCurrentTier ? 'bg-slate-300 cursor-not-allowed' : tier.popular ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                    onClick={() => handleSelectPlan(tier)}
                    disabled={loadingTier !== null || isCurrentTier}
                    data-testid={`upgrade-select-${tier.id}`}
                  >
                    {loadingTier === tier.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : isCurrentTier ? (
                      'Current Plan'
                    ) : (
                      'Select Plan'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-slate-500 mt-4">
          All plans include unlimited sessions, cloud sync, and email support.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
