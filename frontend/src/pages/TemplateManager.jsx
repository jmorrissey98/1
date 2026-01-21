import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, Trash2, Edit2, Check, X, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { storage, getDefaultTemplate } from '../lib/storage';
import { generateId } from '../lib/utils';

export default function TemplateManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setTemplates(storage.getTemplates());
  }, []);

  const saveAndRefresh = (template) => {
    storage.saveTemplate(template);
    setTemplates(storage.getTemplates());
  };

  const handleDuplicate = (template) => {
    const newTemplate = {
      ...template,
      id: generateId('template'),
      name: `${template.name} (Copy)`,
      eventTypes: (template.eventTypes || []).map(e => ({ ...e, id: generateId('event') })),
      descriptorGroup1: {
        ...(template.descriptorGroup1 || { name: 'Group 1', descriptors: [] }),
        descriptors: (template.descriptorGroup1?.descriptors || []).map(d => ({ ...d, id: generateId('desc') }))
      },
      descriptorGroup2: {
        ...(template.descriptorGroup2 || { name: 'Group 2', descriptors: [] }),
        descriptors: (template.descriptorGroup2?.descriptors || []).map(d => ({ ...d, id: generateId('desc') }))
      },
      sessionParts: (template.sessionParts || []).map(p => ({ ...p, id: generateId('part') }))
    };
    
    storage.saveTemplate(newTemplate);
    setTemplates(storage.getTemplates());
    setExpandedId(newTemplate.id);
    toast.success('Template duplicated');
  };

  const handleDelete = (templateId) => {
    storage.deleteTemplate(templateId);
    setTemplates(storage.getTemplates());
    toast.success('Template deleted');
  };

  const handleCreateNew = () => {
    const defaultTemplate = getDefaultTemplate();
    const newTemplate = {
      ...defaultTemplate,
      id: generateId('template'),
      name: 'New Template',
      eventTypes: (defaultTemplate.eventTypes || []).map(e => ({ ...e, id: generateId('event') })),
      descriptorGroup1: {
        ...(defaultTemplate.descriptorGroup1 || { name: 'Group 1', descriptors: [] }),
        descriptors: (defaultTemplate.descriptorGroup1?.descriptors || []).map(d => ({ ...d, id: generateId('desc') }))
      },
      descriptorGroup2: {
        ...(defaultTemplate.descriptorGroup2 || { name: 'Group 2', descriptors: [] }),
        descriptors: (defaultTemplate.descriptorGroup2?.descriptors || []).map(d => ({ ...d, id: generateId('desc') }))
      },
      sessionParts: (defaultTemplate.sessionParts || []).map(p => ({ ...p, id: generateId('part') }))
    };
    
    storage.saveTemplate(newTemplate);
    setTemplates(storage.getTemplates());
    setExpandedId(newTemplate.id);
    toast.success('Template created');
  };

  // Update template name
  const updateTemplateName = (templateId, name) => {
    const template = templates.find(t => t.id === templateId);
    if (template && template.id !== 'default') {
      saveAndRefresh({ ...template, name });
    }
  };

  // Event type functions
  const addEventType = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const newEvent = { id: generateId('event'), name: 'New Event', color: 'yellow' };
      saveAndRefresh({ ...template, eventTypes: [...(template.eventTypes || []), newEvent] });
    }
  };

  const updateEventType = (templateId, eventId, name) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      saveAndRefresh({
        ...template,
        eventTypes: (template.eventTypes || []).map(e => e.id === eventId ? { ...e, name } : e)
      });
    }
  };

  const removeEventType = (templateId, eventId) => {
    const template = templates.find(t => t.id === templateId);
    if (template && (template.eventTypes || []).length > 1) {
      saveAndRefresh({
        ...template,
        eventTypes: (template.eventTypes || []).filter(e => e.id !== eventId)
      });
    } else {
      toast.error('Need at least one event type');
    }
  };

  // Descriptor group functions
  const updateGroupName = (templateId, groupNum, name) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const key = `descriptorGroup${groupNum}`;
      saveAndRefresh({
        ...template,
        [key]: { ...template[key], name }
      });
    }
  };

  const addDescriptor = (templateId, groupNum) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const key = `descriptorGroup${groupNum}`;
      const newDesc = { id: generateId('desc'), name: 'New' };
      saveAndRefresh({
        ...template,
        [key]: { ...template[key], descriptors: [...template[key].descriptors, newDesc] }
      });
    }
  };

  const updateDescriptor = (templateId, groupNum, descId, name) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const key = `descriptorGroup${groupNum}`;
      const group = template[key] || { name: '', descriptors: [] };
      saveAndRefresh({
        ...template,
        [key]: {
          ...group,
          descriptors: (group.descriptors || []).map(d => d.id === descId ? { ...d, name } : d)
        }
      });
    }
  };

  const removeDescriptor = (templateId, groupNum, descId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const key = `descriptorGroup${groupNum}`;
      const group = template[key] || { name: '', descriptors: [] };
      saveAndRefresh({
        ...template,
        [key]: {
          ...group,
          descriptors: (group.descriptors || []).filter(d => d.id !== descId)
        }
      });
    }
  };

  // Session parts functions
  const addSessionPart = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const parts = template.sessionParts || [];
      const newPart = { id: generateId('part'), name: `Part ${parts.length + 1}`, order: parts.length };
      saveAndRefresh({ ...template, sessionParts: [...parts, newPart] });
    }
  };

  const updateSessionPart = (templateId, partId, name) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      saveAndRefresh({
        ...template,
        sessionParts: (template.sessionParts || []).map(p => p.id === partId ? { ...p, name } : p)
      });
    }
  };

  const removeSessionPart = (templateId, partId) => {
    const template = templates.find(t => t.id === templateId);
    if (template && (template.sessionParts || []).length > 1) {
      saveAndRefresh({
        ...template,
        sessionParts: (template.sessionParts || []).filter(p => p.id !== partId)
      });
    } else {
      toast.error('Need at least one session part');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-['Manrope']">Templates</h1>
              <p className="text-sm text-slate-500">Manage your observation templates</p>
            </div>
          </div>
          <Button onClick={handleCreateNew} data-testid="create-template-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {templates.map((template) => (
            <Collapsible
              key={template.id}
              open={expandedId === template.id}
              onOpenChange={(open) => setExpandedId(open ? template.id : null)}
            >
              <Card data-testid={`template-card-${template.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {template.id === 'default' ? (
                          <CardTitle className="font-['Manrope']">{template.name}</CardTitle>
                        ) : (
                          <Input
                            value={template.name}
                            onChange={(e) => updateTemplateName(template.id, e.target.value)}
                            className="font-semibold text-lg border-0 p-0 h-auto focus-visible:ring-0 max-w-xs"
                            data-testid={`template-name-${template.id}`}
                          />
                        )}
                        {template.id === 'default' && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {(template.eventTypes || []).length} events • {((template.descriptorGroup1?.descriptors || []).length + (template.descriptorGroup2?.descriptors || []).length)} descriptors • {(template.sessionParts || []).length} parts
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <CollapsibleTrigger asChild>
                        <Button size="sm" variant="ghost" data-testid={`expand-template-${template.id}`}>
                          {expandedId === template.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDuplicate(template)}
                        data-testid={`duplicate-template-${template.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {template.id !== 'default' && (
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
                                This will permanently delete "{template.name}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(template.id)}
                                className="bg-red-600 hover:bg-red-700"
                                data-testid={`confirm-delete-${template.id}`}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-6">
                    {/* Event Types */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-slate-700 flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-yellow-400" />
                          Event Types
                        </h4>
                        <Button size="sm" variant="outline" onClick={() => addEventType(template.id)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {template.eventTypes.map(event => (
                          <div key={event.id} className="flex items-center gap-2">
                            <Input
                              value={event.name}
                              onChange={(e) => updateEventType(template.id, event.id, e.target.value)}
                              className="flex-1"
                              data-testid={`event-${template.id}-${event.id}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-slate-400 hover:text-red-600 h-8 w-8"
                              onClick={() => removeEventType(template.id, event.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Descriptor Group 1 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-sky-400" />
                          <Input
                            value={template.descriptorGroup1.name}
                            onChange={(e) => updateGroupName(template.id, 1, e.target.value)}
                            className="font-medium border-0 p-0 h-auto focus-visible:ring-0 w-40"
                          />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addDescriptor(template.id, 1)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {template.descriptorGroup1.descriptors.map(desc => (
                          <div key={desc.id} className="flex items-center gap-1 bg-sky-100 rounded-lg pl-3 pr-1 py-1">
                            <Input
                              value={desc.name}
                              onChange={(e) => updateDescriptor(template.id, 1, desc.id, e.target.value)}
                              className="border-0 bg-transparent p-0 h-auto w-20 focus-visible:ring-0 text-sm"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-slate-400 hover:text-red-600"
                              onClick={() => removeDescriptor(template.id, 1, desc.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Descriptor Group 2 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-green-400" />
                          <Input
                            value={template.descriptorGroup2.name}
                            onChange={(e) => updateGroupName(template.id, 2, e.target.value)}
                            className="font-medium border-0 p-0 h-auto focus-visible:ring-0 w-40"
                          />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addDescriptor(template.id, 2)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {template.descriptorGroup2.descriptors.map(desc => (
                          <div key={desc.id} className="flex items-center gap-1 bg-green-100 rounded-lg pl-3 pr-1 py-1">
                            <Input
                              value={desc.name}
                              onChange={(e) => updateDescriptor(template.id, 2, desc.id, e.target.value)}
                              className="border-0 bg-transparent p-0 h-auto w-20 focus-visible:ring-0 text-sm"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-slate-400 hover:text-red-600"
                              onClick={() => removeDescriptor(template.id, 2, desc.id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Session Parts */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-slate-700">Session Parts</h4>
                        <Button size="sm" variant="outline" onClick={() => addSessionPart(template.id)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {template.sessionParts.map((part, index) => (
                          <div key={part.id} className="flex items-center gap-2">
                            <span className="text-sm text-slate-400 w-6">{index + 1}</span>
                            <Input
                              value={part.name}
                              onChange={(e) => updateSessionPart(template.id, part.id, e.target.value)}
                              className="flex-1"
                              data-testid={`part-${template.id}-${part.id}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-slate-400 hover:text-red-600 h-8 w-8"
                              onClick={() => removeSessionPart(template.id, part.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </main>
    </div>
  );
}
