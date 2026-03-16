import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Table, Circle, Square, Edit2, Check, X, Trash2, Sparkles, Loader2, StickyNote, ChevronDown, ChevronUp, Upload, Paperclip, User, Filter, Star, ClipboardList, Share2, Lock, Eye, EyeOff, Clock, Pencil } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { OBSERVATION_CONTEXTS } from '../lib/storage';
import { formatTime, formatDateTime, calcPercentage, countBy, cn, generateId } from '../lib/utils';
import { exportToPDF, exportToCSV } from '../lib/export';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { fetchReflectionTemplates, fetchReflectionTemplate } from '../lib/reflectionTemplatesApi';
import { fetchLimitsSummary } from '../lib/subscriptionApi';
import axios from 'axios';
import { getAuthToken } from '../lib/safeFetch';
import { useSwipeTabs } from '../hooks/useSwipeNavigation';
import { SessionEditTimeline } from '../components/SessionEditTimeline';
import { SpeechToTextButton } from '../components/SpeechToTextButton';

const BACKEND_URL = ''; // Relative URL - frontend and backend on same domain
const API = '/api';
const CHART_COLORS = ['#FACC15', '#38BDF8', '#4ADE80', '#F97316', '#A855F7', '#EC4899'];

// Helper to get axios config with auth headers
const getAxiosConfig = () => {
  const token = getAuthToken();
  return {
    withCredentials: true,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  };
};

