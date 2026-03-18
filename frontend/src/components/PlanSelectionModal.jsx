import { useState, useEffect } from 'react';
import { Loader2, Check, Star, Users, Eye, UserCog, Calendar, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Default pricing tiers
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
    popular: false,
    features: ['Up to 5 coach developers', 'Up to 30 coaches', 'Unlimited observations']
  }
];

export function PlanSelectionModal({ open, onOpenChange, onSuccess, initialIsAnnual = false }) {
  const [step, setStep] = useState('select'); // 'select' | 'signup'
  const [selectedTier, setSelectedTier] = useState(null);
  const [isAnnual, setIsAnnual] = useState(initialIsAnnual);
  const [loading, setLoading] = useState(false);
  const [pricingTiers, setPricingTiers] = useState(DEFAULT_PRICING_TIERS);
  
  // Signup form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    club_name: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Sync isAnnual with initialIsAnnual when modal opens
  useEffect(() => {
    if (open) {
      setIsAnnual(initialIsAnnual);
    }
  }, [open, initialIsAnnual]);

  // Fetch pricing tiers from API
  useEffect(() => {
    const fetchPricingTiers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/subscriptions/pricing-comparison`);
        if (response.ok) {
          const data = await response.json();
          const transformedTiers = data.tiers.map(tier => ({
            id: tier.tier_key,
            name: tier.name,
            subtitle: tier.description || getDefaultSubtitle(tier.tier_key),
            monthlyPrice: tier.pricing.monthly,
            annualPrice: tier.pricing.annual,
            coaches: tier.limits.coaches,
            admins: tier.limits.coach_developers,
            observationsPerCoach: tier.limits.observations_per_coach,
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

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep('select');
      setSelectedTier(null);
      setFormData({ name: '', email: '', password: '', club_name: '' });
      setFormErrors({});
    }
  }, [open]);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Za-z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one letter';
    } else if (!/\d/.test(formData.password)) {
      errors.password = 'Password must contain at least one number';
    }
    
    // REQUIRED: Club/Organization name for data isolation
    if (!formData.club_name?.trim()) {
      errors.club_name = 'Organization name is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSelectTier = (tier) => {
    setSelectedTier(tier);
    setStep('signup');
  };

  const handleStartTrial = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/trial/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.toLowerCase(),
          password: formData.password,
          name: formData.name,
          tier_key: selectedTier.id,
          club_name: formData.club_name.trim()  // REQUIRED
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to start trial');
      }
      
      // Store token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('token', data.token);
      }
      
      toast.success(`Welcome! Your ${selectedTier.name} trial has started.`);
      
      // Call success callback with user data
      if (onSuccess) {
        onSuccess(data);
      }
      
      onOpenChange(false);
      
    } catch (error) {
      console.error('Trial start error:', error);
      toast.error(error.message || 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  const handlePaidSubscription = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // For annual or direct payment, go through Stripe
      const response = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: selectedTier.id,
          billing_period: isAnnual ? 'annual' : 'monthly',
          origin_url: window.location.origin,
          // Pass signup data to be used after payment
          signup_data: {
            name: formData.name,
            email: formData.email.toLowerCase(),
            password: formData.password,
            club_name: formData.club_name || null
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create checkout session');
      }
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('select');
    setSelectedTier(null);
  };

  // Plan selection step
  if (step === 'select') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Choose Your Plan
            </DialogTitle>
            <DialogDescription className="text-center">
              Start with a 1-month free trial on any monthly plan
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
              data-testid="plan-billing-toggle"
            />
            <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
              Annual
            </span>
            <Badge variant="secondary" className="bg-green-100 text-green-700 ml-2">
              2 months free
            </Badge>
          </div>

          {/* Free Trial Notice - Only for monthly */}
          {!isAnnual && (
            <div className="mx-auto max-w-xl mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    1 Month Free Trial Available
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Try any plan free for 1 month. No credit card required.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-4 p-2">
            {pricingTiers.map((tier) => (
              <Card 
                key={tier.id} 
                className={`relative transition-all hover:shadow-lg cursor-pointer ${
                  tier.popular ? 'border-2 border-blue-500 shadow-lg' : 'border-slate-200'
                }`}
                onClick={() => handleSelectTier(tier)}
                data-testid={`plan-card-${tier.id}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-3 py-0.5 text-xs">
                      <Star className="w-3 h-3 mr-1 inline" />
                      Popular
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
                      <span className="text-slate-600 flex items-center gap-1">
                        <UserCog className="w-3.5 h-3.5" />
                        Coach Developers
                      </span>
                      <span className="font-medium text-slate-900">{tier.admins}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Coaches
                      </span>
                      <span className={`font-medium ${tier.coaches === null ? 'text-green-600' : tier.coaches === 0 ? 'text-slate-500' : 'text-slate-900'}`}>
                        {tier.coaches === null ? 'Unlimited' : tier.coaches === 0 ? 'Self only' : `Up to ${tier.coaches}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        Observations
                      </span>
                      <span className={`font-medium ${tier.observationsPerCoach === null ? 'text-green-600' : 'text-slate-900'}`}>
                        {tier.observationsPerCoach === null ? 'Unlimited' : `${tier.observationsPerCoach}/coach`}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full ${tier.popular ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                    data-testid={`select-plan-btn-${tier.id}`}
                  >
                    Select Plan
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            All plans include unlimited sessions, cloud sync, and email support.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Signup step
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Create Your Account
          </DialogTitle>
          <DialogDescription>
            {selectedTier?.name} - £{isAnnual ? selectedTier?.annualPrice : selectedTier?.monthlyPrice}/{isAnnual ? 'year' : 'month'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Smith"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={formErrors.name ? 'border-red-500' : ''}
              data-testid="signup-name-input"
            />
            {formErrors.name && (
              <p className="text-xs text-red-500">{formErrors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={formErrors.email ? 'border-red-500' : ''}
              data-testid="signup-email-input"
            />
            {formErrors.email && (
              <p className="text-xs text-red-500">{formErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={formErrors.password ? 'border-red-500' : ''}
              data-testid="signup-password-input"
            />
            {formErrors.password && (
              <p className="text-xs text-red-500">{formErrors.password}</p>
            )}
            <p className="text-xs text-slate-500">
              At least 8 characters with a letter and number
            </p>
          </div>

          {/* Club Name (REQUIRED) */}
          <div className="space-y-2">
            <Label htmlFor="club_name">
              Organization Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="club_name"
              placeholder="My Football Club"
              value={formData.club_name}
              onChange={(e) => setFormData({ ...formData, club_name: e.target.value })}
              data-testid="signup-club-input"
              className={formErrors.club_name ? 'border-red-500' : ''}
            />
            {formErrors.club_name && (
              <p className="text-sm text-red-500">{formErrors.club_name}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            variant="outline" 
            onClick={handleBack}
            disabled={loading}
            className="w-full"
          >
            Back to Plans
          </Button>
          
          {!isAnnual ? (
            // Monthly - Show BOTH options
            <div className="space-y-2">
              <Button 
                onClick={handleStartTrial}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="start-trial-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start 1 Month Free Trial
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-500">or</span>
                </div>
              </div>
              
              <Button 
                onClick={handlePaidSubscription}
                disabled={loading}
                variant="outline"
                className="w-full"
                data-testid="subscribe-now-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Subscribe Now - £{selectedTier?.monthlyPrice}/month
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-slate-500">
                Free trial: No card required. Subscribe now: Pay via Stripe.
              </p>
            </div>
          ) : (
            // Annual - Go to Stripe only (no trial option)
            <Button 
              onClick={handlePaidSubscription}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800"
              data-testid="subscribe-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Subscribe Now - £{selectedTier?.annualPrice}/year
                </>
              )}
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-slate-500 mt-2">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default PlanSelectionModal;
