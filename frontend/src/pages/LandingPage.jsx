import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { ChevronRight, Users, BarChart3, FileText, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Pricing tiers configuration
const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'The Solo Developer',
    monthlyPrice: 20,
    annualPrice: 200,
    coaches: 5,
    admins: 1,
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'The Growth Specialist',
    monthlyPrice: 35,
    annualPrice: 350,
    coaches: 15,
    admins: 1,
    popular: true
  },
  {
    id: 'club_hub',
    name: 'Club Hub',
    subtitle: 'The Organization',
    monthlyPrice: 50,
    annualPrice: 500,
    coaches: 40,
    admins: 5,
    popular: false
  }
];

// Features for the features section
const FEATURES = [
  {
    icon: FileText,
    title: 'Streamlined Observation',
    description: 'Capture coaching moments in real-time with our intuitive observation tools designed for iPad.'
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description: 'Monitor coach development over time with comprehensive analytics and visual progress reports.'
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Manage your coaching team efficiently with role-based access and centralized dashboards.'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingTier, setLoadingTier] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

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
    setLoadingTier(tier.id);
    
    try {
      const billingPeriod = isAnnual ? 'annual' : 'monthly';
      const originUrl = window.location.origin;
      
      const response = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier_id: tier.id,
          billing_period: billingPeriod,
          origin_url: originUrl
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
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
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src="/mcd-logo.png" alt="My Coach Developer" className="h-10 w-auto" />
            </div>
            <nav className="hidden md:flex items-center gap-8">
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                Empower Your <span className="text-blue-600">Coaching Team</span> to Excel
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                The all-in-one platform for coach developers. Observe sessions, track progress, and develop your coaching staff with powerful iPad-first tools designed for the modern training ground.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={scrollToPricing}
                  className="bg-slate-900 hover:bg-slate-800 text-lg px-8 py-6"
                  data-testid="hero-cta-btn"
                >
                  Start Your Journey
                  <ChevronRight className="ml-2 w-5 h-5" />
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
                <span>Cancel anytime</span>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-100 rounded-2xl p-4 shadow-2xl">
                <div className="aspect-[4/3] bg-slate-200 rounded-lg flex items-center justify-center">
                  <div className="text-center p-8">
                    <img src="/mcd-logo.png" alt="App Preview" className="w-32 h-32 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-500 text-sm">App Preview Coming Soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Trusted by Coach Developers Worldwide
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              See what professionals are saying about My Coach Developer
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, index) => (
              <Card key={index} className="bg-white border-slate-200">
                <CardContent className="pt-6">
                  <Quote className="w-8 h-8 text-slate-300 mb-4" />
                  <p className="text-slate-700 italic mb-6">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-slate-600">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{testimonial.name}</p>
                      <p className="text-sm text-slate-500">{testimonial.role}</p>
                    </div>
                  </div>
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
              {isAnnual && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 ml-2">
                  Save 2 months
                </Badge>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
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
                  <div className="border-t border-slate-100 pt-6 mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Admin Users</span>
                      <span className="font-medium text-slate-900">Up to {tier.admins}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Coaches</span>
                      <span className="font-medium text-slate-900">Up to {tier.coaches}</span>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className={`w-full ${tier.popular ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                    onClick={() => handleSelectPlan(tier)}
                    disabled={loadingTier !== null}
                    data-testid={`select-plan-${tier.id}`}
                  >
                    {loadingTier === tier.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Processing...
                      </>
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
            Join hundreds of coach developers who are already using My Coach Developer to build better coaching teams.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={scrollToPricing}
              className="bg-white text-slate-900 hover:bg-slate-100 text-lg px-8 py-6"
            >
              Start Your Free Trial
              <ChevronRight className="ml-2 w-5 h-5" />
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
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="mailto:hello@mycoachdeveloper.com" className="hover:text-white transition-colors">Contact</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} My Coach Developer. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
