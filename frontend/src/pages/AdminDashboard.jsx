import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, UserPlus, Settings, RefreshCw, Loader2, AlertCircle, Shield, LogOut, 
  Edit2, Save, X, CreditCard, Database, ChevronDown, ChevronUp, Check, Archive, RotateCcw,
  Filter, Clock, UserCog, Trash2, Search, UserX, AlertTriangle, FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { safeGet, safePost, safePut, safeFetch } from '../lib/safeFetch';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Subscription tier options - Updated for Phase 5
const TIER_OPTIONS = [
  { value: 'individual_coach', label: 'Individual Coach', color: 'bg-purple-100 text-purple-700', isNew: true },
  { value: 'coach_developer', label: 'Coach Developer', color: 'bg-blue-100 text-blue-700', isNew: true },
  { value: 'club', label: 'Club', color: 'bg-emerald-100 text-emerald-700', isNew: true },
  // Legacy tiers (for display only)
  { value: 'individual', label: 'Individual (Legacy)', color: 'bg-amber-100 text-amber-700', isLegacy: true },
  { value: 'developer', label: 'Developer (Legacy)', color: 'bg-amber-100 text-amber-700', isLegacy: true },
  { value: 'free', label: 'Free (Legacy)', color: 'bg-slate-100 text-slate-500', isLegacy: true }
];

// Default subscription tiers - Updated for Phase 7 with correct pricing
const DEFAULT_TIERS = [
  {
    tier_id: 'individual_coach',
    name: 'Individual Coach',
    monthly_price: 5,
    annual_price: 50,
    coaches_limit: 0,
    admins_limit: 1,
    observations_limit: null, // Unlimited
    data_retention_months: null,
    description: 'For coaches observing themselves',
    isNew: true
  },
  {
    tier_id: 'coach_developer',
    name: 'Coach Developer',
    monthly_price: 15,
    annual_price: 150,
    coaches_limit: null, // Unlimited
    admins_limit: 1,
    observations_limit: 10, // Per coach
    data_retention_months: null,
    description: 'For coach developers working with multiple coaches',
    isNew: true
  },
  {
    tier_id: 'club',
    name: 'Club',
    monthly_price: 60,
    annual_price: 600,
    coaches_limit: 30,
    admins_limit: 5,
    observations_limit: null, // Unlimited
    data_retention_months: null,
    description: 'For organizations',
    isNew: true
  }
];

