import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, User, Calendar, Target, CheckCircle, Loader2, Save, Edit3 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Slider } from '../components/ui/slider';
import { toast } from 'sonner';
import { safeGet, safePost, safePut } from '../lib/safeFetch';

const API_URL = '';

export default function CoachSessionDetail() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  
  // Reflection form state
  const [reflectionContent, setReflectionContent] = useState('');
  const [selfRating, setSelfRating] = useState([3]);
  const [strengths, setStrengths] = useState('');
  const [areasForDevelopment, setAreasForDevelopment] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

  const loadSessionDetail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeGet(`${API_URL}/api/coach/session/${sessionId}`);
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to load session');
      }
      
      setSessionData(result.data);
      
      // If reflection exists, populate the form
      if (result.data.reflection) {
        const ref = result.data.reflection;
        setReflectionContent(ref.content || '');
        setSelfRating([ref.self_assessment_rating || 3]);
        setStrengths(ref.strengths || '');
        setAreasForDevelopment(ref.areas_for_development || '');
      }
    } catch (err) {
      console.error('Session detail error:', err);
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReflection = async () => {
    if (!reflectionContent.trim()) {
      toast.error('Please add some reflection content');
      return;
    }
    
    setSaving(true);
    
    try {
      const reflectionData = {
        session_id: sessionId,
        content: reflectionContent,
        self_assessment_rating: selfRating[0],
        strengths: strengths || null,
        areas_for_development: areasForDevelopment || null
      };
      
      let result;
      if (sessionData.reflection) {
        // Update existing reflection
        result = await safePut(`${API_URL}/api/coach/reflections/${sessionData.reflection.reflection_id}`, reflectionData);
      } else {
        // Create new reflection
        result = await safePost(`${API_URL}/api/coach/reflections`, reflectionData);
      }
      
      if (!result.ok) {
        throw new Error(result.data?.detail || 'Failed to save reflection');
      }
      
      toast.success('Reflection saved');
      setIsEditing(false);
      await loadSessionDetail();
    } catch (err) {
      toast.error(err.message || 'Failed to save reflection');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getRatingLabel = (rating) => {
    const labels = {
      1: 'Needs significant development',
      2: 'Developing',
      3: 'Competent',
      4: 'Proficient',
      5: 'Exemplary'
    };
    return labels[rating] || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/coach/sessions')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-slate-900">Session Details</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/coach/sessions')}>
                Back to Sessions
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { session, reflection, observer_name, can_add_reflection } = sessionData || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/coach/sessions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope']">
              {session?.title || 'Session Details'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {formatDate(session?.date || session?.createdAt)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">
              <FileText className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="reflection">
              <Edit3 className="w-4 h-4 mr-2" />
              My Reflection
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Manrope']">Session Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="font-medium">{formatDate(session?.date || session?.createdAt)}</p>
                    </div>
                  </div>
                  {observer_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Observer</p>
                        <p className="font-medium">{observer_name}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Status */}
                <div className="flex items-center gap-2 pt-2">
                  {reflection ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Reflection Complete
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">
                      Awaiting Your Reflection
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Observer Feedback / AI Summary */}
            {session?.ai_summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope'] flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Observer Feedback
                  </CardTitle>
                  <CardDescription>
                    Summary from your observation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-700 whitespace-pre-wrap">{session.ai_summary}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Session Parts / Events Summary */}
            {session?.parts && session.parts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-['Manrope']">Session Structure</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {session.parts.map((part, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium">{part.name}</span>
                        {part.events && (
                          <Badge variant="outline">{part.events.length} events</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reflection Tab */}
          <TabsContent value="reflection" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-['Manrope']">My Reflection</CardTitle>
                    <CardDescription>
                      {reflection 
                        ? 'Your thoughts on this session' 
                        : 'Take a moment to reflect on this session'}
                    </CardDescription>
                  </div>
                  {reflection && !isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* View Mode */}
                {reflection && !isEditing ? (
                  <div className="space-y-6">
                    {/* Self Rating */}
                    <div>
                      <Label className="text-sm text-slate-500">Self Assessment</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <div 
                              key={n}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                n <= (reflection.self_assessment_rating || 0) 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {n}
                            </div>
                          ))}
                        </div>
                        <span className="text-sm text-slate-600">
                          {getRatingLabel(reflection.self_assessment_rating)}
                        </span>
                      </div>
                    </div>

                    {/* Reflection Content */}
                    <div>
                      <Label className="text-sm text-slate-500">Reflection</Label>
                      <p className="mt-2 text-slate-700 whitespace-pre-wrap">{reflection.content}</p>
                    </div>

                    {/* Strengths */}
                    {reflection.strengths && (
                      <div>
                        <Label className="text-sm text-slate-500">What went well</Label>
                        <p className="mt-2 text-slate-700 whitespace-pre-wrap">{reflection.strengths}</p>
                      </div>
                    )}

                    {/* Areas for Development */}
                    {reflection.areas_for_development && (
                      <div>
                        <Label className="text-sm text-slate-500">Areas for development</Label>
                        <p className="mt-2 text-slate-700 whitespace-pre-wrap">{reflection.areas_for_development}</p>
                      </div>
                    )}

                    <p className="text-xs text-slate-400">
                      Last updated: {formatDate(reflection.updated_at || reflection.created_at)}
                    </p>
                  </div>
                ) : (
                  /* Edit Mode */
                  <div className="space-y-6">
                    {/* Self Rating */}
                    <div>
                      <Label>How would you rate this session? (1-5)</Label>
                      <div className="mt-3 space-y-2">
                        <Slider
                          value={selfRating}
                          onValueChange={setSelfRating}
                          min={1}
                          max={5}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Needs development</span>
                          <span className="font-medium text-blue-600">{getRatingLabel(selfRating[0])}</span>
                          <span>Exemplary</span>
                        </div>
                      </div>
                    </div>

                    {/* Main Reflection */}
                    <div>
                      <Label htmlFor="reflection">Your reflection</Label>
                      <Textarea
                        id="reflection"
                        value={reflectionContent}
                        onChange={(e) => setReflectionContent(e.target.value)}
                        placeholder="What are your thoughts on this session? What did you learn? How did the players respond?"
                        className="mt-2 min-h-[150px]"
                      />
                    </div>

                    {/* Strengths */}
                    <div>
                      <Label htmlFor="strengths">What went well?</Label>
                      <Textarea
                        id="strengths"
                        value={strengths}
                        onChange={(e) => setStrengths(e.target.value)}
                        placeholder="Identify specific moments or approaches that worked effectively..."
                        className="mt-2 min-h-[100px]"
                      />
                    </div>

                    {/* Areas for Development */}
                    <div>
                      <Label htmlFor="development">Areas for development</Label>
                      <Textarea
                        id="development"
                        value={areasForDevelopment}
                        onChange={(e) => setAreasForDevelopment(e.target.value)}
                        placeholder="What would you do differently? What will you focus on next time?"
                        className="mt-2 min-h-[100px]"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button 
                        onClick={handleSaveReflection}
                        disabled={saving || !reflectionContent.trim()}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Reflection
                      </Button>
                      {reflection && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setIsEditing(false);
                            // Reset to original values
                            setReflectionContent(reflection.content || '');
                            setSelfRating([reflection.self_assessment_rating || 3]);
                            setStrengths(reflection.strengths || '');
                            setAreasForDevelopment(reflection.areas_for_development || '');
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Helpful Prompts */}
            {!reflection && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4">
                  <h4 className="font-medium text-blue-900 mb-2">Reflection prompts</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• What was the key learning outcome for players today?</li>
                    <li>• How did you adapt to challenges during the session?</li>
                    <li>• What coaching behaviours were most effective?</li>
                    <li>• What would you prioritise developing for next time?</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
