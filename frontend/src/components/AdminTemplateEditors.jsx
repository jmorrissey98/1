import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Eye, Save, X, Type, Sliders, List, CheckSquare, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { toast } from 'sonner';

// Question types for reflection templates
const QUESTION_TYPES = [
  { value: 'text', label: 'Text', icon: Type, description: 'Free-form text response' },
  { value: 'scale', label: 'Scale', icon: Sliders, description: 'Numeric rating scale' },
  { value: 'dropdown', label: 'Dropdown', icon: List, description: 'Single choice from list' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'Multiple choice selection' }
];

// Generate unique ID
const generateId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Create a new question with defaults
const createQuestion = (type) => ({
  question_id: generateId('q'),
  question_text: '',
  question_type: type,
  required: false,
  ...(type === 'scale' && { min_value: 1, max_value: 10 }),
  ...(type === 'dropdown' && { options: ['Option 1', 'Option 2', 'Option 3'] }),
  ...(type === 'checkbox' && { options: ['Option 1', 'Option 2', 'Option 3'] })
});

/**
 * Admin Observation Template Editor
 * Allows creating/editing observation templates with:
 * - Coaching Interventions (events)
 * - Descriptor Groups (Content Focus, Delivery Method)
 * - Session Parts
 */
export function AdminObservationTemplateEditor({ template, onSave, onCancel, saving }) {
  const [name, setName] = useState(template?.name || 'New Observation Template');
  const [description, setDescription] = useState(template?.description || '');
  const [observationContext, setObservationContext] = useState(template?.observationContext || 'training');
  
  // Interventions
  const [interventions, setInterventions] = useState(
    template?.template_data?.interventionTypes || 
    template?.template_data?.eventTypes || 
    [
      { id: generateId('event'), name: 'Command', color: 'yellow' },
      { id: generateId('event'), name: 'Q&A', color: 'yellow' },
      { id: generateId('event'), name: 'Guided Discovery', color: 'yellow' },
      { id: generateId('event'), name: 'Transmission', color: 'yellow' }
    ]
  );
  
  // Descriptor Group 1 (Content Focus)
  const [group1Name, setGroup1Name] = useState(
    template?.template_data?.descriptorGroup1?.name || 'Content Focus'
  );
  const [group1Descriptors, setGroup1Descriptors] = useState(
    template?.template_data?.descriptorGroup1?.descriptors || 
    [
      { id: generateId('desc'), name: 'Technical' },
      { id: generateId('desc'), name: 'Tactical' },
      { id: generateId('desc'), name: 'Physical' },
      { id: generateId('desc'), name: 'Psych' },
      { id: generateId('desc'), name: 'Social' }
    ]
  );
  
  // Descriptor Group 2 (Delivery Method)
  const [group2Name, setGroup2Name] = useState(
    template?.template_data?.descriptorGroup2?.name || 'Delivery Method'
  );
  const [group2Descriptors, setGroup2Descriptors] = useState(
    template?.template_data?.descriptorGroup2?.descriptors || 
    [
      { id: generateId('desc'), name: 'Visual Demo' },
      { id: generateId('desc'), name: 'Triggers' },
      { id: generateId('desc'), name: 'Kinesthetic' }
    ]
  );
  
  // Session Parts
  const [sessionParts, setSessionParts] = useState(
    template?.template_data?.sessionParts || 
    [
      { id: generateId('part'), name: 'Part 1', order: 0 },
      { id: generateId('part'), name: 'Part 2', order: 1 },
      { id: generateId('part'), name: 'Part 3', order: 2 },
      { id: generateId('part'), name: 'Part 4', order: 3 }
    ]
  );

  // Intervention handlers
  const addIntervention = () => {
    setInterventions([...interventions, { id: generateId('event'), name: 'New Intervention', color: 'yellow' }]);
  };
  
  const updateIntervention = (id, name) => {
    setInterventions(interventions.map(i => i.id === id ? { ...i, name } : i));
  };
  
  const removeIntervention = (id) => {
    if (interventions.length <= 1) {
      toast.error('Need at least one intervention');
      return;
    }
    setInterventions(interventions.filter(i => i.id !== id));
  };

  // Descriptor handlers for Group 1
  const addGroup1Descriptor = () => {
    setGroup1Descriptors([...group1Descriptors, { id: generateId('desc'), name: 'New' }]);
  };
  
  const updateGroup1Descriptor = (id, name) => {
    setGroup1Descriptors(group1Descriptors.map(d => d.id === id ? { ...d, name } : d));
  };
  
  const removeGroup1Descriptor = (id) => {
    setGroup1Descriptors(group1Descriptors.filter(d => d.id !== id));
  };

  // Descriptor handlers for Group 2
  const addGroup2Descriptor = () => {
    setGroup2Descriptors([...group2Descriptors, { id: generateId('desc'), name: 'New' }]);
  };
  
  const updateGroup2Descriptor = (id, name) => {
    setGroup2Descriptors(group2Descriptors.map(d => d.id === id ? { ...d, name } : d));
  };
  
  const removeGroup2Descriptor = (id) => {
    setGroup2Descriptors(group2Descriptors.filter(d => d.id !== id));
  };

  // Session part handlers
  const addSessionPart = () => {
    const newOrder = sessionParts.length;
    setSessionParts([...sessionParts, { id: generateId('part'), name: `Part ${newOrder + 1}`, order: newOrder }]);
  };
  
  const updateSessionPart = (id, name) => {
    setSessionParts(sessionParts.map(p => p.id === id ? { ...p, name } : p));
  };
  
  const removeSessionPart = (id) => {
    if (sessionParts.length <= 1) {
      toast.error('Need at least one session part');
      return;
    }
    const updated = sessionParts.filter(p => p.id !== id).map((p, idx) => ({ ...p, order: idx }));
    setSessionParts(updated);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      template_data: {
        observationContext,
        interventionTypes: interventions,
        eventTypes: interventions,
        descriptorGroup1: {
          name: group1Name,
          color: 'blue',
          descriptors: group1Descriptors
        },
        descriptorGroup2: {
          name: group2Name,
          color: 'green',
          descriptors: group2Descriptors
        },
        sessionParts
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {template?.template_id ? 'Edit Observation Template' : 'New Observation Template'}
            </h2>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>Saving...</>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </>
          )}
        </Button>
      </div>

      {/* Template Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter template name"
              />
            </div>
            <div className="space-y-2">
              <Label>Context</Label>
              <Select value={observationContext} onValueChange={setObservationContext}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="match">Match</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter template description"
              rows={2}
            />
          </div>
          <div className="text-sm text-slate-500">
            {interventions.length} interventions • {group1Descriptors.length + group2Descriptors.length} descriptors • {sessionParts.length} parts
          </div>
        </CardContent>
      </Card>

      {/* Coaching Interventions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-400" />
              Coaching Interventions
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addIntervention}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {interventions.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => updateIntervention(item.id, e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeIntervention(item.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Descriptor Group 1 - Content Focus */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-400" />
              <Input
                value={group1Name}
                onChange={(e) => setGroup1Name(e.target.value)}
                className="font-medium text-base border-0 p-0 h-auto focus-visible:ring-0 w-40"
              />
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addGroup1Descriptor}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {group1Descriptors.map((item) => (
              <Badge key={item.id} variant="secondary" className="bg-blue-50 text-blue-700 pr-1 pl-3 py-1.5">
                <Input
                  value={item.name}
                  onChange={(e) => updateGroup1Descriptor(item.id, e.target.value)}
                  className="border-0 p-0 h-auto bg-transparent focus-visible:ring-0 w-20 text-sm"
                />
                <button
                  onClick={() => removeGroup1Descriptor(item.id)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Descriptor Group 2 - Delivery Method */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-400" />
              <Input
                value={group2Name}
                onChange={(e) => setGroup2Name(e.target.value)}
                className="font-medium text-base border-0 p-0 h-auto focus-visible:ring-0 w-40"
              />
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addGroup2Descriptor}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {group2Descriptors.map((item) => (
              <Badge key={item.id} variant="secondary" className="bg-green-50 text-green-700 pr-1 pl-3 py-1.5">
                <Input
                  value={item.name}
                  onChange={(e) => updateGroup2Descriptor(item.id, e.target.value)}
                  className="border-0 p-0 h-auto bg-transparent focus-visible:ring-0 w-20 text-sm"
                />
                <button
                  onClick={() => removeGroup2Descriptor(item.id)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Parts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Session Parts</CardTitle>
            <Button size="sm" variant="outline" onClick={addSessionPart}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessionParts.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-sm text-slate-400 w-6">{idx + 1}</span>
                <Input
                  value={item.name}
                  onChange={(e) => updateSessionPart(item.id, e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeSessionPart(item.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Admin Reflection Template Editor
 * Allows creating/editing reflection templates with:
 * - Template name and description
 * - Questions with different types (Text, Scale, Dropdown, Checkbox)
 */
export function AdminReflectionTemplateEditor({ template, targetRole, onSave, onCancel, saving }) {
  const [name, setName] = useState(template?.name || 'New Reflection Template');
  const [description, setDescription] = useState(template?.description || '');
  const [questions, setQuestions] = useState(
    template?.template_data?.questions || 
    [createQuestion('text')]
  );
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const handleAddQuestion = (type) => {
    const newQuestion = createQuestion(type);
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.question_id);
  };

  const handleRemoveQuestion = (questionId) => {
    if (questions.length <= 1) {
      toast.error('Template must have at least one question');
      return;
    }
    setQuestions(questions.filter(q => q.question_id !== questionId));
  };

  const updateQuestion = (questionId, updates) => {
    setQuestions(questions.map(q => 
      q.question_id === questionId ? { ...q, ...updates } : q
    ));
  };

  const moveQuestion = (index, direction) => {
    const newQuestions = [...questions];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const addOption = (questionId) => {
    const question = questions.find(q => q.question_id === questionId);
    if (question) {
      const options = question.options || [];
      updateQuestion(questionId, { options: [...options, `Option ${options.length + 1}`] });
    }
  };

  const updateOption = (questionId, optionIndex, value) => {
    const question = questions.find(q => q.question_id === questionId);
    if (question) {
      const options = [...(question.options || [])];
      options[optionIndex] = value;
      updateQuestion(questionId, { options });
    }
  };

  const removeOption = (questionId, optionIndex) => {
    const question = questions.find(q => q.question_id === questionId);
    if (question && question.options?.length > 2) {
      const options = question.options.filter((_, i) => i !== optionIndex);
      updateQuestion(questionId, { options });
    } else {
      toast.error('Need at least 2 options');
    }
  };

  const getQuestionTypeIcon = (type) => {
    const found = QUESTION_TYPES.find(t => t.value === type);
    return found ? found.icon : Type;
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    
    if (questions.length === 0) {
      toast.error('Add at least one question');
      return;
    }
    
    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question_text?.trim()) {
        toast.error(`Question ${i + 1} needs question text`);
        return;
      }
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      template_data: {
        target_role: targetRole,
        questions
      }
    });
  };

  const roleLabel = targetRole === 'coach_developer_reflection' ? 'Coach Developers' : 'Coaches';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {template?.template_id ? 'Edit Reflection Template' : 'New Reflection Template'}
            </h2>
            <p className="text-sm text-slate-500">For {roleLabel}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>Saving...</>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </>
          )}
        </Button>
      </div>

      {/* Template Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter template description"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Questions</CardTitle>
            <div className="flex gap-1">
              {QUESTION_TYPES.map((type) => (
                <Button
                  key={type.value}
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddQuestion(type.value)}
                  title={type.description}
                >
                  <type.icon className="w-4 h-4 mr-1" />
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {questions.map((question, index) => {
              const QuestionIcon = getQuestionTypeIcon(question.question_type);
              return (
                <Collapsible
                  key={question.question_id}
                  open={expandedQuestion === question.question_id}
                  onOpenChange={(open) => setExpandedQuestion(open ? question.question_id : null)}
                >
                  <div className="border rounded-lg">
                    <div className="flex items-center gap-2 p-3">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => moveQuestion(index, -1)}
                          disabled={index === 0}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === questions.length - 1}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <span className="text-sm text-slate-400">Q{index + 1}</span>
                      <QuestionIcon className="w-4 h-4 text-slate-400" />
                      
                      <span className="flex-1 text-sm font-medium truncate">
                        {question.question_text || 'Untitled question'}
                      </span>
                      
                      {question.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                      
                      <CollapsibleTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </CollapsibleTrigger>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveQuestion(question.question_id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <CollapsibleContent>
                      <div className="border-t p-4 space-y-4 bg-slate-50">
                        <div className="space-y-2">
                          <Label>Question Text</Label>
                          <Textarea
                            value={question.question_text || ''}
                            onChange={(e) => updateQuestion(question.question_id, { question_text: e.target.value })}
                            placeholder="Enter question"
                            rows={2}
                          />
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.required}
                              onCheckedChange={(checked) => updateQuestion(question.question_id, { required: checked })}
                            />
                            <Label className="text-sm">Required</Label>
                          </div>
                        </div>
                        
                        {question.question_type === 'scale' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Min Value</Label>
                              <Input
                                type="number"
                                value={question.min_value || 1}
                                onChange={(e) => updateQuestion(question.question_id, { min_value: parseInt(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Value</Label>
                              <Input
                                type="number"
                                value={question.max_value || 10}
                                onChange={(e) => updateQuestion(question.question_id, { max_value: parseInt(e.target.value) })}
                              />
                            </div>
                          </div>
                        )}
                        
                        {(question.question_type === 'dropdown' || question.question_type === 'checkbox') && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Options</Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addOption(question.question_id)}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Option
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {(question.options || []).map((option, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <Input
                                    value={option}
                                    onChange={(e) => updateOption(question.question_id, optIdx, e.target.value)}
                                    placeholder={`Option ${optIdx + 1}`}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeOption(question.question_id, optIdx)}
                                    className="text-slate-400 hover:text-red-500"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default { AdminObservationTemplateEditor, AdminReflectionTemplateEditor };
