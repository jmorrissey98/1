import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Loader2, Building2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { safeGet, safePost } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminCreateUser() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  
  // Result state
  const [createdUser, setCreatedUser] = useState(null);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const result = await safeGet(`${API_URL}/api/admin/organizations`);
        if (result.ok) {
          setOrganizations(result.data || []);
        }
      } catch (err) {
        console.error('Error loading organizations:', err);
        toast.error('Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };
    
    loadOrganizations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!firstName.trim()) {
      toast.error('Please enter first name');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Please enter last name');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter email');
      return;
    }
    if (!role) {
      toast.error('Please select a role');
      return;
    }
    if (!organizationId) {
      toast.error('Please select an organization');
      return;
    }

    setSaving(true);

    try {
      const result = await safePost(`${API_URL}/api/admin/users`, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        organization_id: organizationId
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      setCreatedUser(result.data);
      toast.success('User created successfully');
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAnother = () => {
    setCreatedUser(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole('');
    // Keep organizationId for convenience
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/admin')}
            className="text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold font-['Manrope']">Create New User</h1>
            <p className="text-sm text-slate-400">Add a user to any organization</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {createdUser ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-['Manrope'] text-emerald-600 flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                User Created Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-medium">{createdUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium">{createdUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Role:</span>
                  <span className="font-medium capitalize">{createdUser.role?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">User ID:</span>
                  <span className="font-mono text-sm">{createdUser.user_id}</span>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 font-medium mb-2">Temporary Password</p>
                <code className="bg-amber-100 px-3 py-2 rounded block text-center font-mono text-lg">
                  {createdUser.temporary_password}
                </code>
                <p className="text-amber-700 text-sm mt-2">
                  Share this password with the user. They should reset it on first login.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => navigate('/admin')}>
                  Back to Dashboard
                </Button>
                <Button onClick={handleCreateAnother}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Another User
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-['Manrope'] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                User Details
              </CardTitle>
              <CardDescription>
                Enter the details for the new user
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Organization */}
                <div className="space-y-2">
                  <Label>Organization *</Label>
                  <Select value={organizationId} onValueChange={setOrganizationId}>
                    <SelectTrigger data-testid="org-select">
                      <SelectValue placeholder="Select an organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.org_id} value={org.org_id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            {org.club_name || org.org_id}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {organizations.length === 0 && (
                    <p className="text-sm text-amber-600">
                      No organizations found. <Button variant="link" className="px-0 h-auto" onClick={() => navigate('/admin/clubs/new')}>Create one first</Button>
                    </p>
                  )}
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="first-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="last-name-input"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="email-input"
                  />
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="role-select">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coach_developer">
                        <div>
                          <span className="font-medium">Coach Developer</span>
                          <span className="text-slate-500 text-sm ml-2">- Can manage coaches and sessions</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="coach">
                        <div>
                          <span className="font-medium">Coach</span>
                          <span className="text-slate-500 text-sm ml-2">- Can view their own development</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || organizations.length === 0} data-testid="submit-user-btn">
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Create User
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