// Format relative time (milliseconds to MM:SS)
const formatRelativeTime = (ms) => {
  if (ms === undefined || ms === null) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Multi-Dimensional Intervention Analytics Module
const InterventionAnalyticsModule = ({ events, interventionTypes, descriptorGroup1, descriptorGroup2 }) => {
  const [groupBy, setGroupBy] = useState('intervention');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedDimension, setSelectedDimension] = useState(null);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  
  // Build cross-tabulation data
  const buildCrossTab = () => {
    if (!events || events.length === 0) return { rows: [], cols: [], data: {} };
    
    const rows = [];
    const cols = [];
    const data = {};
    
    if (groupBy === 'intervention') {
      // Group by intervention type, show descriptor breakdown
      interventionTypes.forEach(type => {
        rows.push({ id: type.id, name: type.name });
      });
      
      if (descriptorGroup1?.descriptors) {
        descriptorGroup1.descriptors.forEach(d => {
          cols.push({ id: d.id, name: d.name, group: 1 });
        });
      }
    } else if (groupBy === 'content') {
      // Group by descriptor group 1 (content focus)
      if (descriptorGroup1?.descriptors) {
        descriptorGroup1.descriptors.forEach(d => {
          rows.push({ id: d.id, name: d.name });
        });
      }
      
      interventionTypes.forEach(type => {
        cols.push({ id: type.id, name: type.name });
      });
    } else if (groupBy === 'delivery') {
      // Group by descriptor group 2 (delivery method)
      if (descriptorGroup2?.descriptors) {
        descriptorGroup2.descriptors.forEach(d => {
          rows.push({ id: d.id, name: d.name });
        });
      }
      
      interventionTypes.forEach(type => {
        cols.push({ id: type.id, name: type.name });
      });
    }
    
    // Calculate counts
    events.forEach(event => {
      if (groupBy === 'intervention') {
        const rowId = event.eventTypeId;
        (event.descriptors1 || []).forEach(colId => {
          const key = `${rowId}-${colId}`;
          data[key] = (data[key] || 0) + 1;
        });
      } else if (groupBy === 'content') {
        (event.descriptors1 || []).forEach(rowId => {
          const colId = event.eventTypeId;
          const key = `${rowId}-${colId}`;
          data[key] = (data[key] || 0) + 1;
        });
      } else if (groupBy === 'delivery') {
        (event.descriptors2 || []).forEach(rowId => {
          const colId = event.eventTypeId;
          const key = `${rowId}-${colId}`;
          data[key] = (data[key] || 0) + 1;
        });
      }
    });
    
    return { rows, cols, data };
  };
  
  const crossTab = buildCrossTab();
  
  // Build stacked bar chart data
  const buildStackedData = () => {
    const stackedData = [];
    
    if (groupBy === 'intervention') {
      interventionTypes.forEach(type => {
        const row = { name: type.name };
        let total = 0;
        
        // Count total events for this intervention type
        const typeEventCount = events.filter(e => e.eventTypeId === type.id).length;
        
        if (descriptorGroup1?.descriptors) {
          descriptorGroup1.descriptors.forEach(d => {
            const count = crossTab.data[`${type.id}-${d.id}`] || 0;
            row[d.name] = count;
            total += count;
          });
        }
        
        // If intervention has events but no descriptors, show as "No descriptor"
        if (typeEventCount > 0 && total === 0) {
          row['No descriptor'] = typeEventCount;
          row.total = typeEventCount;
          stackedData.push(row);
        } else if (total > 0) {
          row.total = total;
          stackedData.push(row);
        }
      });
    } else if (groupBy === 'content' && descriptorGroup1?.descriptors) {
      descriptorGroup1.descriptors.forEach(d => {
        const row = { name: d.name };
        let total = 0;
        
        interventionTypes.forEach(type => {
          const count = crossTab.data[`${d.id}-${type.id}`] || 0;
          row[type.name] = count;
          total += count;
        });
        row.total = total;
        if (total > 0) stackedData.push(row);
      });
      
      // Add "No descriptor" row for events without this descriptor selected
      const eventsWithoutDesc = events.filter(e => !e.descriptors1 || e.descriptors1.length === 0);
      if (eventsWithoutDesc.length > 0) {
        const row = { name: 'No descriptor selected' };
        let total = 0;
        interventionTypes.forEach(type => {
          const count = eventsWithoutDesc.filter(e => e.eventTypeId === type.id).length;
          row[type.name] = count;
          total += count;
        });
        row.total = total;
        if (total > 0) stackedData.push(row);
      }
    } else if (groupBy === 'delivery' && descriptorGroup2?.descriptors) {
      descriptorGroup2.descriptors.forEach(d => {
        const row = { name: d.name };
        let total = 0;
        
        interventionTypes.forEach(type => {
          const count = crossTab.data[`${d.id}-${type.id}`] || 0;
          row[type.name] = count;
          total += count;
        });
        row.total = total;
        if (total > 0) stackedData.push(row);
      });
      
      // Add "No descriptor" row for events without this descriptor selected
      const eventsWithoutDesc = events.filter(e => !e.descriptors2 || e.descriptors2.length === 0);
      if (eventsWithoutDesc.length > 0) {
        const row = { name: 'No descriptor selected' };
        let total = 0;
        interventionTypes.forEach(type => {
          const count = eventsWithoutDesc.filter(e => e.eventTypeId === type.id).length;
          row[type.name] = count;
          total += count;
        });
        row.total = total;
        if (total > 0) stackedData.push(row);
      }
    }
    
    return stackedData.sort((a, b) => b.total - a.total);
  };
  
  const stackedData = buildStackedData();
  
  // Get dimension labels for legend
  const getDimensionKeys = () => {
    if (groupBy === 'intervention') {
      const keys = (descriptorGroup1?.descriptors || []).map(d => d.name);
      // Check if any intervention has events without descriptors
      const hasNoDescriptorEvents = interventionTypes.some(type => {
        const typeEvents = events.filter(e => e.eventTypeId === type.id);
        const hasDescriptors = typeEvents.some(e => e.descriptors1 && e.descriptors1.length > 0);
        return typeEvents.length > 0 && !hasDescriptors;
      });
      if (hasNoDescriptorEvents) {
        keys.push('No descriptor');
      }
      return keys;
    }
    return interventionTypes.map(t => t.name);
  };
  
  const dimensionKeys = getDimensionKeys();
  
  // Calculate pattern insights
  const getInsights = () => {
    const insights = [];
    
    if (events.length === 0) return insights;
    
    // Most common intervention-content combination
    let maxCombo = { key: '', count: 0 };
    Object.entries(crossTab.data).forEach(([key, count]) => {
      if (count > maxCombo.count) {
        maxCombo = { key, count };
      }
    });
    
    if (maxCombo.count > 0) {
      const [rowId, colId] = maxCombo.key.split('-');
      let rowName, colName;
      
      if (groupBy === 'intervention') {
        rowName = interventionTypes.find(t => t.id === rowId)?.name || 'Unknown';
        colName = descriptorGroup1?.descriptors?.find(d => d.id === colId)?.name || 'Unknown';
        insights.push({
          type: 'pattern',
          text: `Most common pattern: "${rowName}" with "${colName}" (${maxCombo.count} times)`
        });
      }
    }
    
    // Intervention variety
    const usedTypes = new Set(events.map(e => e.eventTypeId));
    const varietyPercent = Math.round((usedTypes.size / interventionTypes.length) * 100);
    insights.push({
      type: 'variety',
      text: `Intervention variety: ${usedTypes.size}/${interventionTypes.length} types used (${varietyPercent}%)`
    });
    
    return insights;
  };
  
  const insights = getInsights();
  
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-['Manrope'] flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Intervention Patterns
          </CardTitle>
          <CardDescription>Analyze relationships between intervention types and descriptors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            No event data available for analysis
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-['Manrope'] flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Intervention Patterns
            </CardTitle>
            <CardDescription>Analyze relationships between intervention types and descriptors</CardDescription>
          </div>
          
          {/* Grouping Controls */}
          <div className="flex gap-2">
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-40" data-testid="analytics-group-select">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intervention">By Intervention</SelectItem>
                {descriptorGroup1 && <SelectItem value="content">By {descriptorGroup1.name || 'Content'}</SelectItem>}
                {descriptorGroup2 && <SelectItem value="delivery">By {descriptorGroup2.name || 'Delivery'}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Insights */}
        {insights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {insights.map((insight, idx) => (
              <Badge 
                key={idx} 
                variant="outline" 
                className={cn(
                  "text-xs py-1",
                  insight.type === 'pattern' ? "border-yellow-300 bg-yellow-50 text-yellow-800" : 
                  insight.type === 'variety' ? "border-blue-300 bg-blue-50 text-blue-800" : ""
                )}
              >
                {insight.text}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Stacked Bar Chart */}
        <div className="h-72 min-h-[288px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={288}>
            <BarChart data={stackedData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={100} 
                tick={{ fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dimensionKeys.map((key, idx) => (
                <Bar 
                  key={key} 
                  dataKey={key} 
                  stackId="a" 
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={idx === dimensionKeys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Cross-tabulation Table - Collapsible */}
        <div className="border-t pt-4">
          <button 
            onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", showDetailedBreakdown && "rotate-180")} />
            Detailed Breakdown
          </button>
          {showDetailedBreakdown && (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-slate-700">
                      {groupBy === 'intervention' ? 'Intervention' : 
                       groupBy === 'content' ? (descriptorGroup1?.name || 'Content') : 
                       (descriptorGroup2?.name || 'Delivery')}
                    </th>
                    {crossTab.cols.slice(0, 6).map(col => (
                      <th key={col.id} className="text-center py-2 px-2 font-medium text-slate-700 min-w-[60px]">
                        {col.name}
                      </th>
                    ))}
                    <th className="text-center py-2 px-2 font-medium text-slate-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {crossTab.rows.slice(0, 8).map(row => {
                    const rowTotal = crossTab.cols.reduce((sum, col) => {
                      return sum + (crossTab.data[`${row.id}-${col.id}`] || 0);
                    }, 0);
                    
                    return (
                      <tr key={row.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-2 text-slate-700">{row.name}</td>
                        {crossTab.cols.slice(0, 6).map(col => {
                          const count = crossTab.data[`${row.id}-${col.id}`] || 0;
                          return (
                            <td key={col.id} className="text-center py-2 px-2">
                              {count > 0 ? (
                                <span className={cn(
                                  "inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium",
                                  count >= 5 ? "bg-green-100 text-green-800" :
                                  count >= 3 ? "bg-yellow-100 text-yellow-800" :
                                  "bg-slate-100 text-slate-600"
                                )}>
                                  {count}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-2 font-medium text-slate-800">{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function ReviewSession() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { user, isCoachDeveloper } = useAuth();
  const { getSession, saveSession: cloudSaveSession, setCurrentSession } = useCloudSync();
  
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('whole'); // 'whole' or part id
  const [editingEvent, setEditingEvent] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummaryExpanded, setAiSummaryExpanded] = useState(false);
  const [newReflection, setNewReflection] = useState('');
  const [newCoachReflection, setNewCoachReflection] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  
  // Tab state for swipe navigation
  const [activeTab, setActiveTab] = useState('summary');
  const REVIEW_TABS = ['summary', 'reflections', 'analysis'];
  
  // Track mobile viewport for swipe
  const [isMobileForSwipe, setIsMobileForSwipe] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  
  useEffect(() => {
    const checkMobile = () => setIsMobileForSwipe(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Swipe navigation for tabs
  const { ref: swipeRef } = useSwipeTabs({
    tabs: REVIEW_TABS,
    currentTab: activeTab,
    setCurrentTab: setActiveTab,
    enabled: isMobileForSwipe // Only on mobile
  });
  
  // Reflection template state
  const [reflectionTemplates, setReflectionTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [templateResponses, setTemplateResponses] = useState({});
  const [savingReflection, setSavingReflection] = useState(false);
  const [observerNotesExpanded, setObserverNotesExpanded] = useState(true);
  
  // Sharing state
  const [observerReflectionShared, setObserverReflectionShared] = useState(true);
  const [coachReflectionShared, setCoachReflectionShared] = useState(true);
  const [togglingShare, setTogglingShare] = useState(false);
  
  // State for clicked note dialog
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  
  // Ball state filter for intervention timeline
  // null = show all, 'rolling' = only rolling, 'stopped' = only stopped
  const [ballStateFilter, setBallStateFilter] = useState(null);
  
  // Edit mode state (only for Coach Developers on completed sessions)
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Subscription tier state for Individual Coach handling
  const [subscriptionTier, setSubscriptionTier] = useState(null);
  const isIndividualCoachTier = subscriptionTier === 'individual_coach';
  
  const isCoachView = user?.role === 'coach';
  // Individual Coach tier users observe themselves, so they edit Coach Reflection, not Observer Reflection
  // Coaches can view everything but only edit their own reflections
  const canEditObserverContent = !isCoachView && !isIndividualCoachTier;
  // Individual Coach tier can edit coach reflection (they ARE the coach being observed)
  const canEditCoachReflection = isCoachView || isIndividualCoachTier;
  // Can edit session: Coach Developer only, on completed sessions
  const canEditSession = isCoachDeveloper && session?.status === 'completed';

  useEffect(() => {
    const loadSession = async () => {
      setLoading(true);
      try {
        const loaded = await getSession(sessionId);
        if (!loaded) {
          toast.error('Session not found');
          navigate('/');
          return;
        }
        setSession(loaded);
        setCurrentSession(loaded);
        
        // Initialize sharing states from loaded session
        setObserverReflectionShared(loaded.observer_reflection_shared !== false);
        setCoachReflectionShared(loaded.coach_reflection_shared !== false);
        
        // Load subscription tier for Individual Coach tier handling
        loadSubscriptionTier();
        
        // Load reflection templates for both coach developers and coaches
        // Coaches need to see their assigned template
        loadReflectionTemplates();
      } catch (err) {
        console.error('Failed to load session:', err);
        toast.error('Failed to load session');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId, navigate, getSession, setCurrentSession]);
  
  // Load subscription tier
  const loadSubscriptionTier = async () => {
    try {
      const result = await fetchLimitsSummary();
      if (result.ok && result.data) {
        setSubscriptionTier(result.data.tier_key);
      }
    } catch (err) {
      console.error('Failed to load subscription tier:', err);
    }
  };

  // Load reflection templates
  const loadReflectionTemplates = async () => {
    setLoadingTemplates(true);
    try {
      // Determine which template ID to use based on who is viewing
      // Individual Coach tier users should use coach templates (they observe themselves)
      let savedTemplateId;
      const useCoachTemplates = isCoachView || isIndividualCoachTier;
      
      if (useCoachTemplates) {
        // Coach OR Individual Coach tier - use the coach reflection template
        savedTemplateId = session?.coachReflectionTemplateId || session?.coach_reflection_template_id;
        
        // Also check for existing coach reflection responses
        if (session?.coachReflection?.responses) {
          setTemplateResponses(session.coachReflection.responses);
        }
      } else {
        // Coach Developer/Club viewing their observer reflection
        savedTemplateId = session?.reflectionTemplateId || session?.reflection_template_id || session?.observerReflection?.templateId;
        
        // Load observer reflection responses
        if (session?.observerReflection?.responses) {
          setTemplateResponses(session.observerReflection.responses);
        }
      }
      
      if (savedTemplateId) {
        // Load the assigned template directly
        setSelectedTemplateId(savedTemplateId);
        await loadTemplateDetails(savedTemplateId);
        
        // Also load the templates list for reference
        const targetRole = useCoachTemplates ? 'coach' : 'coach_educator';
        const templates = await fetchReflectionTemplates(targetRole);
        setReflectionTemplates(templates);
      } else {
        // No assigned template - load appropriate templates based on role and find default
        const targetRole = useCoachTemplates ? 'coach' : 'coach_educator';
        const templates = await fetchReflectionTemplates(targetRole);
        setReflectionTemplates(templates);
        
        const defaultTemplate = templates.find(t => t.is_default);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.template_id);
          await loadTemplateDetails(defaultTemplate.template_id);
        }
      }
    } catch (err) {
      console.error('Failed to load reflection templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTemplateDetails = async (templateId) => {
    if (!templateId) return;
    try {
      const template = await fetchReflectionTemplate(templateId);
      setCurrentTemplate(template);
      
      // Initialize empty responses if not already set
      if (Object.keys(templateResponses).length === 0) {
        const initialResponses = {};
        template.questions?.forEach(q => {
          if (q.question_type === 'checkbox') {
            initialResponses[q.question_id] = [];
          } else {
            initialResponses[q.question_id] = '';
          }
        });
        setTemplateResponses(initialResponses);
      }
    } catch (err) {
      console.error('Failed to load template:', err);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    setTemplateResponses({}); // Reset responses when template changes
    loadTemplateDetails(templateId);
  };

  const handleResponseChange = (questionId, value) => {
    setTemplateResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleCheckboxChange = (questionId, option, checked) => {
    setTemplateResponses(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return { ...prev, [questionId]: current.filter(o => o !== option) };
      }
    });
  };

  const handleSaveTemplateReflection = async () => {
    if (!currentTemplate) return;
    
    // Validate required questions
    for (const q of currentTemplate.questions || []) {
      if (q.required) {
        const response = templateResponses[q.question_id];
        if (!response || (Array.isArray(response) && response.length === 0)) {
          toast.error(`Please answer: ${q.question_text}`);
          return;
        }
      }
    }

    setSavingReflection(true);
    try {
      const reflectionData = {
        templateId: currentTemplate.template_id,
        templateName: currentTemplate.name,
        responses: templateResponses,
        completedAt: new Date().toISOString()
      };
      
      // Save to different fields based on who is reflecting
      // Individual Coach tier saves to coachReflection (they ARE the coach being observed)
      const updated = {
        ...session,
        updatedAt: new Date().toISOString()
      };
      
      if (isCoachView || isIndividualCoachTier) {
        // Coach's reflection on their own session (or Individual Coach self-observation)
        updated.coachReflection = reflectionData;
      } else {
        // Coach Developer's observer reflection
        updated.observerReflection = reflectionData;
      }
      
      await saveSession(updated);
      toast.success('Reflection saved!');
    } catch (err) {
      toast.error('Failed to save reflection');
    } finally {
      setSavingReflection(false);
    }
  };

  // Toggle sharing for observer reflection
  const handleToggleObserverSharing = async (checked) => {
    setTogglingShare(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/observations/${sessionId}/observer-reflection-sharing`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ shared: checked })
      });
      
      if (!response.ok) throw new Error('Failed to update sharing');
      
      setObserverReflectionShared(checked);
      setSession(prev => ({ ...prev, observer_reflection_shared: checked }));
      toast.success(checked ? 'Reflection will be shared with the coach' : 'Reflection is now private');
    } catch (err) {
      console.error('Failed to toggle sharing:', err);
      toast.error('Failed to update sharing setting');
    } finally {
      setTogglingShare(false);
    }
  };

  // Toggle sharing for coach reflection
  const handleToggleCoachSharing = async (checked) => {
    setTogglingShare(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/observations/${sessionId}/coach-reflection-sharing`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ shared: checked })
      });
      
      if (!response.ok) throw new Error('Failed to update sharing');
      
      setCoachReflectionShared(checked);
      setSession(prev => ({ ...prev, coach_reflection_shared: checked }));
      toast.success(checked ? `Reflection will be shared with ${session.observer_name || 'coach developers'}` : 'Reflection is now private');
    } catch (err) {
      console.error('Failed to toggle sharing:', err);
      toast.error('Failed to update sharing setting');
    } finally {
      setTogglingShare(false);
    }
  };

  const saveSession = async (updated) => {
    setSession(updated);
    setCurrentSession(updated);
    await cloudSaveSession(updated);
  };

  // Check if an event occurred during ball rolling or stopped
  const getEventBallState = (eventTime) => {
    const segments = getBallRollingSegments();
    for (const segment of segments) {
      const segmentStartMs = segment.start || 0;
      const segmentEndMs = segmentStartMs + (segment.duration || 0);
      if (eventTime >= segmentStartMs && eventTime < segmentEndMs) {
        return segment.rolling ? 'rolling' : 'stopped';
      }
    }
    return 'stopped'; // Default to stopped if not in any segment
  };

  // Convert ball rolling log (state change timestamps) into segments with start/duration
  // The log format is: [{ timestamp: '...', state: true/false, partId: '...' }, ...]
  // We need to convert to: [{ start: ms, duration: ms, rolling: true/false }, ...]
  const getBallRollingSegments = () => {
    if (!session) return [];
    const log = session.ballRollingLog || [];
    if (log.length === 0) return [];
    
    const sessionStartMs = session.startTime ? new Date(session.startTime).getTime() : 0;
    const sessionDurationMs = (session.totalDuration || session.total_duration || 0) * 1000;
    
    // Check if log is already in segment format (has 'start' and 'duration')
    if (log[0].start !== undefined && log[0].duration !== undefined) {
      return log;
    }
    
    // Convert state change log to segments
    const segments = [];
    let currentState = false; // Default to stopped
    let currentStartMs = 0;
    
    // Sort log by timestamp
    const sortedLog = [...log].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    for (let i = 0; i < sortedLog.length; i++) {
      const entry = sortedLog[i];
      const entryMs = new Date(entry.timestamp).getTime() - sessionStartMs;
      const newState = entry.state === true || entry.state === 'rolling';
      
      // If state changes, close the previous segment and start a new one
      if (i === 0) {
        // First entry - create initial segment from start to first entry
        if (entryMs > 0) {
          segments.push({
            start: 0,
            duration: entryMs,
            rolling: false // Assume stopped before first log entry
          });
        }
        currentState = newState;
        currentStartMs = entryMs;
      } else if (newState !== currentState) {
        // State changed - close previous segment
        segments.push({
          start: currentStartMs,
          duration: entryMs - currentStartMs,
          rolling: currentState
        });
        currentState = newState;
        currentStartMs = entryMs;
      }
    }
    
    // Close the last segment (from last state change to end of session)
    if (sessionDurationMs > currentStartMs) {
      segments.push({
        start: currentStartMs,
        duration: sessionDurationMs - currentStartMs,
        rolling: currentState
      });
    }
    
    return segments;
  };

  const getFilteredEvents = () => {
    if (!session) return [];
    let events = session.events || [];
    
    // Filter by viewMode (part selection)
    if (viewMode !== 'whole') {
      events = events.filter(e => e.sessionPartId === viewMode);
    }
    
    // Filter by ball state if filter is active
    if (ballStateFilter) {
      events = events.filter(event => {
        const eventTime = event.relativeTimestamp || 0;
        const ballState = getEventBallState(eventTime);
        return ballState === ballStateFilter;
      });
    }
    
    return events;
  };

  // Get notes filtered by the selected part
  const getFilteredNotes = () => {
    if (!session) return [];
    const notes = session.observerNotes || [];
    if (viewMode === 'whole') return notes;
    
    // Filter notes by part - match by partId or by timestamp within part's time range
    const selectedPart = (session.sessionParts || []).find(p => p.id === viewMode);
    if (!selectedPart) return notes;
    
    const sessionStartMs = session.startTime ? new Date(session.startTime).getTime() : 0;
    const partStartMs = selectedPart.startTime ? new Date(selectedPart.startTime).getTime() : 0;
    const partEndMs = selectedPart.endTime ? new Date(selectedPart.endTime).getTime() : 0;
    
    return notes.filter(note => {
      // If note has partId, use that
      if (note.partId) {
        return note.partId === viewMode;
      }
      // Otherwise filter by timestamp
      const noteTime = note.timestamp ? new Date(note.timestamp).getTime() : 0;
      return noteTime >= partStartMs && noteTime < partEndMs;
    });
  };

  // Get timeline range based on viewMode (whole session or specific part)
  const getTimelineRange = () => {
    if (!session) return { startMs: 0, endMs: 0, durationMs: 1 };
    
    const sessionStartMs = session.startTime ? new Date(session.startTime).getTime() : 0;
    
    if (viewMode === 'whole') {
      // Use full session duration
      const sessionDurationSec = session.totalDuration || session.total_duration || 0;
      const events = session.events || [];
      const maxEventTime = Math.max(...events.map(e => e.relativeTimestamp || 0), 0);
      const durationMs = Math.max(sessionDurationSec * 1000, maxEventTime) || 1;
      return { startMs: 0, endMs: durationMs, durationMs };
    }
    
    // Use selected part's time range
    const selectedPart = (session.sessionParts || []).find(p => p.id === viewMode);
    if (!selectedPart || !selectedPart.startTime || !selectedPart.endTime) {
      // Fallback to full session
      const sessionDurationSec = session.totalDuration || session.total_duration || 0;
      return { startMs: 0, endMs: sessionDurationSec * 1000, durationMs: sessionDurationSec * 1000 || 1 };
    }
    
    const partStartMs = new Date(selectedPart.startTime).getTime() - sessionStartMs;
    const partEndMs = new Date(selectedPart.endTime).getTime() - sessionStartMs;
    const durationMs = partEndMs - partStartMs;
    
    return { startMs: partStartMs, endMs: partEndMs, durationMs: durationMs || 1 };
  };

  // Get unique session parts used in this session
  const getSessionParts = () => {
    if (!session) return [];
    return session.sessionParts || [];
  };

  // Get session parts that actually have data (events, ball rolling time, or ball stopped time)
  const getActiveSessionParts = () => {
    if (!session) return [];
    const parts = session.sessionParts || [];
    const events = session.events || [];
    
    return parts.filter(part => {
      // Check if part is explicitly marked as used
      const isUsed = part.used === true;
      // Check if part has timestamps (indicating it was active during session)
      const hasTimestamps = !!part.startTime && !!part.endTime;
      // Check if part has any events
      const hasEvents = events.some(e => e.sessionPartId === part.id);
      // Check if part has ball rolling or stopped time
      const hasBallTime = (part.ballRollingTime || 0) > 0 || (part.ballNotRollingTime || 0) > 0;
      return isUsed || hasTimestamps || hasEvents || hasBallTime;
    });
  };

  const getStats = () => {
    const events = getFilteredEvents();
    const eventCounts = countBy(events, 'eventTypeId');
    
    // Calculate descriptor counts (with defensive checks)
    const desc1Counts = {};
    const desc2Counts = {};
    events.forEach(e => {
      if (Array.isArray(e.descriptors1)) {
        e.descriptors1.forEach(d => {
          desc1Counts[d] = (desc1Counts[d] || 0) + 1;
        });
      }
      if (Array.isArray(e.descriptors2)) {
        e.descriptors2.forEach(d => {
          desc2Counts[d] = (desc2Counts[d] || 0) + 1;
        });
      }
    });
    
    // Ball rolling stats
    let ballRollingTime, ballNotRollingTime, totalTime;
    if (viewMode === 'whole') {
      // For whole session, SUM ball rolling times from all active parts
      // This is the most accurate representation of the entire session
      const parts = session.sessionParts || [];
      const activeParts = parts.filter(p => 
        p.used === true || 
        p.startTime || 
        (p.ballRollingTime || 0) > 0 || 
        (p.ballNotRollingTime || 0) > 0
      );
      
      // Sum ball rolling times from all parts
      ballRollingTime = activeParts.reduce((sum, p) => sum + (p.ballRollingTime || 0), 0);
      ballNotRollingTime = activeParts.reduce((sum, p) => sum + (p.ballNotRollingTime || 0), 0);
      
      // Use sum of ball times
      totalTime = ballRollingTime + ballNotRollingTime;
    } else {
      const part = (session.sessionParts || []).find(p => p.id === viewMode);
      ballRollingTime = part?.ballRollingTime || 0;
      ballNotRollingTime = part?.ballNotRollingTime || 0;
      totalTime = ballRollingTime + ballNotRollingTime;
    }
    
    const ballRollingPct = calcPercentage(ballRollingTime, totalTime);
    
    return {
      eventCounts,
      desc1Counts,
      desc2Counts,
      ballRollingTime,
      ballNotRollingTime,
      ballRollingPct,
      totalTime,
      totalEvents: events.length
    };
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event.id);
    setEditNote(event.note || '');
  };

  const handleSaveEdit = (eventId) => {
    const updated = {
      ...session,
      events: (session.events || []).map(e => 
        e.id === eventId ? { ...e, note: editNote } : e
      )
    };
    saveSession(updated);
    setEditingEvent(null);
    setEditNote('');
    toast.success('Intervention updated');
  };

  const handleDeleteEvent = (eventId) => {
    const updated = {
      ...session,
      events: (session.events || []).filter(e => e.id !== eventId)
    };
    saveSession(updated);
    toast.success('Intervention deleted');
  };

  const handleAddReflection = (type) => {
    const text = type === 'observer' ? newReflection : newCoachReflection;
    if (!text.trim()) return;
    
    const reflection = {
      id: generateId('reflection'),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      author: type
    };
    
    const key = type === 'observer' ? 'observerReflections' : 'coachReflections';
    const updated = {
      ...session,
      [key]: [...(session[key] || []), reflection]
    };
    saveSession(updated);
    
    if (type === 'observer') {
      setNewReflection('');
    } else {
      setNewCoachReflection('');
    }
    toast.success('Reflection added');
  };

  const handleDeleteReflection = (type, reflectionId) => {
    const key = type === 'observer' ? 'observerReflections' : 'coachReflections';
    const updated = {
      ...session,
      [key]: (session[key] || []).filter(r => r.id !== reflectionId)
    };
    saveSession(updated);
    toast.success('Reflection removed');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${API}/upload`, formData, {
        ...getAxiosConfig(),
        headers: { 
          'Content-Type': 'multipart/form-data',
          ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
        }
      });
      
      const attachment = response.data;
      const updated = {
        ...session,
        attachments: [...(session.attachments || []), attachment]
      };
      saveSession(updated);
      toast.success('File uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await axios.delete(`${API}/files/${attachmentId}`, getAxiosConfig());
    } catch (err) {
      console.warn('File may already be deleted');
    }
    
    const updated = {
      ...session,
      attachments: (session.attachments || []).filter(a => a.id !== attachmentId)
    };
    saveSession(updated);
    toast.success('Attachment removed');
  };

  const handleGenerateSummary = async () => {
    if ((session.events || []).length === 0) {
      toast.error('No interventions to summarize');
      return;
    }
    
    setIsGeneratingSummary(true);
    try {
      const stats = getStats();
      
      // Fetch coach targets if session has a coach
      let coachTargets = null;
      if (session.coachId) {
        try {
          const coachResponse = await axios.get(`${API}/coaches/${session.coachId}`, getAxiosConfig());
          const targets = coachResponse.data?.targets || [];
          coachTargets = targets
            .filter(t => t.status === 'active')
            .map(t => t.text);
        } catch (err) {
          console.warn('Could not fetch coach targets:', err);
        }
      }
      
      // Prepare intervention breakdown
      const interventionTypes = session.interventionTypes || session.eventTypes || [];
      const eventBreakdown = {};
      interventionTypes.forEach(et => {
        eventBreakdown[et.name] = stats.eventCounts[et.id] || 0;
      });
      
      // Prepare descriptor breakdowns
      const desc1Breakdown = {};
      if (session.descriptorGroup1?.descriptors) {
        session.descriptorGroup1.descriptors.forEach(d => {
          desc1Breakdown[d.name] = stats.desc1Counts[d.id] || 0;
        });
      }
      
      const desc2Breakdown = {};
      if (session.descriptorGroup2?.descriptors) {
        session.descriptorGroup2.descriptors.forEach(d => {
          desc2Breakdown[d.name] = stats.desc2Counts[d.id] || 0;
        });
      }
      
      // Prepare session parts
      const sessionPartsData = (session.sessionParts || []).map(part => {
        const partEvents = (session.events || []).filter(e => e.sessionPartId === part.id);
        const partTotal = (part.ballRollingTime || 0) + (part.ballNotRollingTime || 0);
        return {
          name: part.name,
          events: partEvents.length,
          ballRollingPct: calcPercentage(part.ballRollingTime, partTotal)
        };
      });
      
      const response = await axios.post(`${API}/generate-summary`, {
        session_name: session.name,
        total_duration: session.totalDuration,
        total_events: (session.events || []).length,
        ball_rolling_time: Math.round(session.ballRollingTime || 0),
        ball_not_rolling_time: Math.round(session.ballNotRollingTime || 0),
        event_breakdown: eventBreakdown,
        descriptor1_name: session.descriptorGroup1?.name || 'Descriptor 1',
        descriptor1_breakdown: desc1Breakdown,
        descriptor2_name: session.descriptorGroup2?.name || 'Descriptor 2',
        descriptor2_breakdown: desc2Breakdown,
        session_parts: sessionPartsData,
        user_notes: (session.observerReflections || []).map(r => r.text).join('\n'),
        observation_context: session.observationContext || 'training',
        // Coach context - use session data and fetched targets
        coach_name: session.coachName || null,
        coach_targets: coachTargets,
        previous_sessions_summary: null
      }, getAxiosConfig());
      
      const updated = {
        ...session,
        aiSummary: response.data.summary
      };
      saveSession(updated);
      setAiSummaryExpanded(true);
      toast.success('Summary generated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleEditSummary = () => {
    setEditedSummary(session.aiSummary || '');
    setIsEditingSummary(true);
  };

  const handleSaveSummary = () => {
    const updated = {
      ...session,
      aiSummary: editedSummary
    };
    saveSession(updated);
    setIsEditingSummary(false);
    toast.success('Summary updated');
  };

  const handleCancelEditSummary = () => {
    setIsEditingSummary(false);
    setEditedSummary('');
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF(session);
      toast.success('PDF exported');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(session);
      toast.success('CSV exported');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const stats = getStats();
  const events = getFilteredEvents();

  // Get intervention/event types (handle both naming conventions)
  const interventionTypesList = session.interventionTypes || session.eventTypes || [];

  // Prepare chart data
  const eventChartData = interventionTypesList.map(et => ({
    name: et.name,
    count: stats.eventCounts[et.id] || 0
  }));

  const ballRollingData = [
    { name: 'Ball Rolling', value: stats.ballRollingTime, color: '#F97316' },
    { name: 'Ball Stopped', value: stats.ballNotRollingTime, color: '#64748B' }
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              {session.coachName ? (
                <>
                  <h1 className="text-base sm:text-xl font-bold text-slate-900 font-['Manrope'] truncate">{session.coachName}</h1>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
                    <span className="truncate max-w-[100px] sm:max-w-none">{session.name}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">{formatDateTime(session.createdAt)}</span>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-base sm:text-xl font-bold text-slate-900 font-['Manrope'] truncate">{session.name}</h1>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                    <span>{formatDateTime(session.createdAt)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            {/* Edit Session Button - Only for Coach Developers on completed sessions */}
            {canEditSession && !isEditMode && (
              <Button 
                variant="outline" 
                onClick={() => setIsEditMode(true)} 
                data-testid="edit-session-btn" 
                size="sm" 
                className="px-2 sm:px-3 border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                <Pencil className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit Session</span>
              </Button>
            )}
            <Button variant="outline" onClick={handleExportCSV} data-testid="export-csv-btn" size="sm" className="px-2 sm:px-3">
              <Table className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button onClick={handleExportPDF} data-testid="export-pdf-btn" size="sm" className="px-2 sm:px-3">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">PDF Report</span>
            </Button>
          </div>
        </div>
        
        {/* Last Edited Indicator */}
        {session.lastEditedAt && (
          <div className="max-w-6xl mx-auto px-3 sm:px-4 pb-2">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last edited: {formatDateTime(session.lastEditedAt)}
              {session.lastEditedByName && ` by ${session.lastEditedByName}`}
            </p>
          </div>
        )}
      </header>

      {/* View Toggle - Only show parts that have data */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setViewMode('whole')}
              className={cn(
                "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-h-[36px]",
                viewMode === 'whole'
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
              data-testid="view-whole-btn"
            >
              Whole Session
            </button>
            {getActiveSessionParts().map((part) => (
              <button
                key={part.id}
                onClick={() => setViewMode(part.id)}
                className={cn(
                  "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-h-[36px]",
                  viewMode === part.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                data-testid={`view-part-${part.id}`}
              >
                {part.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Mode - Show Timeline Editor */}
      {isEditMode && (
        <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <SessionEditTimeline
            session={session}
            interventionTypes={session.interventionTypes || session.eventTypes || []}
            descriptorGroup1={session.descriptorGroup1}
            descriptorGroup2={session.descriptorGroup2}
            sessionParts={session.sessionParts || []}
            onSave={async (editedSession) => {
              // Save to cloud
              await cloudSaveSession(editedSession);
              // Update local state
              setSession(editedSession);
              setIsEditMode(false);
              toast.success('Session updated successfully');
            }}
            onCancel={() => setIsEditMode(false)}
          />
        </main>
      )}

      {/* Main Content - Hide when in edit mode */}
      {!isEditMode && (
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6" ref={swipeRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3 h-auto">
            <TabsTrigger value="summary" data-testid="tab-summary" className="text-xs sm:text-sm py-2">Summary</TabsTrigger>
            <TabsTrigger value="reflections" data-testid="tab-reflections" className="text-xs sm:text-sm py-2">Reflections</TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis" className="text-xs sm:text-sm py-2">Analysis</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            {/* Session Summary Display */}
            {session.aiSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Session Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-slate prose-sm max-w-none">
                    {session.aiSummary.split('\n').map((paragraph, i) => (
                      <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold font-mono text-slate-900" data-testid="total-duration">
                    {formatTime(stats.totalTime)}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Total Duration</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-slate-900" data-testid="total-events">
                    {stats.totalEvents}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">Total Events</div>
                </CardContent>
              </Card>
              {session.includeBallRolling !== false && (
                <>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Circle className="w-5 h-5 text-orange-500 fill-current" />
                        <span className="text-3xl font-bold text-slate-900" data-testid="ball-rolling-pct">
                          {stats.ballRollingPct}%
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">Ball Rolling</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Square className="w-5 h-5 text-slate-500" />
                        <span className="text-3xl font-bold text-slate-900">
                          {100 - stats.ballRollingPct}%
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">Ball Stopped</div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Ball Rolling Progress - Only show if ball rolling is enabled */}
            {session.includeBallRolling !== false && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope']">Ball Rolling Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600 font-medium">
                        Rolling: {formatTime(stats.ballRollingTime)}
                      </span>
                      <span className="text-slate-500">
                        Stopped: {formatTime(stats.ballNotRollingTime)}
                      </span>
                    </div>
                    <Progress value={stats.ballRollingPct} className="h-3" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Intervention Breakdown - renamed from Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-['Manrope']">Coach Interventions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(session.interventionTypes || session.eventTypes || []).map((et) => {
                    const count = stats.eventCounts[et.id] || 0;
                    const pct = calcPercentage(count, stats.totalEvents);
                    return (
                      <div key={et.id} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded bg-yellow-400" />
                        <span className="flex-1 font-medium text-slate-700">{et.name}</span>
                        <span className="text-slate-900 font-semibold">{count}</span>
                        <Badge variant="secondary">{pct}%</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Descriptor Breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              {session.descriptorGroup1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope'] flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-sky-400" />
                    {session.descriptorGroup1.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(session.descriptorGroup1.descriptors || []).map((desc) => {
                      const count = stats.desc1Counts[desc.id] || 0;
                      return (
                        <div key={desc.id} className="flex items-center justify-between">
                          <span className="text-slate-600">{desc.name}</span>
                          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}

              {session.descriptorGroup2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-['Manrope'] flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-400" />
                    {session.descriptorGroup2.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(session.descriptorGroup2.descriptors || []).map((desc) => {
                      const count = stats.desc2Counts[desc.id] || 0;
                      return (
                        <div key={desc.id} className="flex items-center justify-between">
                          <span className="text-slate-600">{desc.name}</span>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </TabsContent>

          {/* Reflections Tab - Restructured */}
          <TabsContent value="reflections" className="space-y-6">
            {/* Observer Notes Card - Visible to coach developers AND Individual Coach tier (they ARE the observer) */}
            {(!isCoachView || isIndividualCoachTier) && (() => {
              const filteredNotes = getFilteredNotes();
              return filteredNotes.length > 0 && (
                <Collapsible open={observerNotesExpanded} onOpenChange={setObserverNotesExpanded}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="font-['Manrope'] flex items-center gap-2">
                            <StickyNote className="w-5 h-5 text-purple-600" />
                            Observer Notes
                            <Badge variant="secondary" className="ml-2">
                              {filteredNotes.length}
                            </Badge>
                          </CardTitle>
                          {observerNotesExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <CardDescription>
                          Private notes taken during the observation session.
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-3 pt-0">
                        {filteredNotes.map(note => {
                          const part = (session.sessionParts || []).find(p => p.id === note.partId);
                          // Calculate relative time from session start
                          const sessionStartTime = session.startTime ? new Date(session.startTime).getTime() : 0;
                          const noteTime = note.timestamp ? new Date(note.timestamp).getTime() : 0;
                          const noteRelativeMs = noteTime - sessionStartTime;
                          
                          return (
                            <div key={note.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                              <p className="text-slate-700">{note.text}</p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                <span className="text-purple-600 font-medium">
                                  {noteRelativeMs > 0 ? formatRelativeTime(noteRelativeMs) : '00:00'}
                                </span>
                                <span className="text-slate-400">into session</span>
                                {part && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">{part.name}</Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })()}

            {/* Observer Reflection Template Form - Only for coach developers to edit */}
            {canEditObserverContent && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                    Observer Reflection
                  </CardTitle>
                  <CardDescription>
                    Complete your structured reflection using a template.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Selector */}
                  <div className="space-y-2">
                    <Label>Reflection Template</Label>
                    <Select 
                      value={selectedTemplateId} 
                      onValueChange={handleTemplateChange}
                      disabled={loadingTemplates}
                    >
                      <SelectTrigger data-testid="reflection-template-select">
                        <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Select a template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {reflectionTemplates.map(t => (
                          <SelectItem key={t.template_id} value={t.template_id}>
                            {t.name} {t.is_default && <span className="text-blue-600">(Default)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {reflectionTemplates.length === 0 && !loadingTemplates && (
                      <p className="text-sm text-slate-500">
                        No reflection templates available. Create one in Templates.
                      </p>
                    )}
                  </div>

                  {/* Template Questions */}
                  {currentTemplate && (
                    <div className="space-y-6 mt-4 pt-4 border-t">
                      {currentTemplate.questions?.map((question, qIndex) => (
                        <div key={question.question_id} className="space-y-2">
                          <Label className="flex items-center gap-1">
                            {question.question_text}
                            {question.required && <span className="text-red-500">*</span>}
                          </Label>

                          {/* Text Input */}
                          {question.question_type === 'text' && (
                            <div className="flex gap-2">
                              <Textarea
                                value={templateResponses[question.question_id] || ''}
                                onChange={(e) => handleResponseChange(question.question_id, e.target.value)}
                                placeholder="Enter your response..."
                                className="min-h-[100px] flex-1"
                                data-testid={`reflection-q-${qIndex}`}
                              />
                              <SpeechToTextButton
                                onTranscribe={(text) => handleResponseChange(
                                  question.question_id, 
                                  (templateResponses[question.question_id] || '') + (templateResponses[question.question_id] ? ' ' : '') + text
                                )}
                                className="self-start mt-1"
                              />
                            </div>
                          )}

                          {/* Scale Input */}
                          {question.question_type === 'scale' && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>{question.scale_min_label || question.scale_min}</span>
                                <span>{question.scale_max_label || question.scale_max}</span>
                              </div>
                              <div className="flex gap-2">
                                {Array.from(
                                  { length: (question.scale_max || 5) - (question.scale_min || 1) + 1 },
                                  (_, i) => (question.scale_min || 1) + i
                                ).map(value => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleResponseChange(question.question_id, value)}
                                    className={cn(
                                      "w-10 h-10 rounded-lg font-medium transition-all",
                                      templateResponses[question.question_id] === value
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                    data-testid={`reflection-q-${qIndex}-scale-${value}`}
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dropdown Input */}
                          {question.question_type === 'dropdown' && (
                            <Select
                              value={templateResponses[question.question_id] || ''}
                              onValueChange={(value) => handleResponseChange(question.question_id, value)}
                            >
                              <SelectTrigger data-testid={`reflection-q-${qIndex}`}>
                                <SelectValue placeholder="Select an option" />
                              </SelectTrigger>
                              <SelectContent>
                                {(question.options || []).map((option, oIndex) => (
                                  <SelectItem key={oIndex} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Checkbox Input */}
                          {question.question_type === 'checkbox' && (
                            <div className="space-y-2">
                              {(question.options || []).map((option, oIndex) => (
                                <div key={oIndex} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${question.question_id}-${oIndex}`}
                                    checked={(templateResponses[question.question_id] || []).includes(option)}
                                    onCheckedChange={(checked) => handleCheckboxChange(question.question_id, option, checked)}
                                    data-testid={`reflection-q-${qIndex}-cb-${oIndex}`}
                                  />
                                  <Label htmlFor={`${question.question_id}-${oIndex}`} className="font-normal">
                                    {option}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Save Button */}
                      <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <Button 
                          onClick={handleSaveTemplateReflection}
                          disabled={savingReflection}
                          className="w-full sm:w-auto"
                          data-testid="save-reflection-btn"
                        >
                          {savingReflection ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Save Reflection
                        </Button>
                        
                        {/* Sharing toggle for observer */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                          <div className="flex items-center gap-2">
                            {observerReflectionShared ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-slate-400" />
                            )}
                            <Label htmlFor="share-observer-reflection" className="text-sm font-medium cursor-pointer">
                              Share with {session.coach_name || 'Coach'}
                            </Label>
                          </div>
                          <Switch
                            id="share-observer-reflection"
                            checked={observerReflectionShared}
                            onCheckedChange={handleToggleObserverSharing}
                            disabled={togglingShare}
                            data-testid="toggle-observer-sharing"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show saved reflection if exists */}
                  {session.observerReflection?.completedAt && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-700">Reflection completed</span>
                          <span className="text-sm text-green-600">
                            {formatDateTime(session.observerReflection.completedAt)}
                          </span>
                        </div>
                        {/* Sharing toggle when reflection is already saved */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {observerReflectionShared ? 'Shared' : 'Private'}
                          </span>
                          <Switch
                            checked={observerReflectionShared}
                            onCheckedChange={handleToggleObserverSharing}
                            disabled={togglingShare}
                            data-testid="toggle-observer-sharing-saved"
                          />
                        </div>
                      </div>
                      {session.observerReflection.templateName && (
                        <p className="text-sm text-slate-600">
                          Template: {session.observerReflection.templateName}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Free-form Observer Reflections - Only visible to coach developers */}
            {canEditObserverContent && (
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Additional Notes
                </CardTitle>
                <CardDescription>
                  Add free-form observations and notes about this session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing reflections */}
                {(session.observerReflections || []).length > 0 && (
                  <div className="space-y-3 mb-4">
                    {session.observerReflections.map(r => (
                      <div key={r.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-700">{r.text}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatDateTime(r.timestamp)}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-slate-400 hover:text-red-600"
                            onClick={() => handleDeleteReflection('observer', r.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add new reflection */}
                <div className="flex gap-2">
                  <Textarea
                    value={newReflection}
                    onChange={(e) => setNewReflection(e.target.value)}
                    placeholder="Add a note..."
                    className="min-h-[80px] resize-y flex-1"
                    data-testid="observer-reflection-textarea"
                  />
                  <SpeechToTextButton
                    onTranscribe={(text) => setNewReflection(prev => prev ? `${prev} ${text}` : text)}
                    className="self-start mt-1"
                  />
                </div>
                <Button 
                  onClick={() => handleAddReflection('observer')} 
                  variant="outline" 
                  disabled={!newReflection.trim()}
                  data-testid="add-observer-reflection-btn"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>
            )}

            {/* Coach's Own Reflection Form - Visible to coaches AND Individual Coach tier */}
            {(isCoachView || isIndividualCoachTier) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-['Manrope'] flex items-center gap-2">
                      <User className="w-5 h-5 text-green-600" />
                      My Reflection
                    </CardTitle>
                    <CardDescription>
                      {currentTemplate 
                        ? `Complete your reflection using the "${currentTemplate.name}" template.`
                        : 'Add your reflections on this session.'
                      }
                    </CardDescription>
                  </div>
                  {/* Sharing toggle - hidden for Individual Coach tier (no one to share with) */}
                  {!isIndividualCoachTier && (session.coachReflection || session.coachReflections?.length > 0) && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                      <span className="text-xs text-slate-500">
                        {coachReflectionShared ? 'Shared' : 'Private'}
                      </span>
                      <Switch
                        checked={coachReflectionShared}
                        onCheckedChange={handleToggleCoachSharing}
                        disabled={togglingShare}
                        data-testid="toggle-coach-sharing"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show completed template reflection if it exists */}
                {session.coachReflection?.responses && (
                  <div className="p-4 bg-green-50 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <Check className="w-4 h-4" />
                      Reflection completed
                      {session.coachReflection.templateName && (
                        <Badge variant="outline" className="text-xs">
                          {session.coachReflection.templateName}
                        </Badge>
                      )}
                    </div>
                    {/* Display saved template responses */}
                    {currentTemplate?.questions?.map(q => {
                      const response = session.coachReflection.responses[q.question_id];
                      if (!response || (Array.isArray(response) && response.length === 0)) return null;
                      return (
                        <div key={q.question_id} className="space-y-1">
                          <p className="text-xs font-medium text-slate-600">{q.question_text}</p>
                          <p className="text-slate-800">
                            {Array.isArray(response) ? response.join(', ') : response}
                          </p>
                        </div>
                      );
                    })}
                    <p className="text-xs text-slate-500">
                      Completed: {formatDateTime(session.coachReflection.completedAt)}
                    </p>
                  </div>
                )}

                {/* Show template form if template exists and reflection not yet completed */}
                {currentTemplate && !session.coachReflection?.responses && (
                  <div className="space-y-6">
                    {currentTemplate.questions?.map((question) => (
                      <div key={question.question_id} className="space-y-2">
                        <Label className="flex items-center gap-1">
                          {question.question_text}
                          {question.required && <span className="text-red-500">*</span>}
                        </Label>

                        {/* Text Input */}
                        {question.question_type === 'text' && (
                          <div className="flex gap-2">
                            <Textarea
                              value={templateResponses[question.question_id] || ''}
                              onChange={(e) => handleResponseChange(question.question_id, e.target.value)}
                              placeholder="Enter your response..."
                              className="min-h-[100px] flex-1"
                              data-testid={`coach-reflection-q-${question.question_id}`}
                            />
                            <SpeechToTextButton
                              onTranscribe={(text) => handleResponseChange(
                                question.question_id, 
                                (templateResponses[question.question_id] || '') + (templateResponses[question.question_id] ? ' ' : '') + text
                              )}
                              className="self-start mt-1"
                            />
                          </div>
                        )}

                        {/* Radio/Single Select */}
                        {question.question_type === 'radio' && (
                          <div className="space-y-2">
                            {question.options?.map((option) => (
                              <label 
                                key={option} 
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  templateResponses[question.question_id] === option
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={question.question_id}
                                  checked={templateResponses[question.question_id] === option}
                                  onChange={() => handleResponseChange(question.question_id, option)}
                                  className="w-4 h-4"
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Scale/Rating */}
                        {question.question_type === 'scale' && (
                          <div className="flex gap-2 flex-wrap">
                            {Array.from({ length: question.scale_max || 5 }, (_, i) => i + 1).map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => handleResponseChange(question.question_id, n.toString())}
                                className={`w-10 h-10 rounded-full border-2 font-medium transition-colors ${
                                  templateResponses[question.question_id] === n.toString()
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'border-slate-300 hover:border-blue-400'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Checkbox/Multi Select */}
                        {question.question_type === 'checkbox' && (
                          <div className="space-y-2">
                            {question.options?.map((option) => (
                              <label 
                                key={option} 
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  (templateResponses[question.question_id] || []).includes(option)
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={(templateResponses[question.question_id] || []).includes(option)}
                                  onChange={(e) => handleCheckboxChange(question.question_id, option, e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="share-coach-reflection-template"
                          checked={coachReflectionShared}
                          onCheckedChange={handleToggleCoachSharing}
                          disabled={togglingShare}
                        />
                        <Label htmlFor="share-coach-reflection-template" className="text-sm cursor-pointer">
                          Share with {session.observer_name || 'Coach Developer'}
                        </Label>
                      </div>
                      <Button 
                        onClick={handleSaveTemplateReflection}
                        disabled={savingReflection}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="save-coach-reflection-btn"
                      >
                        {savingReflection ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Save Reflection
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show simple textarea only if no template assigned */}
                {!currentTemplate && !session.coachReflection?.responses && (
                  <>
                    {/* Existing simple reflections */}
                    {(session.coachReflections || []).length > 0 && (
                      <div className="space-y-3 mb-4">
                        {session.coachReflections.map(r => (
                          <div key={r.id} className="p-4 bg-green-50 rounded-lg space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-3 flex-1">
                                {r.rating && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Self Assessment</p>
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map(n => (
                                        <div 
                                          key={n}
                                          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                                            n <= r.rating 
                                              ? 'bg-blue-500 text-white' 
                                              : 'bg-slate-200 text-slate-400'
                                          }`}
                                        >
                                          {n}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {r.text && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Reflection</p>
                                    <p className="text-slate-700">{r.text}</p>
                                  </div>
                                )}
                                <p className="text-xs text-slate-400 mt-2">{formatDateTime(r.timestamp)}</p>
                              </div>
                              {!r.source && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-slate-400 hover:text-red-600"
                                  onClick={() => handleDeleteReflection('coach', r.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Simple textarea for adding reflections */}
                    <div className="flex gap-2">
                      <Textarea
                        value={newCoachReflection}
                        onChange={(e) => setNewCoachReflection(e.target.value)}
                        placeholder="Add your reflection..."
                        className="min-h-[80px] resize-y flex-1"
                        data-testid="coach-reflection-textarea"
                      />
                      <SpeechToTextButton
                        onTranscribe={(text) => setNewCoachReflection(prev => prev ? `${prev} ${text}` : text)}
                        className="self-start mt-1"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <Button 
                        onClick={() => handleAddReflection('coach')} 
                        variant="outline"
                        disabled={!newCoachReflection.trim()}
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Add Reflection
                      </Button>
                      
                      {(session.coachReflections || []).length === 0 && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                          <div className="flex items-center gap-2">
                            {coachReflectionShared ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-slate-400" />
                            )}
                            <Label htmlFor="share-coach-reflection" className="text-sm font-medium cursor-pointer">
                              Share with {session.observer_name || 'Coach Developers'}
                            </Label>
                          </div>
                          <Switch
                            id="share-coach-reflection"
                            checked={coachReflectionShared}
                            onCheckedChange={handleToggleCoachSharing}
                            disabled={togglingShare}
                            data-testid="toggle-coach-sharing-new"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            )}

            {/* ===== SHARED REFLECTIONS SECTION ===== */}
            {/* Hide for Individual Coach tier - they observe themselves, no "other" reflection to share */}
            {!isIndividualCoachTier && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-600" />
                  {isCoachView 
                    ? `${session.observer_name || 'Coach Developer'}'s Reflections` 
                    : `${session.coach_name || 'Coach'}'s Reflections`
                  }
                </CardTitle>
                <CardDescription>
                  {isCoachView 
                    ? 'View the observer\'s shared reflection on this session.'
                    : 'View the coach\'s shared reflection on this session.'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Determine what to show based on other_reflection_status */}
                {session.other_reflection_status === 'not_completed' && (
                  <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-slate-600 font-medium">Reflection not yet completed</p>
                      <p className="text-sm text-slate-500">
                        {isCoachView 
                          ? `${session.observer_name || 'The coach developer'} hasn't completed their reflection yet.`
                          : `${session.coach_name || 'The coach'} hasn't completed their reflection yet.`
                        }
                      </p>
                    </div>
                  </div>
                )}
                
                {session.other_reflection_status === 'not_shared' && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-amber-700 font-medium">Reflection not shared with you</p>
                      <p className="text-sm text-amber-600">
                        {isCoachView 
                          ? `${session.observer_name || 'The coach developer'} has completed their reflection but hasn't shared it with you.`
                          : `${session.coach_name || 'The coach'} has completed their reflection but hasn't shared it with you.`
                        }
                      </p>
                    </div>
                  </div>
                )}
                
                {session.other_reflection_status === 'shared' && session.other_reflection && (
                  <div className="space-y-4">
                    {/* Structured reflection display */}
                    {session.other_reflection.responses && (
                      <div className="space-y-4">
                        {session.other_reflection.templateName && (
                          <div className="text-sm text-blue-600 font-medium">
                            Template: {session.other_reflection.templateName}
                          </div>
                        )}
                        {Object.entries(session.other_reflection.responses).map(([questionId, response], idx) => (
                          <div key={questionId} className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-slate-500 mb-1">Response {idx + 1}</p>
                            <p className="text-slate-700">
                              {Array.isArray(response) ? response.join(', ') : String(response)}
                            </p>
                          </div>
                        ))}
                        {session.other_reflection.completedAt && (
                          <p className="text-xs text-slate-400">
                            Completed: {formatDateTime(session.other_reflection.completedAt)}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Free-form reflections display */}
                    {session.other_reflection.freeFormReflections && (
                      <div className="space-y-3">
                        {session.other_reflection.freeFormReflections.map((r, idx) => (
                          <div key={r.id || idx} className="p-4 bg-white rounded-lg border space-y-2">
                            {r.rating && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Self Assessment</p>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map(n => (
                                    <div 
                                      key={n}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                        n <= r.rating 
                                          ? 'bg-blue-500 text-white' 
                                          : 'bg-slate-200 text-slate-400'
                                      }`}
                                    >
                                      {n}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {r.text && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Reflection</p>
                                <p className="text-slate-700">{r.text}</p>
                              </div>
                            )}
                            {r.what_went_well && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">What went well</p>
                                <p className="text-slate-700">{r.what_went_well}</p>
                              </div>
                            )}
                            {r.areas_for_development && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Areas for development</p>
                                <p className="text-slate-700">{r.areas_for_development}</p>
                              </div>
                            )}
                            <p className="text-xs text-slate-400">{formatDateTime(r.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Fallback for when status is not set (legacy sessions) */}
                {!session.other_reflection_status && (
                  <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-slate-600 font-medium">No shared reflection available</p>
                      <p className="text-sm text-slate-500">
                        The other participant's reflection is not available.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope'] flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Attachments
                </CardTitle>
                <CardDescription>
                  Session plans, supporting documents, and other files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(session.attachments || []).length > 0 && (
                  <div className="space-y-2">
                    {session.attachments.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <a 
                          href={`${BACKEND_URL}${a.url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          {a.name}
                        </a>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-slate-400 hover:text-red-600"
                          onClick={() => handleDeleteAttachment(a.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload File
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Summary - Collapsible */}
            <Collapsible open={aiSummaryExpanded} onOpenChange={setAiSummaryExpanded}>
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => setAiSummaryExpanded(!aiSummaryExpanded)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-['Manrope'] flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      AI Summary
                      {session.aiSummary && (
                        <Badge variant="secondary" className="ml-2">Generated</Badge>
                      )}
                    </CardTitle>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon">
                        {aiSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CardDescription>
                    AI-powered analysis based on observation data and reflections.
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleGenerateSummary}
                        disabled={isGeneratingSummary || (session.events || []).length === 0}
                        variant="default"
                        data-testid="generate-summary-btn"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {session.aiSummary ? 'Regenerate' : 'Generate Summary'}
                          </>
                        )}
                      </Button>
                      {session.aiSummary && !isEditingSummary && (
                        <Button 
                          onClick={handleEditSummary}
                          variant="outline"
                          data-testid="edit-summary-btn"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                    
                    {session.aiSummary && (
                      <div className="p-4 bg-slate-50 rounded-lg">
                        {isEditingSummary ? (
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Textarea
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                className="min-h-[200px] font-normal flex-1"
                                placeholder="Edit the session summary..."
                              />
                              <SpeechToTextButton
                                onTranscribe={(text) => setEditedSummary(prev => prev ? `${prev} ${text}` : text)}
                                className="self-start"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleSaveSummary} size="sm">
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button onClick={handleCancelEditSummary} variant="outline" size="sm">
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose prose-slate prose-sm max-w-none">
                            {session.aiSummary.split('\n').map((paragraph, i) => (
                              paragraph.trim() && <p key={i} className="text-slate-700 mb-3">{paragraph}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </TabsContent>

          {/* Session Analysis Tab - Combines Activity and Charts */}
          <TabsContent value="analysis" className="space-y-6">
            {/* Ball Rolling % - Compact at top - Only show if enabled */}
            {session.includeBallRolling !== false && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-slate-700">Ball Rolling %</div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${stats.ballRollingTime && (stats.ballRollingTime + stats.ballNotRollingTime) > 0 ? Math.round((stats.ballRollingTime / (stats.ballRollingTime + stats.ballNotRollingTime)) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          {stats.ballRollingTime && (stats.ballRollingTime + stats.ballNotRollingTime) > 0 
                            ? Math.round((stats.ballRollingTime / (stats.ballRollingTime + stats.ballNotRollingTime)) * 100) 
                            : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatTime(stats.ballRollingTime || 0)} rolling / {formatTime(stats.ballNotRollingTime || 0)} stopped
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Session Activity Density */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-['Manrope']">Session Activity</CardTitle>
                <CardDescription>Visual representation of when interventions occurred</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {events.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    No events recorded in this session
                  </div>
                ) : (
                  <>
                    {/* Density bar */}
                    <div className="relative">
                      {(() => {
                        const timelineRange = getTimelineRange();
                        const { startMs, endMs, durationMs } = timelineRange;
                        
                        // Filter notes for this part/view
                        const filteredNotes = getFilteredNotes();
                        
                        return (
                          <>
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                              <span>{formatRelativeTime(startMs)}</span>
                              <span>{formatRelativeTime(endMs)}</span>
                            </div>
                            
                            <div 
                              className="relative h-12 bg-slate-100 rounded-lg border border-slate-200"
                              data-testid="density-bar"
                            >
                              {/* Ball rolling segments - subtle background */}
                              {getBallRollingSegments().map((segment, idx) => {
                                const segmentStartMs = segment.start || 0;
                                const segmentEndMs = segmentStartMs + (segment.duration || 0);
                                
                                // Only show segments that overlap with the timeline range
                                if (segmentEndMs < startMs || segmentStartMs > endMs) return null;
                                
                                // Clip segment to timeline range
                                const clippedStart = Math.max(segmentStartMs, startMs);
                                const clippedEnd = Math.min(segmentEndMs, endMs);
                                const startPct = ((clippedStart - startMs) / durationMs) * 100;
                                const widthPct = ((clippedEnd - clippedStart) / durationMs) * 100;
                                
                                return (
                                  <div
                                    key={`ball-${idx}`}
                                    className="absolute top-0 h-full opacity-30 rounded-lg"
                                    style={{
                                      left: `${startPct}%`,
                                      width: `${widthPct}%`,
                                      backgroundColor: segment.rolling ? '#B8E0A5' : '#E5E7EB'
                                    }}
                                  />
                                );
                              })}
                              
                              {/* Event markers */}
                              {events.map((event, index) => {
                                const eventTime = event.relativeTimestamp || 0;
                                // Skip events outside the timeline range
                                if (eventTime < startMs || eventTime > endMs) return null;
                                
                                const position = ((eventTime - startMs) / durationMs) * 100;
                                const eventTypeIndex = (session.interventionTypes || []).findIndex(t => t.id === event.eventTypeId);
                                const color = CHART_COLORS[eventTypeIndex % CHART_COLORS.length] || '#FACC15';
                                const hasNote = event.note && event.note.trim().length > 0;
                                
                                // Get descriptor names for this event
                                const descriptor1Names = (event.descriptors1 || []).map(dId => {
                                  const desc = session.descriptorGroup1?.descriptors?.find(d => d.id === dId);
                                  return desc?.name || dId;
                                });
                                const descriptor2Names = (event.descriptors2 || []).map(dId => {
                                  const desc = session.descriptorGroup2?.descriptors?.find(d => d.id === dId);
                                  return desc?.name || dId;
                                });
                                const hasDescriptors = descriptor1Names.length > 0 || descriptor2Names.length > 0;
                                
                                return (
                                  <div
                                    key={event.id}
                                    className="absolute top-0 h-full group cursor-pointer"
                                    style={{
                                      left: `calc(${Math.min(position, 98)}% - 4px)`,
                                      width: '10px',
                                      zIndex: 5
                                    }}
                                  >
                              <div 
                                className="w-[2px] mx-auto h-full transition-all group-hover:w-1"
                                style={{ backgroundColor: color }}
                              />
                              {/* Note indicator icon - only visible if event has a note */}
                              {hasNote && (
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors">
                                    <StickyNote className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap max-w-xs shadow-lg">
                                  <div className="font-medium">{event.eventTypeName}</div>
                                  <div className="text-slate-300">{formatRelativeTime(event.relativeTimestamp)}</div>
                                  
                                  {/* Descriptors */}
                                  {hasDescriptors && (
                                    <div className="mt-1 pt-1 border-t border-slate-700">
                                      {descriptor1Names.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {descriptor1Names.map((name, i) => (
                                            <span key={i} className="inline-block px-1.5 py-0.5 bg-blue-500/30 text-blue-200 rounded text-[10px]">
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {descriptor2Names.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {descriptor2Names.map((name, i) => (
                                            <span key={i} className="inline-block px-1.5 py-0.5 bg-green-500/30 text-green-200 rounded text-[10px]">
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {hasNote && (
                                    <div className="mt-1 pt-1 border-t border-slate-700">
                                      <div className="flex items-center gap-1 text-purple-300 mb-0.5">
                                        <StickyNote className="w-3 h-3" />
                                        <span className="text-[10px]">Note</span>
                                      </div>
                                      <p className="text-slate-200 text-[10px] break-words">{event.note}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Observer Notes markers on timeline */}
                              {filteredNotes.map((note, noteIdx) => {
                                // Calculate relative position based on note timestamp and session start
                                const sessionStartTime = session.startTime ? new Date(session.startTime).getTime() : 0;
                                const noteTime = note.timestamp ? new Date(note.timestamp).getTime() : 0;
                                const noteRelativeMs = noteTime - sessionStartTime;
                                
                                // Skip notes outside the timeline range
                                if (noteRelativeMs < startMs || noteRelativeMs > endMs) return null;
                                
                                // Position as percentage within the timeline range
                                const position = ((noteRelativeMs - startMs) / durationMs) * 100;
                                
                                // Don't render if outside bounds
                                if (position < 0 || position > 100) return null;
                                
                                return (
                                  <div
                                    key={`note-${note.id || noteIdx}`}
                                    className="absolute top-0 h-full group cursor-pointer"
                                    style={{
                                      left: `${Math.min(position, 98)}%`,
                                      width: '2px'
                                    }}
                                    onClick={() => {
                                      setSelectedNote({ ...note, relativeMs: noteRelativeMs });
                                      setNoteDialogOpen(true);
                                    }}
                                  >
                                    {/* Note marker line - dashed purple */}
                                    <div 
                                      className="w-full h-full border-l-2 border-dashed border-purple-500 opacity-60 group-hover:opacity-100"
                                    />
                                    {/* Note indicator at top */}
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                                      <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors shadow-sm hover:scale-110">
                                        <StickyNote className="w-3 h-3 text-white" />
                                      </div>
                                    </div>
                                    {/* Quick tooltip hint on hover */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                      <div className="bg-purple-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                        <span className="text-purple-200">Click to view note</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Ball State Timeline - thin, clickable for filtering */}
                            <div className="relative mt-1.5">
                              <div 
                                className="relative h-3 bg-slate-50 rounded overflow-hidden border border-slate-100"
                                data-testid="ball-state-timeline"
                              >
                                {getBallRollingSegments().map((segment, idx) => {
                                  const segmentStartMs = segment.start || 0;
                                  const segmentEndMs = segmentStartMs + (segment.duration || 0);
                                  
                                  // Only show segments that overlap with the timeline range
                                  if (segmentEndMs < startMs || segmentStartMs > endMs) return null;
                                  
                                  // Clip segment to timeline range
                                  const clippedStart = Math.max(segmentStartMs, startMs);
                                  const clippedEnd = Math.min(segmentEndMs, endMs);
                                  const startPct = ((clippedStart - startMs) / durationMs) * 100;
                                  const widthPct = ((clippedEnd - clippedStart) / durationMs) * 100;
                                  const isRolling = segment.rolling;
                                  const isSelected = ballStateFilter === (isRolling ? 'rolling' : 'stopped');
                                  const durationSec = (clippedEnd - clippedStart) / 1000;
                                  
                                  return (
                                    <div
                                      key={`ball-state-${idx}`}
                                      className={cn(
                                        "absolute top-0 h-full cursor-pointer transition-all group",
                                        isSelected && "ring-1 ring-offset-1 ring-slate-400"
                                      )}
                                      style={{
                                        left: `${startPct}%`,
                                        width: `${Math.max(widthPct, 0.5)}%`,
                                        backgroundColor: isRolling ? '#B8E0A5' : '#E5E7EB'
                                      }}
                                      onClick={() => {
                                        const newFilter = isRolling ? 'rolling' : 'stopped';
                                        setBallStateFilter(prev => prev === newFilter ? null : newFilter);
                                      }}
                                    >
                                      {/* Hover tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        <div className="bg-slate-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap shadow-lg">
                                          {isRolling ? 'Rolling' : 'Stopped'}: {durationSec >= 60 
                                            ? `${Math.floor(durationSec / 60)}m ${Math.round(durationSec % 60)}s`
                                            : `${Math.round(durationSec)}s`
                                          }
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Filter indicator */}
                              {ballStateFilter && (
                                <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full pl-2">
                                  <button
                                    onClick={() => setBallStateFilter(null)}
                                    className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-0.5"
                                    title="Clear filter"
                                  >
                                    <X className="w-3 h-3" />
                                    <span className="hidden sm:inline">
                                      {ballStateFilter === 'rolling' ? 'Rolling' : 'Stopped'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                      
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs">
                        {/* Ball state legend with clickable filter */}
                        <button 
                          onClick={() => setBallStateFilter(prev => prev === 'rolling' ? null : 'rolling')}
                          className={cn(
                            "flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all",
                            ballStateFilter === 'rolling' ? "bg-slate-100 ring-1 ring-slate-300" : "hover:bg-slate-50"
                          )}
                        >
                          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#B8E0A5' }} />
                          <span className="text-slate-600">Rolling</span>
                        </button>
                        <button 
                          onClick={() => setBallStateFilter(prev => prev === 'stopped' ? null : 'stopped')}
                          className={cn(
                            "flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all",
                            ballStateFilter === 'stopped' ? "bg-slate-100 ring-1 ring-slate-300" : "hover:bg-slate-50"
                          )}
                        >
                          <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#E5E7EB' }} />
                          <span className="text-slate-600">Stopped</span>
                        </button>
                        <div className="w-px bg-slate-200 mx-1" />
                        {(session.interventionTypes || []).slice(0, 4).map((type, idx) => (
                          <div key={type.id} className="flex items-center gap-1.5">
                            <div 
                              className="w-3 h-3 rounded" 
                              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                            />
                            <span className="text-slate-600">{type.name}</span>
                          </div>
                        ))}
                        {/* Notes legend item - show if any observer notes or event notes exist */}
                        {(events.some(e => e.note && e.note.trim()) || getFilteredNotes().length > 0) && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
                              <StickyNote className="w-2 h-2 text-white" />
                            </div>
                            <span className="text-slate-600">Note</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                      <div className="text-center">
                        <div className="text-xl font-bold text-slate-900">{events.length}</div>
                        <div className="text-xs text-slate-500">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-slate-900">
                          {(() => {
                            if (events.length < 2) return '--';
                            const sortedEvents = [...events].sort((a, b) => (a.relativeTimestamp || 0) - (b.relativeTimestamp || 0));
                            let totalGap = 0;
                            for (let i = 1; i < sortedEvents.length; i++) {
                              totalGap += (sortedEvents[i].relativeTimestamp || 0) - (sortedEvents[i-1].relativeTimestamp || 0);
                            }
                            return formatRelativeTime(totalGap / (sortedEvents.length - 1));
                          })()}
                        </div>
                        <div className="text-xs text-slate-500">Avg Gap</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-slate-900">
                          {(() => {
                            if (events.length === 0) return '--';
                            const minuteBuckets = {};
                            events.forEach(e => {
                              const minute = Math.floor((e.relativeTimestamp || 0) / 60000);
                              minuteBuckets[minute] = (minuteBuckets[minute] || 0) + 1;
                            });
                            return Math.max(...Object.values(minuteBuckets));
                          })()}
                        </div>
                        <div className="text-xs text-slate-500">Peak/Min</div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Intervention Patterns Analytics */}
            <InterventionAnalyticsModule 
              events={events}
              interventionTypes={session.interventionTypes || []}
              descriptorGroup1={session.descriptorGroup1}
              descriptorGroup2={session.descriptorGroup2}
            />

            {/* Distribution Pie Charts - 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Interventions Pie Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-['Manrope']">Interventions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-52">
                    {(() => {
                      const interventionData = (session.interventionTypes || []).map((type, idx) => {
                        const count = stats.eventCounts[type.id] || 0;
                        return {
                          name: type.name,
                          value: count,
                          color: CHART_COLORS[idx % CHART_COLORS.length]
                        };
                      }).filter(d => d.value > 0);
                      
                      const total = interventionData.reduce((sum, d) => sum + d.value, 0);
                      
                      if (total === 0) {
                        return (
                          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            No interventions recorded
                          </div>
                        );
                      }
                      
                      // Custom label renderer to position text inside pie segments
                      const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        if (percent < 0.05) return null; // Don't show label for very small slices
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text 
                            x={x} 
                            y={y} 
                            fill="white" 
                            textAnchor="middle" 
                            dominantBaseline="central"
                            fontSize={11}
                            fontWeight="600"
                          >
                            {`${Math.round(percent * 100)}%`}
                          </text>
                        );
                      };
                      
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={interventionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={35}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              label={renderCustomLabel}
                              labelLine={false}
                            >
                              {interventionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value, name) => [`${value} (${Math.round(value/total*100)}%)`, name]}
                            />
                            <Legend 
                              layout="horizontal" 
                              verticalAlign="bottom"
                              wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Descriptor Group 1 (Content Focus) Pie Chart */}
              {session.descriptorGroup1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-['Manrope'] flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-sky-400" />
                      {session.descriptorGroup1.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-52">
                      {(() => {
                        const DESC1_COLORS = ['#38BDF8', '#0EA5E9', '#0284C7', '#0369A1', '#075985'];
                        const desc1Data = (session.descriptorGroup1.descriptors || []).map((desc, idx) => {
                          const count = stats.desc1Counts[desc.id] || 0;
                          return {
                            name: desc.name,
                            value: count,
                            color: DESC1_COLORS[idx % DESC1_COLORS.length]
                          };
                        }).filter(d => d.value > 0);
                        
                        const total = desc1Data.reduce((sum, d) => sum + d.value, 0);
                        
                        if (total === 0) {
                          return (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                              No {session.descriptorGroup1.name.toLowerCase()} recorded
                            </div>
                          );
                        }
                        
                        // Custom label renderer
                        const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          if (percent < 0.05) return null;
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill="white" 
                              textAnchor="middle" 
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight="600"
                            >
                              {`${Math.round(percent * 100)}%`}
                            </text>
                          );
                        };
                        
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={desc1Data}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={renderCustomLabel}
                                labelLine={false}
                              >
                                {desc1Data.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value, name) => [`${value} (${Math.round(value/total*100)}%)`, name]}
                              />
                              <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom"
                                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Descriptor Group 2 (Delivery Method) Pie Chart */}
              {session.descriptorGroup2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-['Manrope'] flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-400" />
                      {session.descriptorGroup2.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-52">
                      {(() => {
                        const DESC2_COLORS = ['#4ADE80', '#22C55E', '#16A34A', '#15803D', '#166534'];
                        const desc2Data = (session.descriptorGroup2.descriptors || []).map((desc, idx) => {
                          const count = stats.desc2Counts[desc.id] || 0;
                          return {
                            name: desc.name,
                            value: count,
                            color: DESC2_COLORS[idx % DESC2_COLORS.length]
                          };
                        }).filter(d => d.value > 0);
                        
                        const total = desc2Data.reduce((sum, d) => sum + d.value, 0);
                        
                        if (total === 0) {
                          return (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                              No {session.descriptorGroup2.name.toLowerCase()} recorded
                            </div>
                          );
                        }
                        
                        // Custom label renderer
                        const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          if (percent < 0.05) return null;
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill="white" 
                              textAnchor="middle" 
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight="600"
                            >
                              {`${Math.round(percent * 100)}%`}
                            </text>
                          );
                        };
                        
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={desc2Data}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={renderCustomLabel}
                                labelLine={false}
                              >
                                {desc2Data.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value, name) => [`${value} (${Math.round(value/total*100)}%)`, name]}
                              />
                              <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom"
                                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      )}
      
      {/* Note Dialog - shows when clicking a note on timeline */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-purple-500" />
              Observer Note
            </DialogTitle>
            <DialogDescription>
              {selectedNote?.relativeMs !== undefined && (
                <span className="text-purple-600 font-medium">
                  {formatRelativeTime(selectedNote.relativeMs)} into session
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-slate-700 whitespace-pre-wrap">{selectedNote?.text}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
