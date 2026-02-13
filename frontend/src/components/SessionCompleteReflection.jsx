import { useState, useEffect } from 'react';
import { Star, Loader2, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { fetchReflectionTemplates, fetchReflectionTemplate } from '../lib/reflectionTemplatesApi';
import { cn } from '../lib/utils';

export default function SessionCompleteReflection({ 
  isOpen, 
  onClose, 
  session, 
  onSaveReflection,
  onSkip 
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedNotes, setSelectedNotes] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadTemplate();
    }
  }, [isOpen, session?.reflectionTemplateId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      let templateData = null;
      
      // If session has a specific template selected, use that
      if (session?.reflectionTemplateId) {
        templateData = await fetchReflectionTemplate(session.reflectionTemplateId);
      } else {
        // Otherwise, find the default template for coach educators
        const templates = await fetchReflectionTemplates('coach_educator');
        templateData = templates.find(t => t.is_default) || templates[0];
      }
      
      if (templateData) {
        setTemplate(templateData);
        // Initialize empty responses
        const initialResponses = {};
        templateData.questions?.forEach(q => {
          if (q.question_type === 'checkbox') {
            initialResponses[q.question_id] = [];
          } else {
            initialResponses[q.question_id] = '';
          }
        });
        setResponses(initialResponses);
      }
    } catch (err) {
      console.error('Failed to load reflection template:', err);
      toast.error('Failed to load reflection template');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleCheckboxChange = (questionId, option, checked) => {
    setResponses(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return { ...prev, [questionId]: current.filter(o => o !== option) };
      }
    });
  };

  const handleNoteToggle = (noteId) => {
    setSelectedNotes(prev => {
      if (prev.includes(noteId)) {
        return prev.filter(id => id !== noteId);
      } else {
        return [...prev, noteId];
      }
    });
  };

  const handleSave = async () => {
    // Validate required questions
    const questions = template?.questions || [];
    for (const q of questions) {
      if (q.required) {
        const response = responses[q.question_id];
        if (!response || (Array.isArray(response) && response.length === 0)) {
          toast.error(`Please answer: ${q.question_text}`);
          const idx = questions.findIndex(qs => qs.question_id === q.question_id);
          setCurrentQuestionIndex(idx);
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Get the selected notes content
      const notesContent = session?.observerNotes
        ?.filter(n => selectedNotes.includes(n.id))
        ?.map(n => n.text)
        ?.join('\n\n') || '';

      await onSaveReflection({
        templateId: template?.template_id,
        templateName: template?.name,
        responses,
        selectedNotes: selectedNotes,
        notesContent
      });
      
      toast.success('Reflection saved!');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save reflection');
    } finally {
      setSaving(false);
    }
  };

  const questions = template?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const observerNotes = session?.observerNotes || [];
  const hasNotes = observerNotes.length > 0;

  const renderQuestion = (question) => {
    const response = responses[question.question_id];

    switch (question.question_type) {
      case 'text':
        return (
          <Textarea
            value={response || ''}
            onChange={(e) => handleResponseChange(question.question_id, e.target.value)}
            placeholder="Your answer..."
            rows={4}
            className="mt-2"
            data-testid={`response-${question.question_id}`}
          />
        );

      case 'scale':
        const min = question.scale_min || 1;
        const max = question.scale_max || 5;
        return (
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {Array.from({ length: max - min + 1 }, (_, i) => {
                const value = min + i;
                const isSelected = response === String(value);
                return (
                  <button
                    key={value}
                    onClick={() => handleResponseChange(question.question_id, String(value))}
                    className={cn(
                      "w-12 h-12 rounded-lg border-2 text-lg font-medium transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-200 hover:border-blue-300 text-slate-700"
                    )}
                    data-testid={`scale-${question.question_id}-${value}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>{question.scale_min_label || min}</span>
              <span>{question.scale_max_label || max}</span>
            </div>
          </div>
        );

      case 'dropdown':
        return (
          <Select
            value={response || ''}
            onValueChange={(value) => handleResponseChange(question.question_id, value)}
          >
            <SelectTrigger className="mt-2" data-testid={`dropdown-${question.question_id}`}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {(question.options || []).map((option, i) => (
                <SelectItem key={i} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="mt-3 space-y-2">
            {(question.options || []).map((option, i) => {
              const isChecked = (response || []).includes(option);
              return (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.question_id}-${i}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleCheckboxChange(question.question_id, option, checked)}
                    data-testid={`checkbox-${question.question_id}-${i}`}
                  />
                  <Label 
                    htmlFor={`${question.question_id}-${i}`} 
                    className="text-sm cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Post-Observation Reflection
          </DialogTitle>
          <DialogDescription>
            {template ? template.name : 'Complete your reflection on this observation session'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : !template ? (
          <div className="py-6 text-center">
            <p className="text-slate-500 mb-4">No reflection template available.</p>
            <p className="text-sm text-slate-400">
              Create a reflection template in the Templates page to enable this feature.
            </p>
          </div>
        ) : (
          <div className="py-4">
            {/* Progress indicator */}
            {questions.length > 1 && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-500">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <div className="flex gap-1">
                  {questions.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        idx === currentQuestionIndex
                          ? "bg-blue-500"
                          : responses[questions[idx]?.question_id]
                          ? "bg-green-400"
                          : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Current question */}
            {currentQuestion && (
              <div className="space-y-2">
                <Label className="text-base flex items-center gap-1">
                  {currentQuestion.question_text}
                  {currentQuestion.required && <span className="text-red-500">*</span>}
                </Label>
                {renderQuestion(currentQuestion)}
              </div>
            )}

            {/* Navigation buttons for multi-question templates */}
            {questions.length > 1 && (
              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQuestionIndex === questions.length - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Observer Notes Selection */}
            {hasNotes && currentQuestionIndex === questions.length - 1 && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <Label className="text-base">Include Notes in Summary</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Select notes you want to include in the session summary
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {observerNotes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                        selectedNotes.includes(note.id)
                          ? "border-purple-300 bg-purple-50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                      onClick={() => handleNoteToggle(note.id)}
                    >
                      <Checkbox
                        checked={selectedNotes.includes(note.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">{note.text}</p>
                        <span className="text-xs text-slate-400">{note.partName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onSkip} disabled={saving}>
            Skip for Now
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !template}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Reflection
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
