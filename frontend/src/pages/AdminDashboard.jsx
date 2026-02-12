import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, UserPlus, Settings, RefreshCw, Loader2, AlertCircle, Shield, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { safeGet, safePost } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, totalCoaches: 0 });
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeGet(`${API_URL}/api/admin/organizations`);
      
      if (!result.ok) {
        // Check for specific error codes
        if (result.status === 401) {
          throw new Error('Not authenticated. Please login again.');
        } else if (result.status === 403) {
          throw new Error('Access denied. Your account does not have admin privileges.');
        }
        throw new Error(result.data?.detail || result.error || 'Failed to load organizations');
      }
      
      const orgs = result.data || [];
      setOrganizations(orgs);
      
      // Calculate stats
      const totalUsers = orgs.reduce((sum, org) => sum + (org.user_count || 0), 0);
      const totalCoaches = orgs.reduce((sum, org) => sum + (org.coach_count || 0), 0);
      
      setStats({
        totalOrgs: orgs.length,
        totalUsers,
        totalCoaches
      });
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
    
    const handleLogout = async () => {
      try {
        await safePost(`${API_URL}/api/auth/logout`, {});
      } catch (e) {
        // Ignore logout errors
      }
      window.location.href = '/login';
    };
    
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
              {isAuthError && (
                <p className="text-sm text-slate-500 mt-4">
                  Make sure you're logging in with the admin account:<br />
                  <code className="bg-slate-100 px-2 py-1 rounded text-xs">hello@mycoachdeveloper.com</code>
                </p>
              )}
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
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900">{stats.totalOrgs}</p>
                  <p className="text-sm text-slate-500">Clubs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
                  <p className="text-sm text-slate-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900">{stats.totalCoaches}</p>
                  <p className="text-sm text-slate-500">Total Coaches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope']">Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => navigate('/admin/clubs/new')}
                data-testid="create-club-btn"
              >
                <Building2 className="w-6 h-6 mb-2" />
                <span>Create Club</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => navigate('/admin/users/new')}
                data-testid="create-user-btn"
              >
                <UserPlus className="w-6 h-6 mb-2" />
                <span>Create User</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => navigate('/admin/users')}
                data-testid="manage-users-btn"
              >
                <Users className="w-6 h-6 mb-2" />
                <span>Manage Users</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clubs List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-['Manrope']">Clubs</CardTitle>
                <CardDescription>All registered clubs/organizations</CardDescription>
              </div>
              <Button onClick={() => navigate('/admin/clubs/new')} size="sm">
                <Building2 className="w-4 h-4 mr-1" />
                Add Club
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No clubs registered yet.</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/admin/clubs/new')}
                  className="mt-2"
                >
                  Create your first club
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {organizations.map((org) => (
                  <div 
                    key={org.org_id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/clubs/${org.org_id}`)}
                    data-testid={`club-item-${org.org_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={org.club_logo} />
                        <AvatarFallback className="bg-slate-200 text-slate-600">
                          {org.club_name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-slate-900">{org.club_name || 'Unnamed Club'}</h3>
                        <p className="text-sm text-slate-500">ID: {org.org_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{org.user_count || 0} Users</Badge>
                      <Badge variant="outline">{org.coach_count || 0} Coaches</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
