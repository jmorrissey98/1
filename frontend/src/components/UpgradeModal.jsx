import { useState, useEffect } from 'react';
import { Star, Loader2, Check, X, ExternalLink, ArrowRight, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { safeGet, safePost } from '../lib/safeFetch';

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

export function UpgradeModal({ open, onOpenChange, onSubscriptionChange }) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingTier, setLoadingTier] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [loadingBillingPortal, setLoadingBillingPortal] = useState(false);
  
  // Current subscription state
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  
  // Confirmation step state
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch current subscription when modal opens
  useEffect(() => {
    if (open) {
      fetchCurrentSubscription();
    } else {
      // Reset state when modal closes
      setShowConfirmation(false);
      setSelectedTier(null);
    }
  }, [open]);

  // Set billing toggle to match current subscription
  useEffect(() => {
    if (currentSubscription?.billing_period) {
      setIsAnnual(currentSubscription.billing_period === 'annual');
    }
  }, [currentSubscription]);

  const fetchCurrentSubscription = async () => {
    setLoadingSubscription(true);
    try {
      const result = await safeGet(`${API_URL}/api/payments/subscription-details`);
      if (result.ok && result.data) {
        setCurrentSubscription(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleTierClick = (tier) => {
    const currentTier = currentSubscription?.tier;
    const currentBillingPeriod = currentSubscription?.billing_period;
    const newBillingPeriod = isAnnual ? 'annual' : 'monthly';
    
    // Check if this is the exact same plan (same tier AND billing period)
    const isSamePlan = tier.id === currentTier && newBillingPeriod === currentBillingPeriod;
    
    if (isSamePlan) {
      // Same plan - show manage billing option
      setSelectedTier({ ...tier, action: 'manage' });
    } else if (currentSubscription?.has_subscription) {
      // Different plan with existing subscription - show confirmation
      setSelectedTier({ ...tier, action: 'change' });
      setShowConfirmation(true);
    } else {
      // No subscription - go to checkout
      handleNewSubscription(tier);
    }
  };

  const handleNewSubscription = async (tier) => {
    setLoadingTier(tier.id);
    
    try {
      const result = await safePost(`${API_URL}/api/payments/checkout`, {
        tier_id: tier.id,
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
      setLoadingTier(null);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedTier) return;
    
    setLoadingTier(selectedTier.id);
    
    try {
      const result = await safePost(`${API_URL}/api/payments/update-subscription`, {
        tier_id: selectedTier.id,
        billing_period: isAnnual ? 'annual' : 'monthly'
      });
      
      if (result.ok && result.data?.success) {
        toast.success(`Plan updated to ${selectedTier.name}!`);
        setShowConfirmation(false);
        onOpenChange(false);
        // Trigger refresh of subscription data
        if (onSubscriptionChange) {
          onSubscriptionChange();
        }
      } else {
        toast.error(result.data?.detail || 'Failed to update subscription');
      }
    } catch (err) {
      toast.error('Failed to update subscription');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManageBilling = async () => {
    setLoadingBillingPortal(true);
    try {
      const result = await safePost(`${API_URL}/api/payments/billing-portal`, {
        return_url: `${window.location.origin}/settings`
      });
      
      if (result.ok && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error || 'Failed to open billing portal');
      }
    } catch (err) {
      toast.error('Failed to open billing management');
    } finally {
      setLoadingBillingPortal(false);
    }
  };

  const getCurrentTierInfo = () => {
    if (!currentSubscription?.tier) return null;
    return PRICING_TIERS.find(t => t.id === currentSubscription.tier);
  };

  const getStatusBadge = () => {
    if (!currentSubscription?.status) return null;
    
    const status = currentSubscription.status;
    const cancelAtEnd = currentSubscription.cancel_at_period_end;
    
    if (cancelAtEnd) {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
          <AlertCircle className="w-3 h-3 mr-1" />
          Cancels at period end
        </Badge>
      );
    }
    
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'past_due':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Payment overdue
          </Badge>
        );
      case 'trialing':
        return <Badge className="bg-blue-500">Trial</Badge>;
      default:
        return null;
    }
  };

  // Confirmation dialog for plan changes
  if (showConfirmation && selectedTier) {
    const currentTierInfo = getCurrentTierInfo();
    const newPrice = isAnnual ? selectedTier.annualPrice : selectedTier.monthlyPrice;
    const currentPrice = currentTierInfo 
      ? (currentSubscription?.billing_period === 'annual' ? currentTierInfo.annualPrice : currentTierInfo.monthlyPrice)
      : 0;
    const isUpgrade = newPrice > currentPrice;
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Confirm Plan {isUpgrade ? 'Upgrade' : 'Change'}
            </DialogTitle>
            <DialogDescription>
              Review your plan change before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current Plan */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-medium mb-1">Current Plan</p>
              <p className="font-semibold text-slate-900">
                {currentTierInfo?.name || 'None'} 
                <span className="text-slate-500 font-normal ml-1">
                  ({currentSubscription?.billing_period || 'N/A'})
                </span>
              </p>
              {currentTierInfo && (
                <p className="text-sm text-slate-600">
                  £{currentSubscription?.billing_period === 'annual' ? currentTierInfo.annualPrice : currentTierInfo.monthlyPrice}
                  /{currentSubscription?.billing_period === 'annual' ? 'year' : 'month'}
                </p>
              )}
            </div>
            
            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-slate-400" />
            </div>
            
            {/* New Plan */}
            <div className={`p-4 rounded-lg ${isUpgrade ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <p className="text-xs text-slate-500 uppercase font-medium mb-1">New Plan</p>
              <p className="font-semibold text-slate-900">
                {selectedTier.name}
                <span className="text-slate-500 font-normal ml-1">
                  ({isAnnual ? 'annual' : 'monthly'})
                </span>
              </p>
              <p className="text-sm text-slate-600">
                £{newPrice}/{isAnnual ? 'year' : 'month'}
              </p>
            </div>
            
            {/* Proration Note */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Stripe will calculate any billing adjustment automatically. 
                {isUpgrade 
                  ? " You'll be charged the prorated difference." 
                  : " You may receive a credit for unused time."}
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmation(false)}
              disabled={loadingTier !== null}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSubscription}
              disabled={loadingTier !== null}
              className={isUpgrade ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {loadingTier === selectedTier.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                `Confirm ${isUpgrade ? 'Upgrade' : 'Change'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-center gap-3">
            <DialogTitle className="text-2xl font-bold text-center">
              {currentSubscription?.has_subscription ? 'Manage Your Plan' : 'Choose Your Plan'}
            </DialogTitle>
            {getStatusBadge()}
          </div>
          <DialogDescription className="text-center">
            {currentSubscription?.has_subscription 
              ? 'Upgrade, downgrade, or manage your billing'
              : 'Select the plan that fits your organization\'s needs'
            }
          </DialogDescription>
        </DialogHeader>

        {loadingSubscription ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
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
                const isCurrentTier = tier.id === currentSubscription?.tier;
                const currentBillingPeriod = currentSubscription?.billing_period;
                const selectedBillingPeriod = isAnnual ? 'annual' : 'monthly';
                const isExactCurrentPlan = isCurrentTier && currentBillingPeriod === selectedBillingPeriod;
                
                return (
                  <Card 
                    key={tier.id} 
                    className={`relative transition-all ${
                      tier.popular ? 'border-2 border-blue-500 shadow-lg' : 'border-slate-200'
                    } ${
                      isCurrentTier ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
                    }`}
                  >
                    {tier.popular && !isCurrentTier && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-500 text-white px-3 py-0.5 text-xs">
                          <Star className="w-3 h-3 mr-1 inline" />
                          Popular
                        </Badge>
                      </div>
                    )}
                    {isCurrentTier && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-emerald-500 text-white px-3 py-0.5 text-xs">
                          <Check className="w-3 h-3 mr-1 inline" />
                          Current Plan
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
                    <CardFooter className="pt-2 flex flex-col gap-2">
                      {isExactCurrentPlan ? (
                        <>
                          <Button 
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleManageBilling}
                            disabled={loadingBillingPortal}
                            data-testid={`manage-billing-${tier.id}`}
                          >
                            {loadingBillingPortal ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Manage Billing
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="ghost"
                            className="w-full text-slate-500"
                            onClick={() => onOpenChange(false)}
                          >
                            Keep Current Plan
                          </Button>
                        </>
                      ) : (
                        <Button 
                          className={`w-full ${
                            tier.popular 
                              ? 'bg-blue-500 hover:bg-blue-600' 
                              : 'bg-slate-900 hover:bg-slate-800'
                          }`}
                          onClick={() => handleTierClick(tier)}
                          disabled={loadingTier !== null}
                          data-testid={`upgrade-select-${tier.id}`}
                        >
                          {loadingTier === tier.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : currentSubscription?.has_subscription ? (
                            isCurrentTier ? 'Switch Billing' : 'Select Plan'
                          ) : (
                            'Select Plan'
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Footer note */}
            <p className="text-center text-sm text-slate-500 mt-4">
              All plans include unlimited sessions, cloud sync, and email support.
            </p>
            
            {/* Billing portal link for existing subscribers */}
            {currentSubscription?.has_subscription && (
              <div className="text-center mt-2 pb-2">
                <button
                  onClick={handleManageBilling}
                  disabled={loadingBillingPortal}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  {loadingBillingPortal ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3 h-3" />
                  )}
                  View invoices & payment methods in Stripe
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
