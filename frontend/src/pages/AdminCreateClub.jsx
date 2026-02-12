import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Upload, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { safePost } from '../lib/safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminCreateClub() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubLogo, setClubLogo] = useState('');
  const [logoPreview, setLogoPreview] = useState('');

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      setClubLogo(base64);
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!clubName.trim()) {
      toast.error('Please enter a club name');
      return;
    }

    setSaving(true);

    try {
      const result = await safePost(`${API_URL}/api/admin/organizations`, {
        club_name: clubName.trim(),
        club_logo: clubLogo || null
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create club');
      }

      toast.success('Club created successfully');
      navigate('/admin');
    } catch (err) {
      console.error('Error creating club:', err);
      toast.error(err.message || 'Failed to create club');
    } finally {
      setSaving(false);
    }
  };

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
            <h1 className="text-xl font-bold font-['Manrope']">Create New Club</h1>
            <p className="text-sm text-slate-400">Add a new organization to the platform</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Club Details
            </CardTitle>
            <CardDescription>
              Enter the details for the new club/organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Club Name */}
              <div className="space-y-2">
                <Label htmlFor="clubName">Club Name *</Label>
                <Input
                  id="clubName"
                  placeholder="e.g., QPR Academy"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  data-testid="club-name-input"
                />
              </div>

              {/* Club Logo */}
              <div className="space-y-2">
                <Label>Club Badge/Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img 
                        src={logoPreview} 
                        alt="Club logo preview" 
                        className="w-20 h-20 object-contain rounded-lg border border-slate-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setClubLogo('');
                          setLogoPreview('');
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                      <Building2 className="w-8 h-8" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload').click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-slate-500 mt-1">PNG or JPG, max 2MB</p>
                  </div>
                </div>
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
                <Button type="submit" disabled={saving} data-testid="submit-club-btn">
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4 mr-2" />
                  )}
                  Create Club
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
