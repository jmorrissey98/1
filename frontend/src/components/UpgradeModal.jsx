import { useState, useEffect } from 'react';
import { Star, Loader2, Check, ExternalLink, ArrowRight, ArrowDown, ArrowUp, AlertTriangle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { safeGet, safePost } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Tier order for determining upgrade vs downgrade (index = rank)
const TIER_RANK = { 'individual': 0, 'developer': 1, 'club': 2 };

// Default pricing tiers (will be overridden by API data)
const DEFAULT_PRICING_TIERS = [
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
    coaches: 30,
    admins: 5,
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

  const isUpgrade = (fromTier, toTier) => {
    const fromRank = TIER_RANK[fromTier] ?? -1;
    const toRank = TIER_RANK[toTier] ?? -1;
    return toRank > fromRank;
  };

  const isDowngrade = (fromTier, toTier) => {
    const fromRank = TIER_RANK[fromTier] ?? -1;
    const toRank = TIER_RANK[toTier] ?? -1;
    return toRank < fromRank;
  };

  const getDowngradeWarnings = (fromTier, toTier) => {
    const fromInfo = PRICING_TIERS.find(t => t.id === fromTier);
    const toInfo = PRICING_TIERS.find(t => t.id === toTier);
    if (!fromInfo || !toInfo) return [];
    
    const warnings = [];
    
    if (toInfo.coaches < fromInfo.coaches) {
      warnings.push(`Coach limit reduces from ${fromInfo.coaches} to ${toInfo.coaches}`);
    }
    if (toInfo.admins < fromInfo.admins) {
      warnings.push(`Admin limit reduces from ${fromInfo.admins} to ${toInfo.admins}`);
    }
    if (toInfo.dataRetention !== fromInfo.dataRetention && toInfo.dataRetention !== 'Unlimited') {
      warnings.push(`Data retention changes to ${toInfo.dataRetention}`);
    }
    
    return warnings;
  };

  const handleTierClick = (tier) => {
    const currentTier = currentSubscription?.tier;
    const currentBillingPeriod = currentSubscription?.billing_period;
    const newBillingPeriod = isAnnual ? 'annual' : 'monthly';
    
    // Check if this is the exact same plan (same tier AND billing period)
    const isSamePlan = tier.id === currentTier && newBillingPeriod === currentBillingPeriod;
    const isSameTierDifferentBilling = tier.id === currentTier && newBillingPeriod !== currentBillingPeriod;
    
    if (isSamePlan) {
      // Same plan - go to billing portal
      handleManageBilling();
    } else if (currentSubscription?.has_subscription) {
      // Different plan or different billing - show confirmation
      const action = isSameTierDifferentBilling ? 'billing_change' : 
                     isUpgrade(currentTier, tier.id) ? 'upgrade' : 'downgrade';
      setSelectedTier({ ...tier, action });
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

  const handlePlanChange = async () => {
    if (!selectedTier) return;
    
    // Use the update-subscription endpoint to modify existing subscription
    // This prevents creating duplicate subscriptions
    setLoadingTier(selectedTier.id);
    
    try {
      const result = await safePost(`${API_URL}/api/payments/update-subscription`, {
        tier_id: selectedTier.id,
        billing_period: isAnnual ? 'annual' : 'monthly'
      });
      
      if (result.ok && result.data?.success) {
        toast.success(result.data.message || 'Subscription updated successfully');
        // Refresh subscription status
        await fetchCurrentSubscription();
        // Close confirmation dialog
        setShowConfirmation(false);
        setSelectedTier(null);
        // Notify parent component if callback provided
        if (onSubscriptionChange) {
          onSubscriptionChange();
        }
      } else {
        toast.error(result.data?.detail || 'Failed to update subscription');
      }
    } catch (err) {
      toast.error('Failed to process plan change');
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

  const getButtonLabel = (tier) => {
    if (!currentSubscription?.has_subscription) {
      return 'Select Plan';
    }
    
    const currentTier = currentSubscription.tier;
    const currentBillingPeriod = currentSubscription.billing_period;
    const newBillingPeriod = isAnnual ? 'annual' : 'monthly';
    
    if (tier.id === currentTier && newBillingPeriod === currentBillingPeriod) {
      return 'Manage Billing';
    }
    
    if (tier.id === currentTier) {
      return newBillingPeriod === 'annual' ? 'Switch to Annual' : 'Switch to Monthly';
    }
    
    if (isUpgrade(currentTier, tier.id)) {
      return 'Upgrade';
    }
    
    return 'Downgrade';
  };

  const getButtonStyle = (tier) => {
    if (!currentSubscription?.has_subscription) {
      return tier.popular ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-900 hover:bg-slate-800';
    }
    
    const currentTier = currentSubscription.tier;
    const currentBillingPeriod = currentSubscription.billing_period;
    const newBillingPeriod = isAnnual ? 'annual' : 'monthly';
    
    if (tier.id === currentTier && newBillingPeriod === currentBillingPeriod) {
      return 'bg-emerald-600 hover:bg-emerald-700';
    }
    
    if (isUpgrade(currentTier, tier.id)) {
      return 'bg-green-600 hover:bg-green-700';
    }
    
    if (isDowngrade(currentTier, tier.id)) {
      return 'bg-orange-500 hover:bg-orange-600';
    }
    
    return 'bg-blue-500 hover:bg-blue-600';
  };

  // Confirmation dialog for plan changes
  if (showConfirmation && selectedTier) {
    const currentTierInfo = getCurrentTierInfo();
    const newPrice = isAnnual ? selectedTier.annualPrice : selectedTier.monthlyPrice;
    const isUpgradeAction = selectedTier.action === 'upgrade';
    const isDowngradeAction = selectedTier.action === 'downgrade';
    const downgradeWarnings = isDowngradeAction ? getDowngradeWarnings(currentSubscription.tier, selectedTier.id) : [];
    
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {isUpgradeAction && <ArrowUp className="w-5 h-5 text-green-600" />}
              {isDowngradeAction && <ArrowDown className="w-5 h-5 text-orange-600" />}
              Confirm Plan {isUpgradeAction ? 'Upgrade' : isDowngradeAction ? 'Downgrade' : 'Change'}
            </DialogTitle>
            <DialogDescription>
              Review your plan change before proceeding to payment
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
                  {currentTierInfo.coaches} coaches, {currentTierInfo.admins} admin(s)
                </p>
              )}
            </div>
            
            {/* Arrow */}
            <div className="flex justify-center">
              {isUpgradeAction ? (
                <ArrowUp className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDown className="w-5 h-5 text-orange-600" />
              )}
            </div>
            
            {/* New Plan */}
            <div className={`p-4 rounded-lg ${isUpgradeAction ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <p className="text-xs text-slate-500 uppercase font-medium mb-1">New Plan</p>
              <p className="font-semibold text-slate-900">
                {selectedTier.name}
                <span className="text-slate-500 font-normal ml-1">
                  ({isAnnual ? 'annual' : 'monthly'})
                </span>
              </p>
              <p className="text-sm text-slate-600">
                £{newPrice}/{isAnnual ? 'year' : 'month'} • {selectedTier.coaches} coaches, {selectedTier.admins} admin(s)
              </p>
            </div>
            
            {/* Downgrade Warnings */}
            {isDowngradeAction && downgradeWarnings.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 mb-2">What you'll lose:</p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {downgradeWarnings.map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-red-600 mt-2">
                      If you have more coaches/admins than the new limit allows, some may lose access.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Proration Note */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Your subscription will be updated immediately. Any billing adjustments will be prorated.
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
              onClick={handlePlanChange}
              disabled={loadingTier !== null}
              className={isUpgradeAction ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}
            >
              {loadingTier === selectedTier.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Change
                </>
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
                const buttonLabel = getButtonLabel(tier);
                const buttonStyle = getButtonStyle(tier);
                
                return (
                  <Card 
                    key={tier.id} 
                    className={`relative transition-all ${
                      tier.popular && !isCurrentTier ? 'border-2 border-blue-500 shadow-lg' : 'border-slate-200'
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
                      <Button 
                        className={`w-full ${buttonStyle}`}
                        onClick={() => handleTierClick(tier)}
                        disabled={loadingTier !== null || loadingBillingPortal}
                        data-testid={`plan-btn-${tier.id}`}
                      >
                        {loadingTier === tier.id || (isExactCurrentPlan && loadingBillingPortal) ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : isExactCurrentPlan ? (
                          <>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {buttonLabel}
                          </>
                        ) : buttonLabel === 'Upgrade' ? (
                          <>
                            <ArrowUp className="w-4 h-4 mr-2" />
                            {buttonLabel}
                          </>
                        ) : buttonLabel === 'Downgrade' ? (
                          <>
                            <ArrowDown className="w-4 h-4 mr-2" />
                            {buttonLabel}
                          </>
                        ) : (
                          buttonLabel
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
