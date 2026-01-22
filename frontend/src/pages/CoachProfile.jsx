import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Check, X, Target, Calendar, User, Sparkles, Loader2, Eye, Play, Download, FileText, Filter, Camera, Paperclip, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { storage } from '../lib/storage';
import { formatDate, formatTime, generateId, calcPercentage, countBy } from '../lib/utils';
import { exportCoachReportPDF, exportCoachReportCSV } from '../lib/export';
import { fetchSessionParts } from '../lib/sessionPartsApi';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CoachProfile() {
  const navigate = useNavigate();
  const { coachId } = useParams();
  const { isCoachDeveloper } = useAuth();
  
  const [coach, setCoach] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [isGeneratingTrends, setIsGeneratingTrends] = useState(false);
  
  // Report export state
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Session part filtering
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedPartFilter, setSelectedPartFilter] = useState('all');
  
  // Photo upload state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  useEffect(() => {
    loadCoach();
    loadSessionParts();
  }, [coachId]);

  const loadCoach = () => {
    const loaded = storage.getCoach(coachId);
    if (!loaded) {
      toast.error('Coach not found');
      navigate('/coaches');
      return;
    }
    setCoach(loaded);
    setEditName(loaded.name);
    setEditRole(loaded.role || '');
    setEditNotes(loaded.notes || '');
    
    // Load sessions for this coach
    const coachSessions = storage.getCoachSessions(coachId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setSessions(coachSessions);
  };

  const loadSessionParts = async () => {
    try {
      const parts = await fetchSessionParts();
      setAvailableParts(parts);
    } catch (err) {
      console.error('Failed to load session parts:', err);
    }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      const updatedCoach = { ...coach, photoUrl: data.url };
      saveCoach(updatedCoach);
      toast.success('Photo uploaded successfully');
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    const updatedCoach = { ...coach, photoUrl: null };
    saveCoach(updatedCoach);
    toast.success('Photo removed');
  };

  // File attachment upload handler
  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }
    
    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      const newAttachment = {
        id: data.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: data.url,
        uploadedAt: new Date().toISOString()
      };
      
      const updatedCoach = { 
        ...coach, 
        attachments: [...(coach.attachments || []), newAttachment] 
      };
      saveCoach(updatedCoach);
      toast.success('File attached successfully');
    } catch (err) {
      console.error('Attachment upload error:', err);
      toast.error('Failed to upload file');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (attachmentId) => {
    const updatedCoach = {
      ...coach,
      attachments: (coach.attachments || []).filter(a => a.id !== attachmentId)
    };
    saveCoach(updatedCoach);
    toast.success('Attachment removed');
  };

  // Save coach info edit
  const handleSaveEdit = () => {
    const updatedCoach = {
      ...coach,
      name: editName,
      role: editRole,
      notes: editNotes
    };
    saveCoach(updatedCoach);
    toast.success('Coach information updated');
  };

  // Get all unique session parts used across this coach's sessions
  const getAllUsedParts = () => {
    const usedParts = new Set();
    sessions.forEach(s => {
      (s.sessionParts || []).forEach(p => {
        usedParts.add(JSON.stringify({ id: p.id, name: p.name }));
      });
    });
    return Array.from(usedParts).map(p => JSON.parse(p));
  };

  // Filter sessions by selected part
  const getFilteredSessions = () => {
    if (selectedPartFilter === 'all') return sessions;
    return sessions.filter(s => 
      (s.sessionParts || []).some(p => p.name === selectedPartFilter || p.id === selectedPartFilter)
    );
  };

  // Calculate stats for filtered sessions
  const getFilteredStats = () => {
    const filtered = getFilteredSessions();
    const completedSessions = filtered.filter(s => s.status === 'completed');
    
    const totalEvents = completedSessions.reduce((sum, s) => {
      const events = s.events || [];
      if (selectedPartFilter === 'all') return sum + events.length;
      // Filter events by session part
      return sum + events.filter(e => {
        const part = (s.sessionParts || []).find(p => p.id === e.sessionPartId);
        return part && (part.name === selectedPartFilter || part.id === selectedPartFilter);
      }).length;
    }, 0);

    const totalDuration = completedSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const totalBallRolling = completedSessions.reduce((sum, s) => sum + (s.ballRollingTime || 0), 0);
    const totalBallStopped = completedSessions.reduce((sum, s) => sum + (s.ballNotRollingTime || 0), 0);
    
    return {
      sessionCount: completedSessions.length,
      totalEvents,
      totalDuration,
      avgBallRolling: calcPercentage(totalBallRolling, totalBallRolling + totalBallStopped)
    };
  };

  const saveCoach = (updated) => {
    storage.saveCoach({ ...updated, updatedAt: new Date().toISOString() });
    setCoach(updated);
  };

  const handleSaveDetails = () => {
    const updated = {
      ...coach,
      name: editName,
      role: editRole,
      notes: editNotes
    };
    saveCoach(updated);
    setIsEditing(false);
    toast.success('Profile updated');
  };

  const handleAddTarget = () => {
    if (!newTarget.trim()) return;
    
    const target = {
      id: generateId('target'),
      text: newTarget.trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    const updated = {
      ...coach,
      targets: [...(coach.targets || []), target]
    };
    saveCoach(updated);
    setNewTarget('');
    toast.success('Target added');
  };

  const handleToggleTarget = (targetId) => {
    const updated = {
      ...coach,
      targets: coach.targets.map(t => 
        t.id === targetId 
          ? { ...t, status: t.status === 'active' ? 'achieved' : 'active' }
          : t
      )
    };
    saveCoach(updated);
  };

  const handleDeleteTarget = (targetId) => {
    const updated = {
      ...coach,
      targets: coach.targets.filter(t => t.id !== targetId)
    };
    saveCoach(updated);
    toast.success('Target removed');
  };

  const handleGenerateTrends = async () => {
    if (sessions.length === 0) {
      toast.error('No sessions to analyze');
      return;
    }
    
    setIsGeneratingTrends(true);
    try {
      const sessionsData = sessions.map(s => ({
        name: s.name,
        date: formatDate(s.createdAt),
        duration: formatTime(s.totalDuration),
        events: s.events?.length || 0,
        ballRollingPct: Math.round((s.ballRollingTime / (s.ballRollingTime + s.ballNotRollingTime || 1)) * 100),
        interventions: s.eventTypes?.map(et => {
          const count = s.events?.filter(e => e.eventTypeId === et.id).length || 0;
          return `${et.name}: ${count}`;
        }).join(', ')
      }));
      
      const response = await axios.post(`${API}/generate-coach-trends`, {
        coach_name: coach.name,
        sessions_data: sessionsData,
        current_targets: (coach.targets || []).filter(t => t.status === 'active').map(t => t.text)
      });
      
      const updated = {
        ...coach,
        aiTrendSummary: response.data.trend_summary,
        aiTrendSummaryDate: new Date().toISOString()
      };
      saveCoach(updated);
      toast.success('Trends analysis generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate trends');
    } finally {
      setIsGeneratingTrends(false);
    }
  };

  const handleExportReport = async (format) => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    
    const start = new Date(reportStartDate);
    const end = new Date(reportEndDate);
    end.setHours(23, 59, 59, 999); // Include full end date
    
    if (start > end) {
      toast.error('Start date must be before end date');
      return;
    }
    
    // Filter sessions within date range
    const filteredSessions = sessions.filter(s => {
      const sessionDate = new Date(s.createdAt);
      return sessionDate >= start && sessionDate <= end && s.status === 'completed';
    });
    
    if (filteredSessions.length === 0) {
      toast.error('No completed sessions found in selected date range');
      return;
    }
    
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await exportCoachReportPDF(coach, filteredSessions, reportStartDate, reportEndDate);
      } else {
        exportCoachReportCSV(coach, filteredSessions, reportStartDate, reportEndDate);
      }
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteCoach = () => {
    storage.deleteCoach(coachId);
    toast.success('Coach profile deleted');
    navigate('/coaches');
  };

  if (!coach) return null;

  const activeTargets = (coach.targets || []).filter(t => t.status === 'active');
  const achievedTargets = (coach.targets || []).filter(t => t.status === 'achieved');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/coaches')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {/* Coach Photo */}
              <div className="relative group">
                {coach.photoUrl ? (
                  <img 
                    src={coach.photoUrl} 
                    alt={coach.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-500" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">{coach.name}</h1>
                {coach.role && <p className="text-sm text-slate-500">{coach.role}</p>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate(`/session/new?coachId=${coachId}`)}
              data-testid="new-observation-btn"
            >
              <Play className="w-4 h-4 mr-2" />
              New Observation
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Coach Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete {coach.name}'s profile. Session data will be preserved but unlinked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCoach} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="targets" data-testid="tab-targets">Targets</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="tab-sessions">Sessions</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          </TabsList>

          {/* Profile Tab - Photo & Attachments */}
          <TabsContent value="profile" className="space-y-6">
            {/* Photo Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Profile Photo
                </CardTitle>
                <CardDescription>
                  Upload a photo for this coach's profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  {/* Photo Preview */}
                  <div className="relative">
                    {coach.photoUrl ? (
                      <img 
                        src={coach.photoUrl} 
                        alt={coach.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-slate-100"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-slate-100">
                        <User className="w-10 h-10 text-slate-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Controls */}
                  <div className="space-y-3">
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                        disabled={isUploadingPhoto}
                      />
                      <label htmlFor="photo-upload">
                        <Button asChild disabled={isUploadingPhoto} className="cursor-pointer">
                          <span>
                            {isUploadingPhoto ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {coach.photoUrl ? 'Change Photo' : 'Upload Photo'}
                          </span>
                        </Button>
                      </label>
                    </div>
                    {coach.photoUrl && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRemovePhoto}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove Photo
                      </Button>
                    )}
                    <p className="text-xs text-slate-500">
                      Recommended: Square image, max 5MB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments
                </CardTitle>
                <CardDescription>
                  Attach development plans, certificates, or other documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    onChange={handleAttachmentUpload}
                    className="hidden"
                    id="attachment-upload"
                    disabled={isUploadingAttachment}
                  />
                  <label htmlFor="attachment-upload">
                    <Button asChild variant="outline" disabled={isUploadingAttachment} className="cursor-pointer">
                      <span>
                        {isUploadingAttachment ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Add Attachment
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    Max file size: 10MB
                  </p>
                </div>

                {/* Attachments List */}
                {(coach.attachments || []).length > 0 ? (
                  <div className="space-y-2">
                    {(coach.attachments || []).map(attachment => (
                      <div 
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-slate-400" />
                          <div>
                            <a 
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline text-sm"
                            >
                              {attachment.name}
                            </a>
                            <p className="text-xs text-slate-500">
                              {(attachment.size / 1024).toFixed(1)} KB • {new Date(attachment.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No attachments yet</p>
                )}
              </CardContent>
            </Card>

            {/* Coach Info Edit */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Edit2 className="w-5 h-5" />
                  Coach Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    placeholder="e.g., U14 Head Coach"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this coach..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleSaveEdit}>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Session Part Filter */}
            {isCoachDeveloper() && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-slate-500" />
                      <Label className="text-sm font-medium">Filter by Session Part:</Label>
                    </div>
                    <Select value={selectedPartFilter} onValueChange={setSelectedPartFilter}>
                      <SelectTrigger className="w-[250px]" data-testid="part-filter-select">
                        <SelectValue placeholder="All Parts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Session Parts</SelectItem>
                        {availableParts.filter(p => p.is_default).map(part => (
                          <SelectItem key={part.part_id} value={part.name}>
                            {part.name} {part.is_default && "(Default)"}
                          </SelectItem>
                        ))}
                        {getAllUsedParts().filter(p => !availableParts.some(ap => ap.name === p.name)).map(part => (
                          <SelectItem key={part.id} value={part.name}>
                            {part.name} (Custom)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPartFilter !== 'all' && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPartFilter('all')}>
                        Clear Filter
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-slate-900">
                    {selectedPartFilter === 'all' ? sessions.length : getFilteredStats().sessionCount}
                  </div>
                  <div className="text-sm text-slate-500">Sessions Observed</div>
                  {selectedPartFilter !== 'all' && (
                    <div className="text-xs text-blue-600 mt-1">Filtered: {selectedPartFilter}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-orange-600">{activeTargets.length}</div>
                  <div className="text-sm text-slate-500">Active Targets</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl font-bold text-green-600">{achievedTargets.length}</div>
                  <div className="text-sm text-slate-500">Targets Achieved</div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Filtered Stats */}
            {selectedPartFilter !== 'all' && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] text-base">
                    Stats for "{selectedPartFilter}"
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-slate-700">{getFilteredStats().totalEvents}</div>
                      <div className="text-xs text-slate-500">Total Interventions</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-700">{formatTime(getFilteredStats().totalDuration)}</div>
                      <div className="text-xs text-slate-500">Total Duration</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{getFilteredStats().avgBallRolling}%</div>
                      <div className="text-xs text-slate-500">Avg Ball Rolling</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Profile Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-['Manrope']">Profile Details</CardTitle>
                {!isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Role</label>
                      <Input
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        placeholder="e.g., U14 Head Coach"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Notes</label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="General notes about this coach..."
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveDetails}>Save</Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coach.role && (
                      <div>
                        <span className="text-sm text-slate-500">Role: </span>
                        <span className="text-slate-900">{coach.role}</span>
                      </div>
                    )}
                    {coach.notes && (
                      <div>
                        <span className="text-sm text-slate-500">Notes: </span>
                        <p className="text-slate-700 mt-1">{coach.notes}</p>
                      </div>
                    )}
                    {!coach.role && !coach.notes && (
                      <p className="text-slate-400 italic">No details added yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Trends Summary */}
            <Card className="border-purple-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-5 h-5" />
                    Development Trends
                  </CardTitle>
                  {coach.aiTrendSummaryDate && (
                    <CardDescription>Last updated: {formatDate(coach.aiTrendSummaryDate)}</CardDescription>
                  )}
                </div>
                <Button 
                  onClick={handleGenerateTrends}
                  disabled={isGeneratingTrends || sessions.length === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="generate-trends-btn"
                >
                  {isGeneratingTrends ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {coach.aiTrendSummary ? 'Refresh' : 'Generate'}
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {coach.aiTrendSummary ? (
                  <div className="prose prose-slate prose-sm max-w-none">
                    {coach.aiTrendSummary.split('\n').map((paragraph, i) => (
                      paragraph.trim() && <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">
                    {sessions.length === 0 
                      ? 'Complete some observations to generate trend analysis'
                      : 'Click "Generate" to create an AI analysis of coaching trends'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Targets Tab */}
          <TabsContent value="targets" className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Targets are optional development focus areas for reference only. 
                They are non-evaluative and not linked to any scoring or assessment.
              </p>
            </div>

            {/* Add Target */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Development Targets</CardTitle>
                <CardDescription>Set optional focus areas for this coach's development journey</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <Input
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="e.g., Increase use of questioning during practice"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTarget()}
                    data-testid="new-target-input"
                  />
                  <Button onClick={handleAddTarget} data-testid="add-target-btn">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Active Targets */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-700 flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-500" />
                    Active Focus Areas ({activeTargets.length})
                  </h4>
                  {activeTargets.length === 0 ? (
                    <p className="text-slate-400 italic text-sm">No active targets - add one above to track development focus</p>
                  ) : (
                    <div className="space-y-2">
                      {activeTargets.map(target => (
                        <div key={target.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <button
                            onClick={() => handleToggleTarget(target.id)}
                            className="w-5 h-5 rounded border-2 border-orange-400 hover:bg-orange-100 flex items-center justify-center"
                            title="Mark as achieved"
                          />
                          <span className="flex-1 text-slate-700">{target.text}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteTarget(target.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Achieved Targets */}
                {achievedTargets.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Achieved ({achievedTargets.length})
                    </h4>
                    <div className="space-y-2">
                      {achievedTargets.map(target => (
                        <div key={target.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <button
                            onClick={() => handleToggleTarget(target.id)}
                            className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-white" />
                          </button>
                          <span className="flex-1 text-slate-500 line-through">{target.text}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteTarget(target.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-['Manrope']">Observation History</CardTitle>
                  <CardDescription>{sessions.length} sessions recorded</CardDescription>
                </div>
                <Button onClick={() => navigate(`/session/new?coachId=${coachId}`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-8">No observations recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map(session => (
                      <div 
                        key={session.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                        onClick={() => navigate(`/session/${session.id}/review`)}
                      >
                        <div>
                          <h4 className="font-medium text-slate-900">{session.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span>{formatDate(session.createdAt)}</span>
                            <span>•</span>
                            <span>{formatTime(session.totalDuration)}</span>
                            <span>•</span>
                            <span>{session.events?.length || 0} events</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status === 'completed' ? 'Completed' : session.status}
                          </Badge>
                          <Eye className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Export Report
                </CardTitle>
                <CardDescription>
                  Generate a consolidated report for a specific time period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="report-start-date">Start Date</Label>
                    <Input
                      id="report-start-date"
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="mt-1"
                      data-testid="report-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="report-end-date">End Date</Label>
                    <Input
                      id="report-end-date"
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="mt-1"
                      data-testid="report-end-date"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div>
                  <Label className="text-slate-500 text-sm">Quick Select</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const lastWeek = new Date(today);
                        lastWeek.setDate(today.getDate() - 7);
                        setReportStartDate(lastWeek.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 7 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const lastMonth = new Date(today);
                        lastMonth.setMonth(today.getMonth() - 1);
                        setReportStartDate(lastMonth.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 30 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const last3Months = new Date(today);
                        last3Months.setMonth(today.getMonth() - 3);
                        setReportStartDate(last3Months.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Last 3 Months
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const startOfYear = new Date(today.getFullYear(), 0, 1);
                        setReportStartDate(startOfYear.toISOString().split('T')[0]);
                        setReportEndDate(today.toISOString().split('T')[0]);
                      }}
                    >
                      Year to Date
                    </Button>
                  </div>
                </div>

                {/* Export Preview */}
                {reportStartDate && reportEndDate && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-700 mb-2">Report Preview</h4>
                    <p className="text-sm text-slate-600">
                      Period: {formatDate(reportStartDate)} - {formatDate(reportEndDate)}
                    </p>
                    <p className="text-sm text-slate-600">
                      Completed Sessions: {sessions.filter(s => {
                        const sessionDate = new Date(s.createdAt);
                        const start = new Date(reportStartDate);
                        const end = new Date(reportEndDate);
                        end.setHours(23, 59, 59, 999);
                        return sessionDate >= start && sessionDate <= end && s.status === 'completed';
                      }).length}
                    </p>
                  </div>
                )}

                {/* Export Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleExportReport('pdf')}
                    disabled={isExporting || !reportStartDate || !reportEndDate}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="export-pdf-btn"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportReport('csv')}
                    disabled={isExporting || !reportStartDate || !reportEndDate}
                    data-testid="export-csv-btn"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export CSV
                  </Button>
                </div>

                {/* Report Contents Description */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Report includes:</h4>
                  <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
                    <li>Session summaries and statistics</li>
                    <li>Intervention breakdown by type</li>
                    <li>Ball rolling time analysis</li>
                    <li>AI-generated insights (if available)</li>
                    <li>Progress towards targets</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
