import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { ChevronRight, ChevronDown, Users, BarChart3, FileText, Star, Loader2, Eye, UserCog, Check, Play, Target, TrendingUp, Lightbulb, ClipboardCheck, LineChart, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { PlanSelectionModal } from '../components/PlanSelectionModal';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Default pricing tiers - Updated for Phase 6 (new subscription model)
const DEFAULT_PRICING_TIERS = [
  {
    id: 'individual_coach',
    name: 'Individual Coach',
    subtitle: 'For Self-Development',
    monthlyPrice: 5,
    annualPrice: 50,
    coaches: 0, // Self only
    admins: 1,
    observationsPerCoach: null, // Unlimited
    dataRetention: 'Unlimited',
    popular: false,
    stripeReady: true,
    features: ['Self-observation mode', 'Unlimited observations', 'Full history access']
  },
  {
    id: 'coach_developer',
    name: 'Coach Developer',
    subtitle: 'For Working with Coaches',
    monthlyPrice: 15,
    annualPrice: 150,
    coaches: null, // Unlimited
    admins: 1,
    observationsPerCoach: 10,
    dataRetention: 'Unlimited',
    popular: true,
    stripeReady: true,
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
    observationsPerCoach: null, // Unlimited
    dataRetention: 'Unlimited',
    popular: false,
    stripeReady: true,
    features: ['Up to 5 coach developers', 'Up to 30 coaches', 'Unlimited observations']
  }
];

// Features for the features section
const FEATURES = [
  {
    icon: FileText,
    title: 'Observe Sessions',
    description: 'Capture coaching moments in real time using simple observation tools that you can customise to your framework.'
  },
  {
    icon: Users,
    title: 'Build Coach Portfolios',
    description: 'Bring together observations, notes, evidence, and data in one portfolio for every coach.'
  },
  {
    icon: BarChart3,
    title: 'Support Development',
    description: 'Turn observations into clear development plans and track progress over time.'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [pricingTiers, setPricingTiers] = useState(DEFAULT_PRICING_TIERS);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(null); // 'coaches' | 'developers' | null
  const audienceSectionRef = useRef(null);

  // Fetch pricing tiers from API
  useEffect(() => {
    const fetchPricingTiers = async () => {
      try {
        // Use new pricing-comparison endpoint (Phase 6)
        const response = await fetch(`${API_URL}/api/subscriptions/pricing-comparison`);
        if (response.ok) {
          const data = await response.json();
          // Transform API data to match frontend format
          const transformedTiers = data.tiers.map(tier => ({
            id: tier.tier_key,
            name: tier.name,
            subtitle: tier.description || getDefaultSubtitle(tier.tier_key),
            monthlyPrice: tier.pricing.monthly,
            annualPrice: tier.pricing.annual,
            coaches: tier.limits.coaches,
            admins: tier.limits.coach_developers,
            observationsPerCoach: tier.limits.observations_per_coach,
            dataRetention: tier.features?.data_retention_months ? `${tier.features.data_retention_months} months` : 'Unlimited',
            popular: tier.highlight || tier.tier_key === 'coach_developer',
            stripeReady: tier.stripe_ready,  // Phase 6: Track if Stripe is configured
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
        // Keep default tiers on error
      }
    };
    
    // Helper function for default subtitles
    const getDefaultSubtitle = (tierKey) => {
      switch(tierKey) {
        case 'individual_coach': return 'For Self-Development';
        case 'coach_developer': return 'For Working with Coaches';
        case 'club': return 'For Organizations';
        default: return '';
      }
    };
    
    fetchPricingTiers();
  }, []);

  // Handle hash-based navigation (e.g., /#pricing)
  useEffect(() => {
    if (location.hash === '#pricing') {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.hash]);

  // Check for returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id');
    const canceled = params.get('canceled');

    if (canceled === 'true') {
      toast.info('Payment canceled. Feel free to try again when ready.');
      // Clear the URL params
      navigate('/', { replace: true });
      return;
    }

    if (sessionId) {
      setCheckingPayment(true);
      pollStatus(sessionId);
    }
    
    // Helper function to poll payment status
    async function pollStatus(sid, attempts = 0) {
      const maxAttempts = 10;
      const pollInterval = 2000;

      if (attempts >= maxAttempts) {
        setCheckingPayment(false);
        toast.error('Payment status check timed out. Please check your email for confirmation.');
        navigate('/', { replace: true });
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/payments/status/${sid}`);
        if (!response.ok) {
          throw new Error('Failed to check payment status');
        }

        const data = await response.json();

        if (data.payment_status === 'paid') {
          setCheckingPayment(false);
          toast.success('Payment successful! Redirecting to signup...');
          navigate(`/login?signup=true&payment_session=${sid}`, { replace: true });
          return;
        } else if (data.status === 'expired') {
          setCheckingPayment(false);
          toast.error('Payment session expired. Please try again.');
          navigate('/', { replace: true });
          return;
        }

        // Continue polling
        setTimeout(() => pollStatus(sid, attempts + 1), pollInterval);
      } catch (error) {
        console.error('Error checking payment status:', error);
        if (attempts < maxAttempts - 1) {
          setTimeout(() => pollStatus(sid, attempts + 1), pollInterval);
        } else {
          setCheckingPayment(false);
          toast.error('Error checking payment status. Please contact support.');
          navigate('/', { replace: true });
        }
      }
    }
  }, [location, navigate]);

  const handleSelectPlan = async (tier) => {
    // Instead of going directly to Stripe, open the plan selection modal
    setShowPlanModal(true);
  };

  const handleTrialSuccess = (data) => {
    // After successful trial signup, redirect to home
    navigate('/home');
  };

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  const openPlanModal = () => {
    setShowPlanModal(true);
  };

  // Navigation to audience section with panel expansion
  const scrollToCoaches = () => {
    setExpandedPanel('coaches');
    setTimeout(() => {
      audienceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const scrollToCoachDevelopers = () => {
    setExpandedPanel('developers');
    setTimeout(() => {
      audienceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Toggle panel expansion (accordion behavior)
  const togglePanel = (panel) => {
    setExpandedPanel(expandedPanel === panel ? null : panel);
  };

  // Show loading state if checking payment
  if (checkingPayment) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-slate-900 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900">Processing your payment...</h2>
          <p className="text-slate-600 mt-2">Please wait while we confirm your subscription.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src="/mcd-logo.png" alt="My Coach Developer" className="h-10 w-auto" />
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <button 
                onClick={scrollToCoaches}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Coaches
              </button>
              <button 
                onClick={scrollToCoachDevelopers}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Coach Developers
              </button>
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            </nav>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/login')}
                data-testid="header-login-btn"
              >
                Log in
              </Button>
              <Button 
                onClick={scrollToPricing}
                className="bg-slate-900 hover:bg-slate-800"
                data-testid="header-signup-btn"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - extra top padding on mobile for safe area */}
      <section className="pt-36 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-slate-900">Develop Your Coaches.</span>{' '}
                <span className="text-blue-600">Simple.</span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                Keep your focus where it matters: developing your coaches. Observe sessions, build portfolios, and support progress with ease.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={openPlanModal}
                  className="bg-slate-900 hover:bg-slate-800 text-lg px-8 py-6"
                  data-testid="hero-cta-btn"
                >
                  Start Free Trial
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="text-lg px-8 py-6"
                >
                  Sign In
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-green-500" />
                  1 month free trial
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-green-500" />
                  No credit card required
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-100 rounded-2xl p-4 shadow-2xl">
                <div className="rounded-lg overflow-hidden">
                  <img 
                    src="https://customer-assets.emergentagent.com/job_3c0b22aa-eec3-42a1-b973-8917ba8e6518/artifacts/oxj8poyp_for%20landing%20page.png" 
                    alt="My Coach Developer - Coach Development Dashboard" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            See how My Coach Developer works
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            A short demo showing how coaches gain insight into their coaching and how coach developers support their development.
          </p>
          
          {/* Video Placeholder Container */}
          <div className="mt-10 relative mx-auto max-w-3xl">
            <div 
              className="relative w-full bg-slate-100 rounded-2xl overflow-hidden shadow-lg"
              style={{ paddingBottom: '56.25%' }} // 16:9 aspect ratio
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                {/* Play Button */}
                <div className="w-20 h-20 rounded-full bg-slate-900/90 flex items-center justify-center mb-4 shadow-xl">
                  <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                </div>
                {/* Coming Soon Label */}
                <span className="text-sm font-medium text-slate-500 bg-white/80 px-4 py-2 rounded-full">
                  Product demo video coming soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audience Section - Expandable Panels */}
      <section 
        ref={audienceSectionRef}
        id="audience" 
        className="bg-slate-50"
      >
        {/* Section Header */}
        <div className="py-16 px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Built for coaches and the people who develop them
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Whether you are developing your own coaching or supporting other coaches, the platform provides clear insight and structure for development.
          </p>
        </div>

        {/* Panel 1: For Coaches */}
        <div className="border-t border-slate-200">
          <button
            onClick={() => togglePanel('coaches')}
            className="w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
            aria-expanded={expandedPanel === 'coaches'}
            aria-controls="panel-coaches"
          >
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">For Coaches</h3>
                <p className="text-sm sm:text-base text-slate-500 mt-1">Understand and develop your own coaching</p>
              </div>
              <ChevronDown 
                className={`w-6 h-6 text-slate-400 transition-transform duration-300 flex-shrink-0 ml-4 ${
                  expandedPanel === 'coaches' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
          
          <div
            id="panel-coaches"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expandedPanel === 'coaches' ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="bg-white border-t border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <p className="text-lg text-slate-600 mb-8 max-w-3xl">
                  Understand how you actually coach and focus your development on what matters most.
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">Clear Insight</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Gain clear insight into your coaching behaviours rather than relying on opinion or memory
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">Focused Development</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Identify specific areas to improve and stay focused on your development
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">Track Progress</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Track your progress over time and see how your coaching evolves
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: For Coach Developers */}
        <div className="border-t border-slate-200">
          <button
            onClick={() => togglePanel('developers')}
            className="w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
            aria-expanded={expandedPanel === 'developers'}
            aria-controls="panel-developers"
          >
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">For Coach Developers</h3>
                <p className="text-sm sm:text-base text-slate-500 mt-1">Support and develop your coaching team</p>
              </div>
              <ChevronDown 
                className={`w-6 h-6 text-slate-400 transition-transform duration-300 flex-shrink-0 ml-4 ${
                  expandedPanel === 'developers' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
          
          <div
            id="panel-developers"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expandedPanel === 'developers' ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="bg-white border-t border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <p className="text-lg text-slate-600 mb-8 max-w-3xl">
                  Support coaches with structured observations, clear feedback, and visible development.
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                      <ClipboardCheck className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">Objective Observations</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Observe coaches objectively and remove subjectivity from feedback
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">Targeted Improvement</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Help coaches focus on the areas that will improve them most
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                      <LineChart className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-2">Track Development</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      Track coach development over time and align coaching across your organisation
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom border */}
        <div className="border-t border-slate-200"></div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Everything You Need to Develop Great Coaches
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Purpose-built tools for coach developers who want to make a real impact on their coaching teams.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => (
              <Card key={index} className="border-slate-200 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-slate-700" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Choose the plan that fits your organization's needs
            </p>
            
            {/* Billing Toggle */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
                Monthly
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                data-testid="billing-toggle"
              />
              <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
                Annual
              </span>
              <Badge variant="secondary" className="bg-green-100 text-green-700 ml-2">
                2 months free
              </Badge>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <Card 
                key={tier.id} 
                className={`relative ${tier.popular ? 'border-2 border-blue-500 shadow-xl scale-105' : 'border-slate-200'}`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white px-4 py-1">
                      <Star className="w-3 h-3 mr-1 inline" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-slate-500">{tier.subtitle}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-slate-900">
                      £{isAnnual ? tier.annualPrice : tier.monthlyPrice}
                    </span>
                    <span className="text-slate-500">/{isAnnual ? 'year' : 'month'}</span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-green-600 mt-1">
                      £{(tier.annualPrice / 12).toFixed(0)}/month billed annually
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="border-t border-slate-100 pt-6 space-y-3">
                    {/* Coach Developers */}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <UserCog className="w-3.5 h-3.5" />
                        Coach Developers
                      </span>
                      <span className="font-medium text-slate-900">
                        {tier.admins === null ? 'Unlimited' : tier.admins === 1 ? '1' : `Up to ${tier.admins}`}
                      </span>
                    </div>
                    
                    {/* Coaches */}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Coaches
                      </span>
                      <span className={`font-medium ${tier.coaches === null ? 'text-green-600' : tier.coaches === 0 ? 'text-slate-500' : 'text-slate-900'}`}>
                        {tier.coaches === null ? 'Unlimited' : tier.coaches === 0 ? 'Self only' : `Up to ${tier.coaches}`}
                      </span>
                    </div>
                    
                    {/* Observations per Coach */}
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
                  
                  {/* Feature List */}
                  {tier.features && tier.features.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      {tier.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full ${tier.popular ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-900 hover:bg-slate-800'} ${tier.stripeReady === false ? 'opacity-60' : ''}`}
                    onClick={() => handleSelectPlan(tier)}
                    disabled={loadingTier !== null || tier.stripeReady === false}
                    data-testid={`select-plan-${tier.id}`}
                  >
                    {loadingTier === tier.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : tier.stripeReady === false ? (
                      'Coming Soon'
                    ) : (
                      'Get Started'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Enterprise CTA */}
          <div className="text-center mt-12">
            <p className="text-slate-600">
              Running a larger organization?{' '}
              <a 
                href="mailto:hello@mycoachdeveloper.com?subject=Enterprise Inquiry" 
                className="text-blue-600 hover:underline font-medium"
              >
                Contact us
              </a>
              {' '}for bespoke Enterprise scaling.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Transform Your Coach Development?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Join coach developers who are already using My Coach Developer to build better coaching teams.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={openPlanModal}
              className="bg-white text-slate-900 hover:bg-slate-100 text-lg px-8 py-6"
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/login')}
              className="border-white text-white hover:bg-white/10 text-lg px-8 py-6"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src="/mcd-logo.png" alt="My Coach Developer" className="h-8 w-auto invert" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-slate-400">
              <a href="mailto:hello@mycoachdeveloper.com" className="hover:text-white transition-colors">Contact</a>
              <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="/commercial-terms" className="hover:text-white transition-colors">Commercial Terms</a>
              <a href="/data-processing" className="hover:text-white transition-colors">Data Processing</a>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} My Coach Developer. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Plan Selection Modal */}
      <PlanSelectionModal 
        open={showPlanModal} 
        onOpenChange={setShowPlanModal}
        onSuccess={handleTrialSuccess}
        initialIsAnnual={isAnnual}
      />
    </div>
  );
}
