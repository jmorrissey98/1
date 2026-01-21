import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Eye, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { storage, createUser, USER_ROLES } from '../lib/storage';
import { cn } from '../lib/utils';

export default function UserSettings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [userName, setUserName] = useState('');
  const [selectedRole, setSelectedRole] = useState(USER_ROLES.COACH_DEVELOPER);
  const [linkedCoachId, setLinkedCoachId] = useState('none');

  useEffect(() => {
    const user = storage.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUserName(user.name);
      setSelectedRole(user.role);
      setLinkedCoachId(user.linkedCoachId || 'none');
    }
    setCoaches(storage.getCoaches());
  }, []);

  const handleSave = () => {
    if (!userName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    const user = currentUser || createUser(userName, selectedRole);
    const updatedUser = {
      ...user,
      name: userName,
      role: selectedRole,
      linkedCoachId: selectedRole === USER_ROLES.COACH ? (linkedCoachId !== 'none' ? linkedCoachId : null) : null
    };

    storage.saveUser(updatedUser);
    storage.setCurrentUser(updatedUser);
    setCurrentUser(updatedUser);
    toast.success('Settings saved');
  };

  const handleSwitchToCoachView = () => {
    if (!currentUser?.linkedCoachId) {
      toast.error('Please link to a coach profile first');
      return;
    }
    navigate(`/coach-view/${currentUser.linkedCoachId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">User Settings</h1>
            <p className="text-sm text-slate-500">Manage your profile and role</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="user-name">Your Name</Label>
              <Input
                id="user-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className="mt-1"
                data-testid="user-name-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Role Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Role
            </CardTitle>
            <CardDescription>
              Select your role to determine what you can access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedRole(USER_ROLES.COACH_DEVELOPER)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  selectedRole === USER_ROLES.COACH_DEVELOPER
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
                data-testid="role-coach-developer"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-slate-900">Coach Developer</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Full access to observe coaches, view all data, and generate reports
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole(USER_ROLES.COACH)}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  selectedRole === USER_ROLES.COACH
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
                data-testid="role-coach"
              >
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-slate-900">Coach</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  View your own sessions, add reflections, and track your development
                </p>
              </button>
            </div>

            {/* Coach linking */}
            {selectedRole === USER_ROLES.COACH && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <Label htmlFor="linked-coach">Link to Coach Profile</Label>
                <Select value={linkedCoachId} onValueChange={setLinkedCoachId}>
                  <SelectTrigger className="mt-1" data-testid="linked-coach-select">
                    <SelectValue placeholder="Select your coach profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {coaches.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">
                  Link your account to your coach profile to access the Coach View
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} data-testid="save-settings-btn">
            <Check className="w-4 h-4 mr-2" />
            Save Settings
          </Button>

          {currentUser?.role === USER_ROLES.COACH && currentUser?.linkedCoachId && (
            <Button variant="outline" onClick={handleSwitchToCoachView}>
              <Eye className="w-4 h-4 mr-2" />
              Open Coach View
            </Button>
          )}
        </div>

        {/* Current Status */}
        {currentUser && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{currentUser.name}</p>
                  <Badge variant={currentUser.role === USER_ROLES.COACH_DEVELOPER ? 'default' : 'secondary'}>
                    {currentUser.role === USER_ROLES.COACH_DEVELOPER ? 'Coach Developer' : 'Coach'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
