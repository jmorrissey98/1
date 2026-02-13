import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, Loader2, Star, StarOff, Eye, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { toast } from 'sonner';
import {
  fetchReflectionTemplates,
  createReflectionTemplate,
  updateReflectionTemplate,
  deleteReflectionTemplate,
  setTemplateAsDefault,
  unsetTemplateAsDefault,
  createQuestion
} from '../lib/reflectionTemplatesApi';
import ReflectionTemplateBuilder from './ReflectionTemplateBuilder';

export default function ReflectionTemplatesSection() {
  const [activeSubTab, setActiveSubTab] = useState('coach_educator');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [activeSubTab]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchReflectionTemplates(activeSubTab);
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate({
      name: 'New Reflection Template',
      target_role: activeSubTab,
      description: '',
      questions: [createQuestion('text')],
      is_default: false
    });
    setShowBuilder(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowBuilder(true);
  };

  const handleDuplicate = async (template) => {
    try {
      const newTemplate = {
        name: `${template.name} (Copy)`,
        target_role: template.target_role,
        description: template.description,
        questions: template.questions.map(q => ({
          ...q,
          question_id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })),
        is_default: false
      };
      
      await createReflectionTemplate(newTemplate);
      toast.success('Template duplicated');
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to duplicate template');
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await deleteReflectionTemplate(templateId);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const handleToggleDefault = async (template) => {
    try {
      if (template.is_default) {
        await unsetTemplateAsDefault(template.template_id);
        toast.success('Default status removed');
      } else {
        await setTemplateAsDefault(template.template_id);
        toast.success('Template set as default');
      }
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to update default status');
    }
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      if (templateData.template_id) {
        // Update existing
        await updateReflectionTemplate(templateData.template_id, {
          name: templateData.name,
          description: templateData.description,
          questions: templateData.questions,
          is_default: templateData.is_default
        });
        toast.success('Template updated');
      } else {
        // Create new
        await createReflectionTemplate(templateData);
        toast.success('Template created');
      }
      setShowBuilder(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to save template');
    }
  };

  const getQuestionTypeBadge = (type) => {
    const colors = {
      text: 'bg-blue-100 text-blue-700',
      scale: 'bg-purple-100 text-purple-700',
      dropdown: 'bg-green-100 text-green-700',
      checkbox: 'bg-orange-100 text-orange-700'
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  if (showBuilder) {
    return (
      <ReflectionTemplateBuilder
        template={editingTemplate}
        onSave={handleSaveTemplate}
        onCancel={() => {
          setShowBuilder(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs for Coach Educators / Coaches */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-2" data-testid="reflection-role-tabs">
          <TabsTrigger value="coach_educator" data-testid="coach-educator-subtab">
            Coach Educators
          </TabsTrigger>
          <TabsTrigger value="coach" data-testid="coach-subtab">
            Coaches
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Description */}
      <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-600">
        {activeSubTab === 'coach_educator' ? (
          <p>Templates for <strong>Coach Educators</strong> to reflect on their own coaching observations.</p>
        ) : (
          <p>Templates for <strong>Coaches</strong> to complete their self-reflection after being observed.</p>
        )}
      </div>

      {/* Create Button */}
      <div className="flex justify-end">
        <Button onClick={handleCreateNew} data-testid="create-reflection-template-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">No reflection templates yet</p>
            <Button onClick={handleCreateNew} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Collapsible
              key={template.template_id}
              open={expandedId === template.template_id}
              onOpenChange={(open) => setExpandedId(open ? template.template_id : null)}
            >
              <Card data-testid={`reflection-template-${template.template_id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.is_default && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                            <Star className="w-3 h-3 mr-1 fill-amber-500" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {template.questions?.length || 0} questions
                        {template.description && ` • ${template.description}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleDefault(template)}
                        title={template.is_default ? 'Remove default' : 'Set as default'}
                        data-testid={`toggle-default-${template.template_id}`}
                      >
                        {template.is_default ? (
                          <StarOff className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button size="sm" variant="ghost" data-testid={`expand-reflection-${template.template_id}`}>
                          {expandedId === template.template_id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(template)}
                        data-testid={`edit-reflection-${template.template_id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDuplicate(template)}
                        data-testid={`duplicate-reflection-${template.template_id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{template.name}&quot;. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(template.template_id)}
                              className="bg-red-600 hover:bg-red-700"
                              data-testid={`confirm-delete-reflection-${template.template_id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Questions Preview */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-slate-700 text-sm">Questions:</h4>
                      {(template.questions || []).map((question, index) => (
                        <div
                          key={question.question_id}
                          className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-slate-400 font-medium">Q{index + 1}</span>
                                <Badge className={`text-xs ${getQuestionTypeBadge(question.question_type)}`}>
                                  {question.question_type}
                                </Badge>
                                {question.required && (
                                  <Badge variant="outline" className="text-xs">Required</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-700">{question.question_text || 'Untitled question'}</p>
                              
                              {/* Scale details */}
                              {question.question_type === 'scale' && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                  <span>{question.scale_min_label || question.scale_min}</span>
                                  <span>→</span>
                                  <span>{question.scale_max_label || question.scale_max}</span>
                                </div>
                              )}
                              
                              {/* Options for dropdown/checkbox */}
                              {(question.question_type === 'dropdown' || question.question_type === 'checkbox') && question.options?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {question.options.map((opt, i) => (
                                    <span key={i} className="text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {(!template.questions || template.questions.length === 0) && (
                        <p className="text-sm text-slate-400 italic">No questions defined</p>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