// Legacy tiers for reference
const LEGACY_TIERS = [
  { tier_id: 'individual', name: 'Individual (Legacy)', monthly_price: 20, annual_price: 200 },
  { tier_id: 'developer', name: 'Developer (Legacy)', monthly_price: 35, annual_price: 350 },
  { tier_id: 'free', name: 'Free (Legacy)', monthly_price: 0, annual_price: 0 }
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [subscriptionTiers, setSubscriptionTiers] = useState(DEFAULT_TIERS);
  const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, totalCoaches: 0, archivedOrgs: 0 });
  const [error, setError] = useState(null);
  
  // Filter states
  const [showArchived, setShowArchived] = useState(false);
  const [archivingOrg, setArchivingOrg] = useState(null);
  const [changingTierOrg, setChangingTierOrg] = useState(null);
  
  // Editing states
  const [editingTier, setEditingTier] = useState(null);
  const [tierEdits, setTierEdits] = useState({});
  const [savingTier, setSavingTier] = useState(false);
  
  // Organization limit editing
  const [editingOrgLimits, setEditingOrgLimits] = useState(null);
  const [orgLimitEdits, setOrgLimitEdits] = useState({});
  const [savingOrgLimits, setSavingOrgLimits] = useState(false);
  
  // Data cleanup states
  const [cleanupEmail, setCleanupEmail] = useState('');
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [orphanedCoaches, setOrphanedCoaches] = useState(null);
  const [loadingOrphaned, setLoadingOrphaned] = useState(false);
  
  // Orphaned users states
  const [orphanedUsers, setOrphanedUsers] = useState(null);
  const [loadingOrphanedUsers, setLoadingOrphanedUsers] = useState(false);
  const [fixingUser, setFixingUser] = useState(null);

  // Migration status states (Phase 7)
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loadingMigration, setLoadingMigration] = useState(false);
  const [applyingBulkMigration, setApplyingBulkMigration] = useState(false);
  const [subscriptionFilter, setSubscriptionFilter] = useState('all'); // 'all', 'legacy', 'new'

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load organizations (include archived based on filter)
      const orgsResult = await safeGet(`${API_URL}/api/admin/organizations?include_archived=${showArchived}`);
      
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
      const activeOrgs = orgs.filter(o => o.status !== 'archived');
      const archivedOrgs = orgs.filter(o => o.status === 'archived');
      const totalUsers = activeOrgs.reduce((sum, org) => sum + (org.user_count || 0), 0);
      const totalCoaches = activeOrgs.reduce((sum, org) => sum + (org.coach_count || 0), 0);
      
      setStats({
        totalOrgs: activeOrgs.length,
        totalUsers,
        totalCoaches,
        archivedOrgs: archivedOrgs.length
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
  }, [showArchived]);

  // Cleanup user by email
  const handleCleanupUser = async () => {
    if (!cleanupEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    
    setCleanupLoading(true);
    setCleanupResult(null);
    
    try {
      // Use safeFetch directly for DELETE with body
      const result = await safeFetch(`${API_URL}/api/admin/cleanup/user-by-email`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanupEmail.trim() })
      });
      
      if (result.ok) {
        setCleanupResult(result.data);
        if (result.data.user_deleted || result.data.coaches_deleted > 0) {
          toast.success(`Successfully cleaned up data for ${cleanupEmail}`);
        } else {
          toast.info(`No data found for ${cleanupEmail}`);
        }
        setCleanupEmail('');
      } else {
        toast.error(result.data?.detail || 'Cleanup failed');
      }
    } catch (err) {
      toast.error('Failed to cleanup user data');
    } finally {
      setCleanupLoading(false);
    }
  };

  // Find orphaned coaches
  const handleFindOrphaned = async () => {
    setLoadingOrphaned(true);
    setOrphanedCoaches(null);
    
    try {
      const result = await safeGet(`${API_URL}/api/admin/cleanup/orphaned-coaches`);
      if (result.ok) {
        setOrphanedCoaches(result.data);
      } else {
        toast.error(result.data?.detail || 'Failed to find orphaned coaches');
      }
    } catch (err) {
      toast.error('Failed to check for orphaned coaches');
    } finally {
      setLoadingOrphaned(false);
    }
  };

  // Load migration status (Phase 7)
  const loadMigrationStatus = async () => {
    setLoadingMigration(true);
    try {
      const result = await safeGet(`${API_URL}/api/subscriptions/migration/bulk-status`);
      if (result.ok) {
        setMigrationStatus(result.data);
      } else {
        toast.error('Failed to load migration status');
      }
    } catch (err) {
      toast.error('Failed to load migration status');
    } finally {
      setLoadingMigration(false);
    }
  };

  // Apply bulk migration (Phase 7)
  const handleBulkMigration = async () => {
    if (!window.confirm('This will apply migration fields to all legacy subscriptions. Continue?')) {
      return;
    }
    
    setApplyingBulkMigration(true);
    try {
      const result = await safePost(`${API_URL}/api/subscriptions/migration/bulk-apply`, {});
      if (result.ok) {
        toast.success(`Migration applied: ${result.data.migrated} subscriptions updated`);
        loadMigrationStatus();
        loadData();
      } else {
        toast.error(result.data?.detail || 'Bulk migration failed');
      }
    } catch (err) {
      toast.error('Failed to apply bulk migration');
    } finally {
      setApplyingBulkMigration(false);
    }
  };

  // Complete migration for specific org (Phase 7)
  const handleCompleteMigration = async (orgId) => {
    try {
      const result = await safePost(`${API_URL}/api/subscriptions/migration/complete/${orgId}`, {});
      if (result.ok && result.data.success) {
        toast.success(result.data.message);
        loadMigrationStatus();
        loadData();
      } else {
        toast.error(result.data?.message || 'Migration failed');
      }
    } catch (err) {
      toast.error('Failed to complete migration');
    }
  };

  // Delete all orphaned coaches
  const handleDeleteOrphaned = async () => {
    if (!orphanedCoaches || orphanedCoaches.orphaned_count === 0) {
      toast.info('No orphaned coaches to delete');
      return;
    }
    
    setLoadingOrphaned(true);
    
    try {
      const result = await safePost(`${API_URL}/api/admin/cleanup/orphaned-coaches`, {});
      if (result.ok) {
        toast.success(`Deleted ${result.data.deleted_count} orphaned coach profiles`);
        setOrphanedCoaches(null);
      } else {
        toast.error(result.data?.detail || 'Failed to delete orphaned coaches');
      }
    } catch (err) {
      toast.error('Failed to delete orphaned coaches');
    } finally {
      setLoadingOrphaned(false);
    }
  };

  // Find orphaned users (missing organization_id)
  const handleFindOrphanedUsers = async () => {
    setLoadingOrphanedUsers(true);
    setOrphanedUsers(null);
    
    try {
      const result = await safeGet(`${API_URL}/api/admin/cleanup/orphaned-users`);
      if (result.ok) {
        setOrphanedUsers(result.data);
      } else {
        toast.error(result.data?.detail || 'Failed to find orphaned users');
      }
    } catch (err) {
      toast.error('Failed to check for orphaned users');
    } finally {
      setLoadingOrphanedUsers(false);
    }
  };

  // Fix a specific user's organization link
  const handleFixUserOrg = async (email, orgId = null) => {
    setFixingUser(email);
    
    try {
      const result = await safePost(`${API_URL}/api/admin/cleanup/fix-user-organization`, {
        email: email,
        organization_id: orgId
      });
      
      if (result.ok) {
        if (result.data.updated) {
          toast.success(`Fixed organization link for ${email}`);
          // Refresh the orphaned users list
          handleFindOrphanedUsers();
        } else {
          toast.info(result.data.message);
        }
      } else {
        toast.error(result.data?.detail || 'Failed to fix user organization');
      }
    } catch (err) {
      toast.error('Failed to fix user organization');
    } finally {
      setFixingUser(null);
    }
  };

  // Archive/Reinstate organization
  const handleArchiveOrg = async (orgId, isArchived) => {
    setArchivingOrg(orgId);
    try {
      const endpoint = isArchived 
        ? `${API_URL}/api/admin/organizations/${orgId}/reinstate`
        : `${API_URL}/api/admin/organizations/${orgId}/archive`;
      
      const result = await safePost(endpoint, {});
      if (result.ok) {
        toast.success(isArchived ? 'Organization reinstated' : 'Organization archived');
        loadData();
      } else {
        toast.error(result.data?.detail || 'Operation failed');
      }
    } catch (err) {
      toast.error('Failed to update organization status');
    } finally {
      setArchivingOrg(null);
    }
  };

  // Change organization subscription tier
  const handleChangeTier = async (orgId, newTier) => {
    setChangingTierOrg(orgId);
    try {
      const result = await safePut(`${API_URL}/api/admin/organizations/${orgId}/tier`, { tier_id: newTier });
      if (result.ok) {
        toast.success(`Subscription tier changed to ${newTier}`);
        loadData();
      } else {
        toast.error(result.data?.detail || 'Failed to change tier');
      }
    } catch (err) {
      toast.error('Failed to change subscription tier');
    } finally {
      setChangingTierOrg(null);
    }
  };

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
      observations_limit: limits?.custom_overrides?.max_observations_per_coach || '',
      data_retention_months: limits?.custom_overrides?.data_retention_months ?? ''
    });
  };

  // Save organization limit overrides
  const saveOrgLimits = async (orgId) => {
    setSavingOrgLimits(true);
    try {
      // Convert empty strings to null (remove override), 0 = unlimited
      const payload = {
        max_coaches: orgLimitEdits.coaches_limit === '' ? null : parseInt(orgLimitEdits.coaches_limit),
        max_coach_developers: orgLimitEdits.admins_limit === '' ? null : parseInt(orgLimitEdits.admins_limit),
        max_observations_per_coach: orgLimitEdits.observations_limit === '' ? null : parseInt(orgLimitEdits.observations_limit),
        data_retention_months: orgLimitEdits.data_retention_months === '' ? null : 
          (orgLimitEdits.data_retention_months === '0' || orgLimitEdits.data_retention_months === 0) ? 0 : 
          parseInt(orgLimitEdits.data_retention_months)
      };
      
      // Use new subscription admin endpoint
      const result = await safePut(`${API_URL}/api/subscriptions/admin/organization/${orgId}/limits`, payload);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalOrgs}</p>
                  <p className="text-sm text-slate-500">Active Organizations</p>
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
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Archive className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.archivedOrgs}</p>
                  <p className="text-sm text-slate-500">Archived</p>
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
            <TabsTrigger value="templates" data-testid="tab-templates" onClick={() => navigate('/admin/templates')}>
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
              <CreditCard className="w-4 h-4 mr-2" />
              Subscription Tiers
            </TabsTrigger>
            <TabsTrigger value="cleanup" data-testid="tab-cleanup">
              <Trash2 className="w-4 h-4 mr-2" />
              Data Cleanup
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {showArchived ? 'All Organizations' : 'Active Organizations'} ({organizations.length})
              </h2>
              <div className="flex items-center gap-3">
                <Label htmlFor="show-archived" className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                  <Switch
                    id="show-archived"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                    data-testid="show-archived-toggle"
                  />
                  Show Archived
                </Label>
              </div>
            </div>
            
            {organizations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-slate-500">
                  {showArchived ? 'No organizations found' : 'No active organizations found'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {organizations.map(org => {
                  const isArchived = org.status === 'archived';
                  return (
                  <Card 
                    key={org.org_id} 
                    className={`overflow-hidden ${isArchived ? 'opacity-70 bg-slate-50' : ''}`} 
                    data-testid={`org-card-${org.org_id}`}
                  >
                    <CardHeader className={`border-b ${isArchived ? 'bg-slate-100' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={org.club_logo} alt={org.name} />
                            <AvatarFallback className={`${isArchived ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                              {(org.name || org.club_name || 'O')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {org.name || org.club_name || 'Unnamed Org'}
                              {isArchived && (
                                <Badge variant="secondary" className="bg-slate-200 text-slate-600">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription>{org.owner_email}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Tier Selector */}
                          <Select
                            value={org.subscription_tier || 'coach_developer'}
                            onValueChange={(value) => handleChangeTier(org.org_id, value)}
                            disabled={isArchived || changingTierOrg === org.org_id}
                          >
                            <SelectTrigger className="w-[130px] h-8" data-testid={`tier-select-${org.org_id}`}>
                              {changingTierOrg === org.org_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {TIER_OPTIONS.map(tier => (
                                <SelectItem key={tier.value} value={tier.value}>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${tier.color}`}>
                                    {tier.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {org.has_custom_limits && (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                              Custom
                            </Badge>
                          )}
                          {!isArchived && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/clubs/${org.org_id}`)}
                            >
                              <Users className="w-4 h-4 mr-1" />
                              View Users
                            </Button>
                          )}
                          <Button
                            variant={isArchived ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleArchiveOrg(org.org_id, isArchived)}
                            disabled={archivingOrg === org.org_id}
                            className={isArchived ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}
                            data-testid={`${isArchived ? 'reinstate' : 'archive'}-org-${org.org_id}`}
                          >
                            {archivingOrg === org.org_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isArchived ? (
                              <>
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Reinstate
                              </>
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {/* Limits Badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="outline" className="text-xs font-normal">
                          <Users className="w-3 h-3 mr-1" />
                          {org.coach_count || 0}/{org.effective_coaches_limit || '∞'} coaches
                        </Badge>
                        <Badge variant="outline" className="text-xs font-normal">
                          <UserCog className="w-3 h-3 mr-1" />
                          {org.effective_admins_limit || 1} dev{org.effective_admins_limit !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-normal">
                          <Clock className="w-3 h-3 mr-1" />
                          {org.effective_data_retention_months ? `${org.effective_data_retention_months}mo data` : 'Unlimited data'}
                        </Badge>
                      </div>
                      
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

                      {/* Custom Limits Section - only show for active orgs */}
                      {!isArchived && (
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
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <Label className="text-sm">Coaches Limit</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.coaches_limit}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, coaches_limit: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">0 = unlimited</p>
                                </div>
                                <div>
                                  <Label className="text-sm">Coach Developers</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.admins_limit}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, admins_limit: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">Empty = tier default</p>
                                </div>
                                <div>
                                  <Label className="text-sm">Observations/Coach</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.observations_limit}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, observations_limit: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">0 = unlimited</p>
                                </div>
                                <div>
                                  <Label className="text-sm">Data Retention</Label>
                                  <Input
                                    type="number"
                                    placeholder="Use tier default"
                                    value={orgLimitEdits.data_retention_months}
                                    onChange={(e) => setOrgLimitEdits(prev => ({ ...prev, data_retention_months: e.target.value }))}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">Months, 0 = unlimited</p>
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
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Subscription Tiers Tab */}
          <TabsContent value="subscriptions" className="space-y-6">
            {/* Migration Status Section */}
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-amber-600" />
                      Migration Status
                    </CardTitle>
                    <CardDescription>
                      Track and manage migration of legacy subscriptions to the new tier system.
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadMigrationStatus}
                    disabled={loadingMigration}
                  >
                    {loadingMigration ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {migrationStatus ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-slate-900">{migrationStatus.total}</div>
                        <div className="text-sm text-slate-600">Total Subscriptions</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-green-600">{migrationStatus.already_migrated}</div>
                        <div className="text-sm text-slate-600">Already Migrated</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border">
                        <div className="text-2xl font-bold text-amber-600">{migrationStatus.needs_migration}</div>
                        <div className="text-sm text-slate-600">Needs Migration</div>
                      </div>
                      <div className="p-3 bg-white rounded-lg border">
                        <div className="text-sm text-slate-500">Legacy Breakdown</div>
                        <div className="text-xs mt-1">
                          Individual: {migrationStatus.legacy_individual} | 
                          Developer: {migrationStatus.legacy_developer} | 
                          Club: {migrationStatus.legacy_club}
                        </div>
                      </div>
                    </div>
                    
                    {migrationStatus.needs_migration > 0 && (
                      <div className="flex items-center gap-3 pt-2">
                        <Button 
                          onClick={handleBulkMigration}
                          disabled={applyingBulkMigration}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {applyingBulkMigration ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Applying Migration...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Apply Bulk Migration
                            </>
                          )}
                        </Button>
                        <span className="text-sm text-slate-600">
                          Prepares all legacy subscriptions for migration (keeps current billing until period ends)
                        </span>
                      </div>
                    )}
                    
                    {/* Legacy Organizations List */}
                    {migrationStatus.organizations && migrationStatus.organizations.filter(o => !o.has_migration_fields).length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium text-slate-700 mb-2">Legacy Subscriptions</h4>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {migrationStatus.organizations
                            .filter(o => !o.has_migration_fields)
                            .map(org => (
                              <div key={org.org_id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div>
                                  <span className="font-medium text-sm">{org.org_id}</span>
                                  <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-700">
                                    {org.old_tier || 'Unknown'}
                                  </Badge>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleCompleteMigration(org.org_id)}
                                >
                                  Migrate
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button onClick={loadMigrationStatus} disabled={loadingMigration}>
                    {loadingMigration ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Load Migration Status
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* New Tiers Section */}
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Badge className="bg-green-500">New</Badge>
                  Current Subscription Tiers
                </h2>
                <p className="text-sm text-slate-500">These are the active tiers for new subscriptions.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {subscriptionTiers.map(tier => (
                  <Card key={tier.tier_id} data-testid={`tier-card-${tier.tier_id}`} className="border-green-200">
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
                                placeholder="0 = unlimited"
                                value={tierEdits.coaches_limit ?? ''}
                                onChange={(e) => setTierEdits(prev => ({ ...prev, coaches_limit: e.target.value === '' ? null : parseInt(e.target.value) }))}
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
                            <Label className="text-sm">Observations/Coach</Label>
                            <Input
                              type="number"
                              placeholder="Empty = unlimited"
                              value={tierEdits.observations_limit ?? ''}
                              onChange={(e) => setTierEdits(prev => ({ 
                                ...prev, 
                                observations_limit: e.target.value === '' ? null : parseInt(e.target.value) 
                              }))}
                            />
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
                          <p className="text-sm text-slate-500">£{tier.annual_price}/year</p>
                          
                          <div className="pt-3 border-t space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Coaches</span>
                              <span className={`font-medium ${tier.coaches_limit === null || tier.coaches_limit === 0 ? 'text-green-600' : ''}`}>
                                {tier.coaches_limit === null ? 'Unlimited' : tier.coaches_limit === 0 ? 'Self only' : `Up to ${tier.coaches_limit}`}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Coach Developers</span>
                              <span className="font-medium">Up to {tier.admins_limit}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Observations/Coach</span>
                              <span className={`font-medium ${tier.observations_limit === null ? 'text-green-600' : ''}`}>
                                {tier.observations_limit === null ? 'Unlimited' : tier.observations_limit}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Legacy Tiers Reference */}
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-100 text-amber-700">Legacy</Badge>
                  Legacy Tiers (Reference Only)
                </h2>
                <p className="text-sm text-slate-500">These tiers are being phased out. Existing subscribers will be migrated.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {LEGACY_TIERS.map(tier => (
                  <Card key={tier.tier_id} className="border-amber-200 bg-amber-50/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        {tier.name}
                        <Archive className="w-4 h-4 text-amber-500" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-slate-600">
                        <p>£{tier.monthly_price}/mo | £{tier.annual_price}/yr</p>
                        <p className="text-xs text-amber-600 mt-1">
                          → Migrates to Coach Developer
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Data Cleanup Tab */}
          <TabsContent value="cleanup" className="space-y-6">
            {/* Cleanup User by Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-red-500" />
                  Remove User by Email
                </CardTitle>
                <CardDescription>
                  Completely remove a user account and all associated data. Use this when a coach needs to join a different organization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="Enter email address to remove..."
                      value={cleanupEmail}
                      onChange={(e) => setCleanupEmail(e.target.value)}
                      data-testid="cleanup-email-input"
                    />
                  </div>
                  <Button 
                    onClick={handleCleanupUser}
                    disabled={cleanupLoading || !cleanupEmail.trim()}
                    variant="destructive"
                    data-testid="cleanup-user-btn"
                  >
                    {cleanupLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove User
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">This action will permanently delete:</p>
                      <ul className="mt-1 ml-4 list-disc text-amber-700">
                        <li>User account</li>
                        <li>Coach profile(s)</li>
                        <li>Pending invites</li>
                        <li>User's reflections</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {cleanupResult && (
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <h4 className="font-medium text-slate-900 mb-2">Cleanup Result</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-slate-600">Email:</span>
                      <span className="font-mono">{cleanupResult.email}</span>
                      
                      <span className="text-slate-600">User Deleted:</span>
                      <span className={cleanupResult.user_deleted ? 'text-green-600' : 'text-slate-500'}>
                        {cleanupResult.user_deleted ? 'Yes' : 'No'}
                      </span>
                      
                      <span className="text-slate-600">Coaches Deleted:</span>
                      <span>{cleanupResult.coaches_deleted}</span>
                      
                      <span className="text-slate-600">Invites Deleted:</span>
                      <span>{cleanupResult.invites_deleted}</span>
                      
                      <span className="text-slate-600">Reflections Deleted:</span>
                      <span>{cleanupResult.reflections_deleted}</span>
                    </div>
                    {cleanupResult.note && (
                      <p className="mt-2 text-sm text-green-600">{cleanupResult.note}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orphaned Coaches */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-orange-500" />
                  Find Orphaned Coach Profiles
                </CardTitle>
                <CardDescription>
                  Find coach profiles that are no longer associated with any user or organization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button 
                    onClick={handleFindOrphaned}
                    disabled={loadingOrphaned}
                    variant="outline"
                    data-testid="find-orphaned-btn"
                  >
                    {loadingOrphaned ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Scan for Orphaned Profiles
                      </>
                    )}
                  </Button>
                  
                  {orphanedCoaches && orphanedCoaches.orphaned_count > 0 && (
                    <Button 
                      onClick={handleDeleteOrphaned}
                      disabled={loadingOrphaned}
                      variant="destructive"
                      data-testid="delete-orphaned-btn"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All Orphaned ({orphanedCoaches.orphaned_count})
                    </Button>
                  )}
                </div>
                
                {orphanedCoaches && (
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-900">Scan Results</h4>
                      <Badge variant={orphanedCoaches.orphaned_count > 0 ? "destructive" : "secondary"}>
                        {orphanedCoaches.orphaned_count} orphaned
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-3">
                      Total coach profiles: {orphanedCoaches.total_coaches}
                    </p>
                    
                    {orphanedCoaches.orphaned_count > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {orphanedCoaches.orphaned_coaches.map((coach, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                            <div>
                              <span className="font-medium">{coach.name || 'Unnamed'}</span>
                              <span className="text-slate-500 ml-2">({coach.email || 'No email'})</span>
                            </div>
                            <div className="flex gap-1">
                              {coach.reasons.map((reason, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {reason.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        No orphaned coach profiles found
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Orphaned Users (missing organization_id) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-purple-500" />
                  Fix Users Missing Organization Link
                </CardTitle>
                <CardDescription>
                  Find users who cannot add coaches because their account is not linked to an organization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleFindOrphanedUsers}
                  disabled={loadingOrphanedUsers}
                  variant="outline"
                  data-testid="find-orphaned-users-btn"
                >
                  {loadingOrphanedUsers ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find Users Without Organization
                    </>
                  )}
                </Button>
                
                {orphanedUsers && (
                  <div className="p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-900">Users Missing Organization</h4>
                      <Badge variant={orphanedUsers.orphaned_count > 0 ? "destructive" : "secondary"}>
                        {orphanedUsers.orphaned_count} found
                      </Badge>
                    </div>
                    
                    {orphanedUsers.orphaned_count > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {orphanedUsers.orphaned_users.map((user, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border">
                            <div>
                              <span className="font-medium">{user.name || 'Unnamed'}</span>
                              <span className="text-slate-500 ml-2 text-sm">({user.email})</span>
                              <Badge variant="outline" className="ml-2 text-xs">{user.role}</Badge>
                              {user.owned_organization && (
                                <p className="text-xs text-green-600 mt-1">
                                  Owns: {user.owned_organization.club_name || user.owned_organization.org_id}
                                </p>
                              )}
                              {user.invite_organization_id && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Invited to: {user.invite_organization_id}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleFixUserOrg(
                                user.email, 
                                user.owned_organization?.org_id || user.invite_organization_id
                              )}
                              disabled={fixingUser === user.email || (!user.owned_organization && !user.invite_organization_id)}
                              variant={user.owned_organization || user.invite_organization_id ? "default" : "outline"}
                            >
                              {fixingUser === user.email ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  Fix
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        All users have organization links
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
