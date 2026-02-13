import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Eye, Save, X, Type, Sliders, List, CheckSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import { createQuestion } from '../lib/reflectionTemplatesApi';

const QUESTION_TYPES = [
  { value: 'text', label: 'Text', icon: Type, description: 'Free-form text response' },
  { value: 'scale', label: 'Scale', icon: Sliders, description: 'Numeric rating scale' },
  { value: 'dropdown', label: 'Dropdown', icon: List, description: 'Single choice from list' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'Multiple choice selection' }
];

export default function ReflectionTemplateBuilder({ template, onSave, onCancel }) {
  const [name, setName] = useState(template?.name || 'New Template');
  const [description, setDescription] = useState(template?.description || '');
  const [questions, setQuestions] = useState(template?.questions || []);
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetRole = template?.target_role || 'coach_educator';

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

  const handleSave = async () => {
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
        toast.error(`Question ${i + 1} needs a question text`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        ...(template?.template_id && { template_id: template.template_id }),
        name: name.trim(),
        target_role: targetRole,
        description: description.trim(),
        questions,
        is_default: isDefault
      });
    } catch (err) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const getQuestionTypeIcon = (type) => {
    const found = QUESTION_TYPES.find(t => t.value === type);
    return found ? found.icon : Type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} data-testid="builder-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {template?.template_id ? 'Edit Template' : 'New Reflection Template'}
            </h2>
            <p className="text-sm text-slate-500">
              For {targetRole === 'coach_educator' ? 'Coach Educators' : 'Coaches'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)} data-testid="preview-btn">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="save-template-btn">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Template Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Post-Session Reflection"
              className="mt-1"
              data-testid="template-name-input"
            />
          </div>
          <div>
            <Label htmlFor="template-desc">Description (optional)</Label>
            <Textarea
              id="template-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when this template should be used"
              className="mt-1"
              rows={2}
              data-testid="template-desc-input"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <Label htmlFor="is-default" className="cursor-pointer">Set as Default</Label>
              <p className="text-xs text-slate-500 mt-0.5">
                This template will be used by default for all {targetRole === 'coach_educator' ? 'coach educator' : 'coach'} reflections
              </p>
            </div>
            <Switch
              id="is-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              data-testid="is-default-switch"
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-900">Questions</h3>
          <div className="flex items-center gap-2">
            {QUESTION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddQuestion(type.value)}
                  title={type.description}
                  data-testid={`add-${type.value}-btn`}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {type.label}
                </Button>
              );
            })}
          </div>
        </div>

        {questions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500 mb-4">No questions yet. Add your first question above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => {
              const QuestionIcon = getQuestionTypeIcon(question.question_type);
              const isExpanded = expandedQuestion === question.question_id;
              
              return (
                <Card 
                  key={question.question_id} 
                  className={isExpanded ? 'ring-2 ring-slate-300' : ''}
                  data-testid={`question-card-${index}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
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
                        <span className="text-sm font-medium text-slate-400">Q{index + 1}</span>
                        <QuestionIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium truncate max-w-[300px]">
                          {question.question_text || 'Untitled question'}
                        </span>
                        {question.required && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setExpandedQuestion(isExpanded ? null : question.question_id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleRemoveQuestion(question.question_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-2 space-y-4">
                      <div>
                        <Label>Question Text</Label>
                        <Input
                          value={question.question_text}
                          onChange={(e) => updateQuestion(question.question_id, { question_text: e.target.value })}
                          placeholder="Enter your question"
                          className="mt-1"
                          data-testid={`question-text-${index}`}
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`required-${question.question_id}`}
                            checked={question.required}
                            onCheckedChange={(checked) => updateQuestion(question.question_id, { required: checked })}
                          />
                          <Label htmlFor={`required-${question.question_id}`} className="cursor-pointer text-sm">
                            Required
                          </Label>
                        </div>
                      </div>

                      {/* Scale-specific options */}
                      {question.question_type === 'scale' && (
                        <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                          <h4 className="font-medium text-sm text-slate-700">Scale Settings</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Min Value</Label>
                              <Input
                                type="number"
                                value={question.scale_min}
                                onChange={(e) => updateQuestion(question.question_id, { scale_min: parseInt(e.target.value) || 1 })}
                                className="mt-1"
                                data-testid={`scale-min-${index}`}
                              />
                            </div>
                            <div>
                              <Label>Max Value</Label>
                              <Input
                                type="number"
                                value={question.scale_max}
                                onChange={(e) => updateQuestion(question.question_id, { scale_max: parseInt(e.target.value) || 5 })}
                                className="mt-1"
                                data-testid={`scale-max-${index}`}
                              />
                            </div>
                            <div>
                              <Label>Min Label (optional)</Label>
                              <Input
                                value={question.scale_min_label || ''}
                                onChange={(e) => updateQuestion(question.question_id, { scale_min_label: e.target.value })}
                                placeholder="e.g., Poor"
                                className="mt-1"
                                data-testid={`scale-min-label-${index}`}
                              />
                            </div>
                            <div>
                              <Label>Max Label (optional)</Label>
                              <Input
                                value={question.scale_max_label || ''}
                                onChange={(e) => updateQuestion(question.question_id, { scale_max_label: e.target.value })}
                                placeholder="e.g., Excellent"
                                className="mt-1"
                                data-testid={`scale-max-label-${index}`}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dropdown/Checkbox options */}
                      {(question.question_type === 'dropdown' || question.question_type === 'checkbox') && (
                        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-slate-700">Options</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addOption(question.question_id)}
                              data-testid={`add-option-${index}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Option
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {(question.options || []).map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(question.question_id, optIndex, e.target.value)}
                                  className="flex-1"
                                  data-testid={`option-${index}-${optIndex}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-slate-400 hover:text-red-600 h-8 w-8"
                                  onClick={() => removeOption(question.question_id, optIndex)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              This is how the reflection form will appear to users.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-1">{name || 'Untitled Template'}</h3>
              {description && <p className="text-sm text-slate-500">{description}</p>}
            </div>
            
            {questions.map((question, index) => (
              <div key={question.question_id} className="space-y-2">
                <Label className="flex items-center gap-1">
                  {question.question_text || `Question ${index + 1}`}
                  {question.required && <span className="text-red-500">*</span>}
                </Label>
                
                {question.question_type === 'text' && (
                  <Textarea placeholder="Your answer..." rows={3} disabled className="bg-slate-50" />
                )}
                
                {question.question_type === 'scale' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Array.from({ length: (question.scale_max || 5) - (question.scale_min || 1) + 1 }, (_, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <button
                          className="w-10 h-10 rounded-lg border-2 border-slate-200 text-sm font-medium hover:border-slate-400 transition-colors"
                          disabled
                        >
                          {(question.scale_min || 1) + i}
                        </button>
                        {i === 0 && question.scale_min_label && (
                          <span className="text-xs text-slate-500 mt-1">{question.scale_min_label}</span>
                        )}
                        {i === (question.scale_max || 5) - (question.scale_min || 1) && question.scale_max_label && (
                          <span className="text-xs text-slate-500 mt-1">{question.scale_max_label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {question.question_type === 'dropdown' && (
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {(question.options || []).map((opt, i) => (
                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {question.question_type === 'checkbox' && (
                  <div className="space-y-2">
                    {(question.options || []).map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="checkbox" disabled className="w-4 h-4" />
                        <span className="text-sm">{opt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
