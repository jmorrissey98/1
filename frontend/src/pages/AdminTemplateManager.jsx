import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Edit2, Globe, Users, Building2, 
  Tag, Check, X, Loader2, ChevronDown, ChevronUp, Search,
  Eye, FileText, ClipboardList, Copy, MoreVertical
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Category configurations
const CATEGORIES = {
  observation: {
    label: 'Coach Observations',
    description: 'Templates for observing coaching sessions',
    icon: Eye
  },
  coach_reflection: {
    label: 'Coach Reflections',
    description: 'Templates for coaches to reflect on their sessions',
    icon: FileText
  },
  coach_developer_reflection: {
    label: 'Coach Developer Reflections',
    description: 'Templates for coach developers to reflect on observations',
    icon: ClipboardList
  }
};

export default function AdminTemplateManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('observation');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    qualification_tags: [],
    is_global: false,
    template_data: {}
  });
  const [newTag, setNewTag] = useState('');
  
  // Assignment state
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignableOrgs, setAssignableOrgs] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState([]);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/home');
    }
  }, [user, navigate]);

  // Load templates
  useEffect(() => {
    loadTemplates();
    loadStats();
    loadTags();
  }, [activeCategory]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates?category=${activeCategory}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        toast.error('Failed to load templates');
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/stats/summary`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/tags`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags || []);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };

  const loadAssignableUsers = async (search = '') => {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/assignable/users?search=${encodeURIComponent(search)}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setAssignableUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadAssignableOrgs = async (search = '') => {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/assignable/organizations?search=${encodeURIComponent(search)}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setAssignableOrgs(data.organizations || []);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/templates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          category: activeCategory,
          ...formData
        })
      });

      if (response.ok) {
        toast.success('Template created successfully');
        setShowCreateDialog(false);
        resetForm();
        loadTemplates();
        loadStats();
        loadTags();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to create template');
      }
    } catch (err) {
      toast.error('Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/${selectedTemplate.template_id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(formData)
        }
      );

      if (response.ok) {
        toast.success('Template updated successfully');
        setShowEditDialog(false);
        setSelectedTemplate(null);
        resetForm();
        loadTemplates();
        loadTags();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to update template');
      }
    } catch (err) {
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/${selectedTemplate.template_id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        toast.success('Template deleted successfully');
        setShowDeleteDialog(false);
        setSelectedTemplate(null);
        loadTemplates();
        loadStats();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to delete template');
      }
    } catch (err) {
      toast.error('Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGlobal = async (template) => {
    try {
      const endpoint = template.is_global ? 'unset-global' : 'set-global';
      const response = await fetch(
        `${API_URL}/api/admin/templates/${template.template_id}/${endpoint}`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        toast.success(template.is_global ? 'Template removed from global' : 'Template set as global');
        loadTemplates();
        loadStats();
      } else {
        toast.error('Failed to update template');
      }
    } catch (err) {
      toast.error('Failed to update template');
    }
  };

  const handleAssign = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/templates/${selectedTemplate.template_id}/assign`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            user_ids: selectedUserIds,
            org_ids: selectedOrgIds
          })
        }
      );

      if (response.ok) {
        toast.success('Template assigned successfully');
        setShowAssignDialog(false);
        setSelectedTemplate(null);
        setSelectedUserIds([]);
        setSelectedOrgIds([]);
        loadTemplates();
      } else {
        toast.error('Failed to assign template');
      }
    } catch (err) {
      toast.error('Failed to assign template');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      qualification_tags: [],
      is_global: false,
      template_data: {}
    });
    setNewTag('');
  };

  const openEditDialog = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name || '',
      description: template.description || '',
      qualification_tags: template.qualification_tags || [],
      is_global: template.is_global || false,
      template_data: template.template_data || {}
    });
    setShowEditDialog(true);
  };

  const openAssignDialog = (template) => {
    setSelectedTemplate(template);
    setSelectedUserIds(template.assigned_user_ids || []);
    setSelectedOrgIds(template.assigned_org_ids || []);
    loadAssignableUsers();
    loadAssignableOrgs();
    setShowAssignDialog(true);
  };

  const addTag = () => {
    const tag = newTag.trim().toUpperCase();
    if (tag && !formData.qualification_tags.includes(tag)) {
      setFormData({
        ...formData,
        qualification_tags: [...formData.qualification_tags, tag]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      qualification_tags: formData.qualification_tags.filter(t => t !== tagToRemove)
    });
  };

  const CategoryIcon = CATEGORIES[activeCategory]?.icon || Eye;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Template Management</h1>
                <p className="text-sm text-slate-500">Manage global and assigned templates</p>
              </div>
            </div>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-slate-900">{stats.total_templates}</div>
                <div className="text-sm text-slate-500">Total Templates</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{stats.total_global}</div>
                <div className="text-sm text-slate-500">Global Templates</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.total_user_overrides}</div>
                <div className="text-sm text-slate-500">User Overrides</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-slate-600">
                  {stats.by_category?.[activeCategory]?.total || 0}
                </div>
                <div className="text-sm text-slate-500">In Current Category</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            {Object.entries(CATEGORIES).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="text-sm">
                <config.icon className="w-4 h-4 mr-2" />
                {config.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(CATEGORIES).map(([key, config]) => (
            <TabsContent key={key} value={key}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <config.icon className="w-5 h-5" />
                        {config.label}
                      </CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </div>
                    {availableTags.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Tags:</span>
                        {availableTags.slice(0, 5).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {availableTags.length > 5 && (
                          <span className="text-xs text-slate-400">+{availableTags.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-center py-12">
                      <config.icon className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-500">No templates in this category</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => { resetForm(); setShowCreateDialog(true); }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Template
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templates.map(template => (
                        <div
                          key={template.template_id}
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-slate-900">{template.name}</h3>
                              {template.is_global && (
                                <Badge className="bg-green-100 text-green-700 text-xs">
                                  <Globe className="w-3 h-3 mr-1" />
                                  Global
                                </Badge>
                              )}
                              {template.assigned_user_ids?.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="w-3 h-3 mr-1" />
                                  {template.assigned_user_ids.length} users
                                </Badge>
                              )}
                              {template.assigned_org_ids?.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {template.assigned_org_ids.length} orgs
                                </Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                            )}
                            {template.qualification_tags?.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {template.qualification_tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.is_global}
                              onCheckedChange={() => handleToggleGlobal(template)}
                              aria-label="Toggle global"
                            />
                            <span className="text-xs text-slate-500 w-12">
                              {template.is_global ? 'Global' : 'Private'}
                            </span>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(template)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAssignDialog(template)}>
                                  <Users className="w-4 h-4 mr-2" />
                                  Assign
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => { setSelectedTemplate(template); setShowDeleteDialog(true); }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a new {CATEGORIES[activeCategory]?.label.toLowerCase()} template
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter template description"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Qualification Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag (e.g., UEFA B)"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-slate-500 mr-1">Existing:</span>
                  {availableTags.map(tag => (
                    <Button
                      key={tag}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        if (!formData.qualification_tags.includes(tag)) {
                          setFormData({
                            ...formData,
                            qualification_tags: [...formData.qualification_tags, tag]
                          });
                        }
                      }}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              )}
              {formData.qualification_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.qualification_tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="pr-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Set as Global Default</Label>
                <p className="text-xs text-slate-500">Available to all users automatically</p>
              </div>
              <Switch
                checked={formData.is_global}
                onCheckedChange={(checked) => setFormData({ ...formData, is_global: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update template details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter template description"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Qualification Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag (e.g., UEFA B)"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.qualification_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.qualification_tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="pr-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium">Set as Global Default</Label>
                <p className="text-xs text-slate-500">Available to all users automatically</p>
              </div>
              <Switch
                checked={formData.is_global}
                onCheckedChange={(checked) => setFormData({ ...formData, is_global: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? 
              This action cannot be undone. User overrides will remain but lose their reference to this template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Template</DialogTitle>
            <DialogDescription>
              Assign "{selectedTemplate?.name}" to specific users or organizations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Users Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Users
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    loadAssignableUsers(e.target.value);
                  }}
                  placeholder="Search users..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                {assignableUsers.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500 text-center">No users found</p>
                ) : (
                  assignableUsers.map(u => (
                    <label
                      key={u.user_id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds([...selectedUserIds, u.user_id]);
                          } else {
                            setSelectedUserIds(selectedUserIds.filter(id => id !== u.user_id));
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {u.role?.replace('_', ' ')}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
              {selectedUserIds.length > 0 && (
                <p className="text-xs text-slate-500">{selectedUserIds.length} user(s) selected</p>
              )}
            </div>

            {/* Organizations Section */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Organizations
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={orgSearch}
                  onChange={(e) => {
                    setOrgSearch(e.target.value);
                    loadAssignableOrgs(e.target.value);
                  }}
                  placeholder="Search organizations..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                {assignableOrgs.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500 text-center">No organizations found</p>
                ) : (
                  assignableOrgs.map(org => (
                    <label
                      key={org.org_id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOrgIds.includes(org.org_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrgIds([...selectedOrgIds, org.org_id]);
                          } else {
                            setSelectedOrgIds(selectedOrgIds.filter(id => id !== org.org_id));
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {org.club_name || 'Unnamed Organization'}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {selectedOrgIds.length > 0 && (
                <p className="text-xs text-slate-500">{selectedOrgIds.length} organization(s) selected</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={saving || (selectedUserIds.length === 0 && selectedOrgIds.length === 0)}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Assign Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
