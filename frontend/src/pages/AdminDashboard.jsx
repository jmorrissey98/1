import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, UserPlus, Settings, RefreshCw, Loader2, AlertCircle, Shield, LogOut, 
  Edit2, Save, X, CreditCard, Database, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { safeGet, safePost, safePut } from '../lib/safeFetch';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default subscription tiers
const DEFAULT_TIERS = [
  {
    tier_id: 'individual',
    name: 'Individual',
    monthly_price: 20,
    annual_price: 200,
    coaches_limit: 5,
    admins_limit: 1,
    data_retention_months: 3,
    description: 'For individual coach developers'
  },
  {
    tier_id: 'developer',
    name: 'Developer',
    monthly_price: 35,
    annual_price: 350,
    coaches_limit: 10,
    admins_limit: 1,
    data_retention_months: null,
    description: 'For growing teams'
  },
  {
    tier_id: 'club',
    name: 'Club',
    monthly_price: 60,
    annual_price: 600,
    coaches_limit: 50,
    admins_limit: 10,
    data_retention_months: null,
    description: 'For organizations'
  }
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [subscriptionTiers, setSubscriptionTiers] = useState(DEFAULT_TIERS);
  const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, totalCoaches: 0 });
  const [error, setError] = useState(null);
  
  // Editing states
  const [editingTier, setEditingTier] = useState(null);
  const [tierEdits, setTierEdits] = useState({});
  const [savingTier, setSavingTier] = useState(false);
  
  // Organization limit editing
  const [editingOrgLimits, setEditingOrgLimits] = useState(null);
  const [orgLimitEdits, setOrgLimitEdits] = useState({});
  const [savingOrgLimits, setSavingOrgLimits] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load organizations
      const orgsResult = await safeGet(`${API_URL}/api/admin/organizations`);
      
      if (!orgsResult.ok) {
        if (orgsResult.status === 401) {
          throw new Error('Not authenticated. Please login again.');
        } else if (orgsResult.status === 403) {
          throw new Error('Access denied. Your account does not have admin privileges.');
        }
        throw new Error(orgsResult.data?.detail || orgsResult.error || 'Failed to load organizations');
      }
      
      const orgs = orgsResult.data || [];
      setOrganizations(orgs);
      
      // Calculate stats
      const totalUsers = orgs.reduce((sum, org) => sum + (org.user_count || 0), 0);
      const totalCoaches = orgs.reduce((sum, org) => sum + (org.coach_count || 0), 0);
      
      setStats({
        totalOrgs: orgs.length,
        totalUsers,
        totalCoaches
      });
      
      // Load subscription tiers
      const tiersResult = await safeGet(`${API_URL}/api/admin/subscription-tiers`);
      if (tiersResult.ok && tiersResult.data) {
        setSubscriptionTiers(tiersResult.data);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError(err.message);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Start editing a tier
  const startEditingTier = (tier) => {
    setEditingTier(tier.tier_id);
    setTierEdits({
      name: tier.name,
      monthly_price: tier.monthly_price,
      annual_price: tier.annual_price,
      coaches_limit: tier.coaches_limit,
      admins_limit: tier.admins_limit,
      data_retention_months: tier.data_retention_months
    });
  };

  // Save tier changes
  const saveTierChanges = async (tierId) => {
    setSavingTier(true);
    try {
      const result = await safePut(`${API_URL}/api/admin/subscription-tiers/${tierId}`, tierEdits);
      if (result.ok) {
        toast.success(`${tierEdits.name} tier updated successfully`);
        setEditingTier(null);
        loadData(); // Reload to get updated data
      } else {
        toast.error(result.data?.detail || 'Failed to update tier');
      }
    } catch (err) {
      toast.error('Failed to update tier');
    } finally {
      setSavingTier(false);
    }
  };

  // Load organization limits
  const loadOrgLimits = async (orgId) => {
    try {
      const result = await safeGet(`${API_URL}/api/admin/organizations/${orgId}/limits`);
      if (result.ok) {
        return result.data;
      }
    } catch (err) {
      console.error('Error loading org limits:', err);
    }
    return null;
  };

  // Start editing org limits
  const startEditingOrgLimits = async (org) => {
    const limits = await loadOrgLimits(org.org_id);
    setEditingOrgLimits(org.org_id);
    setOrgLimitEdits({
      coaches_limit: limits?.custom_overrides?.coaches_limit || '',
      admins_limit: limits?.custom_overrides?.admins_limit || '',
      data_retention_months: limits?.custom_overrides?.data_retention_months ?? ''
    });
  };

  // Save organization limit overrides
  const saveOrgLimits = async (orgId) => {
    setSavingOrgLimits(true);
    try {
      // Convert empty strings to null (remove override)
      const payload = {
        coaches_limit: orgLimitEdits.coaches_limit === '' ? null : parseInt(orgLimitEdits.coaches_limit),
        admins_limit: orgLimitEdits.admins_limit === '' ? null : parseInt(orgLimitEdits.admins_limit),
        data_retention_months: orgLimitEdits.data_retention_months === '' ? null : 
          (orgLimitEdits.data_retention_months === '0' || orgLimitEdits.data_retention_months === 0) ? 0 : 
          parseInt(orgLimitEdits.data_retention_months)
      };
      
      const result = await safePut(`${API_URL}/api/admin/organizations/${orgId}/limits`, payload);
      if (result.ok) {
        toast.success('Organization limits updated');
        setEditingOrgLimits(null);
        loadData();
      } else {
        toast.error(result.data?.detail || 'Failed to update limits');
      }
    } catch (err) {
      toast.error('Failed to update organization limits');
    } finally {
      setSavingOrgLimits(false);
    }
  };

  const handleLogout = async () => {
    try {
      await safePost(`${API_URL}/api/auth/logout`, {});
    } catch (e) {
      // Ignore logout errors
    }
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('authenticated') || error.includes('Access denied') || error.includes('admin privileges');
    
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
              <p className="text-slate-600 mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={loadData} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                {isAuthError && (
                  <Button onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Login Again
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header */}
      <header className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold font-['Manrope']">Admin Dashboard</h1>
              <p className="text-sm text-slate-400">My Coach Developer System Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} className="border-slate-600 text-slate-200 hover:bg-slate-800">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={logout} 
              className="border-slate-600 text-slate-200 hover:bg-slate-800"
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalOrgs}</p>
                  <p className="text-sm text-slate-500">Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-sm text-slate-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <UserPlus className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCoaches}</p>
                  <p className="text-sm text-slate-500">Total Coaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="organizations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="organizations" data-testid="tab-organizations">
              <Building2 className="w-4 h-4 mr-2" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
              <CreditCard className="w-4 h-4 mr-2" />
              Subscription Tiers
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">All Organizations ({organizations.length})</h2>
            </div>
            
            {organizations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-slate-500">
                  No organizations found
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {organizations.map(org => (
                  <Card key={org.org_id} className="overflow-hidden" data-testid={`org-card-${org.org_id}`}>
                    <CardHeader className="bg-slate-50 border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={org.club_logo} alt={org.name} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-600">
                              {(org.name || org.club_name || 'O')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg">{org.name || org.club_name || 'Unnamed Org'}</CardTitle>
                            <CardDescription>{org.owner_email}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{org.subscription_tier || 'Free'}</Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/clubs/${org.org_id}`)}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            View Users
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Users</p>
                          <p className="text-lg font-semibold">{org.user_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Coaches</p>
                          <p className="text-lg font-semibold">{org.coach_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Sessions</p>
                          <p className="text-lg font-semibold">{org.session_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Created</p>
                          <p className="text-sm font-medium">
                            {org.created_at ? new Date(org.created_at).toLocaleDateString() : '-'}
                          </p>
                        </div>
                      </div>

                      {/* Custom Limits Section */}
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between text-slate-600">
                            <span className="flex items-center gap-2">
                              <Settings className="w-4 h-4" />
                              Custom Limits Override
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          {editingOrgLimits === org.org_id ? (
                            <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <Label className="text-sm">Coaches Limit</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.coaches_limit}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, coaches_limit: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">Leave empty for tier default</p>
                                </div>
                                <div>
                                  <Label className="text-sm">Coach Developers Limit</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.admins_limit}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, admins_limit: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">Leave empty for tier default</p>
                                </div>
                                <div>
                                  <Label className="text-sm">Data Retention (months)</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.data_retention_months}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, data_retention_months: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">0 = unlimited, empty = tier default</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => saveOrgLimits(org.org_id)}
                                  disabled={savingOrgLimits}
                                >
                                  {savingOrgLimits ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                                  Save Limits
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setEditingOrgLimits(null)}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-50 p-4 rounded-lg">
                              <p className="text-sm text-slate-600 mb-3">
                                Override the subscription tier defaults for this specific organization.
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => startEditingOrgLimits(org)}
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                Edit Custom Limits
                              </Button>
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Subscription Tiers Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Subscription Tiers</h2>
              <p className="text-sm text-slate-500">Edit pricing and limits for each subscription tier. Changes apply globally.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionTiers.map(tier => (
                <Card key={tier.tier_id} data-testid={`tier-card-${tier.tier_id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                      {editingTier !== tier.tier_id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => startEditingTier(tier)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {editingTier === tier.tier_id ? (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm">Name</Label>
                          <Input
                            value={tierEdits.name}
                            onChange={(e) => setTierEdits(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">Monthly Price (£)</Label>
                            <Input
                              type="number"
                              value={tierEdits.monthly_price}
                              onChange={(e) => setTierEdits(prev => ({ ...prev, monthly_price: parseInt(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Annual Price (£)</Label>
                            <Input
                              type="number"
                              value={tierEdits.annual_price}
                              onChange={(e) => setTierEdits(prev => ({ ...prev, annual_price: parseInt(e.target.value) }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">Coaches Limit</Label>
                            <Input
                              type="number"
                              value={tierEdits.coaches_limit}
                              onChange={(e) => setTierEdits(prev => ({ ...prev, coaches_limit: parseInt(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Admins Limit</Label>
                            <Input
                              type="number"
                              value={tierEdits.admins_limit}
                              onChange={(e) => setTierEdits(prev => ({ ...prev, admins_limit: parseInt(e.target.value) }))}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm">Data Retention (months)</Label>
                          <Input
                            type="number"
                            placeholder="Empty = unlimited"
                            value={tierEdits.data_retention_months ?? ''}
                            onChange={(e) => setTierEdits(prev => ({ 
                              ...prev, 
                              data_retention_months: e.target.value === '' ? null : parseInt(e.target.value) 
                            }))}
                          />
                          <p className="text-xs text-slate-500 mt-1">Leave empty for unlimited</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={() => saveTierChanges(tier.tier_id)}
                            disabled={savingTier}
                          >
                            {savingTier ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                            Save
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setEditingTier(null)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">£{tier.monthly_price}</span>
                          <span className="text-slate-500">/month</span>
                        </div>
                        <p className="text-sm text-slate-500">£{tier.annual_price}/year (save 2 months)</p>
                        
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Coaches</span>
                            <span className="font-medium">Up to {tier.coaches_limit}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Coach Developers</span>
                            <span className="font-medium">Up to {tier.admins_limit}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Data History</span>
                            <span className={`font-medium ${tier.data_retention_months === null ? 'text-green-600' : ''}`}>
                              {tier.data_retention_months === null ? 'Unlimited' : `${tier.data_retention_months} months`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
