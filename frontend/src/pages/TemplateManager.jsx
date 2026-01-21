import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { storage, getDefaultTemplate } from '../lib/storage';
import { generateId } from '../lib/utils';

export default function TemplateManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    setTemplates(storage.getTemplates());
  }, []);

  const handleDuplicate = (template) => {
    const newTemplate = {
      ...template,
      id: generateId('template'),
      name: `${template.name} (Copy)`,
      eventTypes: template.eventTypes.map(e => ({ ...e, id: generateId('event') })),
      descriptorGroup1: {
        ...template.descriptorGroup1,
        descriptors: template.descriptorGroup1.descriptors.map(d => ({ ...d, id: generateId('desc') }))
      },
      descriptorGroup2: {
        ...template.descriptorGroup2,
        descriptors: template.descriptorGroup2.descriptors.map(d => ({ ...d, id: generateId('desc') }))
      },
      sessionParts: template.sessionParts.map(p => ({ ...p, id: generateId('part') }))
    };
    
    storage.saveTemplate(newTemplate);
    setTemplates(storage.getTemplates());
    toast.success('Template duplicated');
  };

  const handleDelete = (templateId) => {
    storage.deleteTemplate(templateId);
    setTemplates(storage.getTemplates());
    toast.success('Template deleted');
  };

  const handleRename = (templateId) => {
    if (!editName.trim()) return;
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      storage.saveTemplate({ ...template, name: editName });
      setTemplates(storage.getTemplates());
    }
    setEditingId(null);
    setEditName('');
    toast.success('Template renamed');
  };

  const handleCreateNew = () => {
    const defaultTemplate = getDefaultTemplate();
    const newTemplate = {
      ...defaultTemplate,
      id: generateId('template'),
      name: 'New Template',
      eventTypes: defaultTemplate.eventTypes.map(e => ({ ...e, id: generateId('event') })),
      descriptorGroup1: {
        ...defaultTemplate.descriptorGroup1,
        descriptors: defaultTemplate.descriptorGroup1.descriptors.map(d => ({ ...d, id: generateId('desc') }))
      },
      descriptorGroup2: {
        ...defaultTemplate.descriptorGroup2,
        descriptors: defaultTemplate.descriptorGroup2.descriptors.map(d => ({ ...d, id: generateId('desc') }))
      },
      sessionParts: defaultTemplate.sessionParts.map(p => ({ ...p, id: generateId('part') }))
    };
    
    storage.saveTemplate(newTemplate);
    setTemplates(storage.getTemplates());
    toast.success('Template created');
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
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} data-testid={`template-card-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {editingId === template.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="max-w-xs"
                          autoFocus
                          data-testid={`edit-template-name-${template.id}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRename(template.id)}
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="font-['Manrope'] flex items-center gap-2">
                        {template.name}
                        {template.id === 'default' && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </CardTitle>
                    )}
                    <CardDescription className="mt-1">
                      {template.eventTypes.length} events • {template.descriptorGroup1.descriptors.length + template.descriptorGroup2.descriptors.length} descriptors • {template.sessionParts.length} parts
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {template.id !== 'default' && editingId !== template.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(template.id);
                          setEditName(template.name);
                        }}
                        data-testid={`rename-template-${template.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
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
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded bg-yellow-400" />
                      Events
                    </div>
                    <div className="space-y-1">
                      {template.eventTypes.map(e => (
                        <div key={e.id} className="text-slate-600">{e.name}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded bg-sky-400" />
                      {template.descriptorGroup1.name}
                    </div>
                    <div className="space-y-1">
                      {template.descriptorGroup1.descriptors.map(d => (
                        <div key={d.id} className="text-slate-600">{d.name}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded bg-green-400" />
                      {template.descriptorGroup2.name}
                    </div>
                    <div className="space-y-1">
                      {template.descriptorGroup2.descriptors.map(d => (
                        <div key={d.id} className="text-slate-600">{d.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
