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
import { Loader2, Check, LogOut, AlertTriangle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { safeGet, safePost } from '../../lib/safeFetch';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

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

export function SubscriptionRequiredModal({ open, reason }) {
  const { logout } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingTier, setLoadingTier] = useState(null);
  const [pricingTiers, setPricingTiers] = useState(DEFAULT_PRICING_TIERS);

  // Fetch pricing tiers from API
  useEffect(() => {
    const fetchPricingTiers = async () => {
      try {
        const result = await safeGet(`${API_URL}/api/pricing/tiers`);
        if (result.ok && result.data) {
          const transformedTiers = result.data.map(tier => ({
            id: tier.tier_id,
            name: tier.name,
            subtitle: tier.subtitle || (tier.tier_id === 'individual' ? 'The Solo Developer' : tier.tier_id === 'developer' ? 'The Growth Specialist' : 'The Organization'),
            monthlyPrice: tier.monthly_price,
            annualPrice: tier.annual_price,
            coaches: tier.coaches_limit,
            admins: tier.admins_limit,
            dataRetention: tier.data_retention_months ? `${tier.data_retention_months} months` : 'Unlimited',
            popular: tier.tier_id === 'developer'
          }));
          setPricingTiers(transformedTiers);
        }
      } catch (err) {
        console.error('Failed to fetch pricing tiers:', err);
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
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Up to {tier.coaches} coaches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Up to {tier.admins} coach {tier.admins === 1 ? 'developer' : 'developers'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{tier.dataRetention} data retention</span>
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
