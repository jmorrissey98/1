/**
 * SubscriptionRequiredModal - A non-dismissible modal that blocks app access
 * until the user subscribes or logs out.
 * 
 * This modal is shown when:
 * - User has no active subscription
 * - Subscription has been canceled and period has ended
 * - Subscription status is unpaid/incomplete/past_due
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Loader2, Check, LogOut, AlertTriangle, CreditCard, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';
import { safeGet, safePost } from '../../lib/safeFetch';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Default pricing tiers - Updated for new subscription model
const DEFAULT_PRICING_TIERS = [
  {
    id: 'individual_coach',
    name: 'Individual Coach',
    subtitle: 'For Self-Development',
    monthlyPrice: 5,
    annualPrice: 50,
    coaches: 0,
    admins: 1,
    observationsPerCoach: null,
    dataRetention: 'Unlimited',
    popular: false,
    features: ['Self-observation mode', 'Unlimited observations', 'Full history access']
  },
  {
    id: 'coach_developer',
    name: 'Coach Developer',
    subtitle: 'For Working with Coaches',
    monthlyPrice: 15,
    annualPrice: 150,
    coaches: null,
    admins: 1,
    observationsPerCoach: 10,
    dataRetention: 'Unlimited',
    popular: true,
    features: ['Unlimited coaches', '10 observations per coach', 'Full history access']
  },
  {
    id: 'club',
    name: 'Club',
    subtitle: 'For Organizations',
    monthlyPrice: 60,
    annualPrice: 600,
    coaches: 30,
    admins: 5,
    observationsPerCoach: null,
    dataRetention: 'Unlimited',
    popular: false,
    features: ['Up to 5 coach developers', 'Up to 30 coaches', 'Unlimited observations']
  }
];

export function SubscriptionRequiredModal({ open, reason }) {
  const { logout } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingTier, setLoadingTier] = useState(null);
  const [pricingTiers, setPricingTiers] = useState(DEFAULT_PRICING_TIERS);

  // Fetch pricing tiers from API
  useEffect(() => {
    const fetchPricingTiers = async () => {
      try {
        // Use new pricing-comparison endpoint
        const result = await safeGet(`${API_URL}/api/subscriptions/pricing-comparison`);
        if (result.ok && result.data?.tiers) {
          const transformedTiers = result.data.tiers.map(tier => ({
            id: tier.tier_key,
            name: tier.name,
            subtitle: tier.description || getDefaultSubtitle(tier.tier_key),
            monthlyPrice: tier.pricing.monthly,
            annualPrice: tier.pricing.annual,
            coaches: tier.limits.coaches,
            admins: tier.limits.coach_developers,
            observationsPerCoach: tier.limits.observations_per_coach,
            dataRetention: 'Unlimited',
            popular: tier.highlight || tier.tier_key === 'coach_developer',
            features: tier.features ? [
              tier.features.self_observation && 'Self-observation mode',
              tier.limits.observations_per_coach === null ? 'Unlimited observations' : `${tier.limits.observations_per_coach} observations per coach`,
              tier.features.history_access === 'unlimited' && 'Full history access'
            ].filter(Boolean) : []
          }));
          setPricingTiers(transformedTiers);
        }
      } catch (err) {
        console.error('Failed to fetch pricing tiers:', err);
      }
    };
    
    const getDefaultSubtitle = (tierKey) => {
      switch(tierKey) {
        case 'individual_coach': return 'For Self-Development';
        case 'coach_developer': return 'For Working with Coaches';
        case 'club': return 'For Organizations';
        default: return '';
      }
    };
    
    if (open) {
      fetchPricingTiers();
    }
  }, [open]);

  const handleSelectPlan = async (tier) => {
    setLoadingTier(tier.id);
    
    try {
      const result = await safePost(`${API_URL}/api/payments/checkout`, {
        tier_id: tier.id,
        billing_period: isAnnual ? 'annual' : 'monthly',
        origin_url: window.location.origin + '/dashboard'
      });
      
      if (result.ok && (result.data?.url || result.data?.checkout_url)) {
        window.location.href = result.data.url || result.data.checkout_url;
      } else {
        toast.error(result.data?.detail || 'Failed to start checkout');
      }
    } catch (err) {
      toast.error('Failed to process request');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const getReasonMessage = () => {
    switch (reason) {
      case 'subscription_canceled':
        return 'Your subscription has been canceled. Please subscribe to continue using the app.';
      case 'no_subscription':
        return 'You need an active subscription to access this app.';
      case 'status_unpaid':
      case 'status_past_due':
        return 'Your subscription payment failed. Please subscribe with a valid payment method.';
      case 'no_organization':
        return 'Your account is not linked to an organization. Please contact support.';
      default:
        return 'A subscription is required to continue.';
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={() => {}} // Prevent closing
      modal={true}
    >
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <DialogTitle className="text-2xl">Subscription Required</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {getReasonMessage()}
          </DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 my-6">
          <Label htmlFor="billing-toggle" className={!isAnnual ? 'font-semibold' : 'text-slate-500'}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <Label htmlFor="billing-toggle" className={isAnnual ? 'font-semibold' : 'text-slate-500'}>
            Annual
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
              Save 17%
            </Badge>
          </Label>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {pricingTiers.map((tier) => (
            <Card 
              key={tier.id}
              className={`relative transition-all ${tier.popular ? 'border-blue-500 border-2 shadow-lg' : 'border-slate-200'}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <CardDescription className="text-sm">{tier.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="text-center pb-4">
                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    £{isAnnual ? Math.round(tier.annualPrice / 12) : tier.monthlyPrice}
                  </span>
                  <span className="text-slate-500">/mo</span>
                  {isAnnual && (
                    <p className="text-sm text-green-600 mt-1">
                      £{tier.annualPrice}/year billed annually
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 text-sm text-left mb-4">
                  {/* Coach limit display - varies by tier */}
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>
                      {tier.coaches === 0 
                        ? 'Self-observation mode' 
                        : tier.coaches === null 
                          ? 'Unlimited coaches' 
                          : `Up to ${tier.coaches} coaches`}
                    </span>
                  </div>
                  {/* Coach developer limit */}
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{tier.admins} coach {tier.admins === 1 ? 'developer' : 'developers'}</span>
                  </div>
                  {/* Observation limit display */}
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>
                      {tier.observationsPerCoach === null 
                        ? 'Unlimited observations' 
                        : `${tier.observationsPerCoach} observations/coach`}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(tier)}
                  disabled={loadingTier !== null}
                  data-testid={`select-plan-${tier.id}`}
                >
                  {loadingTier === tier.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Choose {tier.name}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Logout Button */}
        <div className="flex justify-center pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-700"
            data-testid="subscription-modal-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SubscriptionRequiredModal;
