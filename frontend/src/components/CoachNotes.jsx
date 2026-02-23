import { useState, useEffect } from 'react';
import { StickyNote, Plus, ChevronDown, ChevronUp, Lock, Globe, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { toast } from 'sonner';
import { safeGet, safePost, safePut, safeDelete } from '../lib/safeFetch';

const API_URL = '';

export function CoachNotes({ 
  coachId, 
  currentUserId,
  isCoachDeveloper = false,
  defaultExpanded = false,
  className = '' 
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // New note form
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  
  // Edit note state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNotePrivate, setEditNotePrivate] = useState(false);

  useEffect(() => {
    if (coachId) {
      loadNotes();
    }
  }, [coachId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const result = await safeGet(`${API_URL}/api/coaches/${coachId}/notes`);
      if (result.ok) {
        setNotes(result.data || []);
      } else {
        console.error('Failed to load notes:', result.error);
      }
    } catch (err) {
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setSavingNote(true);
    try {
      const result = await safePost(`${API_URL}/api/coaches/${coachId}/notes`, {
        text: newNoteText.trim(),
        is_private: newNotePrivate
      });

      if (result.ok) {
        setNotes(prev => [result.data, ...prev]);
        setNewNoteText('');
        setNewNotePrivate(false);
        setShowNewNote(false);
        toast.success('Note added');
      } else {
        toast.error(result.error || 'Failed to add note');
      }
    } catch (err) {
      console.error('Error adding note:', err);
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note.note_id);
    setEditNoteText(note.text);
    setEditNotePrivate(note.is_private);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditNoteText('');
    setEditNotePrivate(false);
  };

  const handleSaveEdit = async (noteId) => {
    if (!editNoteText.trim()) {
      toast.error('Note cannot be empty');
      return;
    }

    try {
      const result = await safePut(`${API_URL}/api/coaches/${coachId}/notes/${noteId}`, {
        text: editNoteText.trim(),
        is_private: editNotePrivate
      });

      if (result.ok) {
        setNotes(prev => prev.map(n => n.note_id === noteId ? result.data : n));
        handleCancelEdit();
        toast.success('Note updated');
      } else {
        toast.error(result.error || 'Failed to update note');
      }
    } catch (err) {
      console.error('Error updating note:', err);
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      const result = await safeDelete(`${API_URL}/api/coaches/${coachId}/notes/${noteId}`);

      if (result.ok) {
        setNotes(prev => prev.filter(n => n.note_id !== noteId));
        toast.success('Note deleted');
      } else {
        toast.error(result.error || 'Failed to delete note');
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      toast.error('Failed to delete note');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      className={className}
    >
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-500" />
                <CardTitle className="font-['Manrope'] text-lg">Notes</CardTitle>
                {notes.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {notes.length}
                  </Badge>
                )}
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </CollapsibleTrigger>
          <CardDescription className="mt-1">
            {isCoachDeveloper 
              ? 'Private notes are visible to all coach developers but not to the coach.'
              : 'Add notes about your coaching journey.'
            }
          </CardDescription>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Add Note Button or Form */}
            {!showNewNote ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowNewNote(true)}
                className="w-full border-dashed"
                data-testid="add-note-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            ) : (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                <Textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Write your note..."
                  className="min-h-[80px] resize-y bg-white"
                  data-testid="new-note-textarea"
                />
                
                {/* Privacy toggle */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-2">
                    {newNotePrivate ? (
                      <Lock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Globe className="w-4 h-4 text-green-600" />
                    )}
                    <div>
                      <Label htmlFor="note-privacy" className="text-sm font-medium cursor-pointer">
                        {newNotePrivate ? 'Private Note' : 'Shared Note'}
                      </Label>
                      <p className="text-xs text-slate-500">
                        {isCoachDeveloper 
                          ? (newNotePrivate 
                              ? 'Only coach developers can see this' 
                              : 'The coach can also see this')
                          : (newNotePrivate 
                              ? 'Only you can see this' 
                              : 'Coach developers can also see this')
                        }
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="note-privacy"
                    checked={newNotePrivate}
                    onCheckedChange={setNewNotePrivate}
                    data-testid="new-note-privacy-toggle"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowNewNote(false);
                      setNewNoteText('');
                      setNewNotePrivate(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleAddNote}
                    disabled={savingNote || !newNoteText.trim()}
                    data-testid="save-note-btn"
                  >
                    {savingNote ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Save Note
                  </Button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {loading ? (
              <div className="py-6 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                <p className="text-sm text-slate-500 mt-2">Loading notes...</p>
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-4">
                No notes yet
              </p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div 
                    key={note.note_id}
                    className={`p-4 rounded-lg border ${
                      note.is_private 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {editingNoteId === note.note_id ? (
                      // Edit mode
                      <div className="space-y-3">
                        <Textarea
                          value={editNoteText}
                          onChange={(e) => setEditNoteText(e.target.value)}
                          className="min-h-[80px] resize-y"
                          data-testid={`edit-note-textarea-${note.note_id}`}
                        />
                        
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                          <div className="flex items-center gap-2">
                            {editNotePrivate ? (
                              <Lock className="w-4 h-4 text-amber-600" />
                            ) : (
                              <Globe className="w-4 h-4 text-green-600" />
                            )}
                            <span className="text-sm">
                              {editNotePrivate ? 'Private' : 'Shared'}
                            </span>
                          </div>
                          <Switch
                            checked={editNotePrivate}
                            onCheckedChange={setEditNotePrivate}
                          />
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleSaveEdit(note.note_id)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-slate-700 whitespace-pre-wrap">{note.text}</p>
                          </div>
                          
                          {/* Actions - only show for author */}
                          {note.author_id === currentUserId && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                onClick={() => handleStartEdit(note)}
                                data-testid={`edit-note-btn-${note.note_id}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                                    data-testid={`delete-note-btn-${note.note_id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Note?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this note. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteNote(note.note_id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                        
                        {/* Meta info */}
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            {note.is_private ? (
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <Globe className="w-3.5 h-3.5 text-green-600" />
                            )}
                            <span className={`text-xs ${note.is_private ? 'text-amber-600' : 'text-green-600'}`}>
                              {note.is_private ? 'Private' : 'Shared'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">
                            {note.author_name}
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-400">
                            {formatDate(note.created_at)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default CoachNotes;
