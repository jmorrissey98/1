import { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Check, X, Lock, Globe, Loader2, StickyNote, ChevronDown, ChevronUp 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import axios from 'axios';

const API = '/api';

/**
 * CoachNotes component - Displays and manages notes for a coach profile.
 * 
 * Props:
 * - coachId: string - The coach's ID
 * - coachName: string - The coach's name (for display)
 * - currentUserRole: string - 'coach', 'coach_developer', or 'admin'
 * - currentUserId: string - The logged-in user's ID
 * - isOwnProfile: boolean - Whether the coach is viewing their own profile
 */
export default function CoachNotes({ 
  coachId, 
  coachName, 
  currentUserRole, 
  currentUserId,
  isOwnProfile = false 
}) {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Add note state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit note state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNotePrivate, setEditNotePrivate] = useState(false);

  const isCoachDeveloper = currentUserRole === 'coach_developer' || currentUserRole === 'admin';

  useEffect(() => {
    if (coachId) {
      loadNotes();
    }
  }, [coachId]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/coaches/${coachId}/notes`, { withCredentials: true });
      setNotes(response.data || []);
    } catch (err) {
      console.error('Failed to load notes:', err);
      // Don't show error toast for 404 - just means no notes yet
      if (err.response?.status !== 404) {
        toast.error('Failed to load notes');
      }
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    
    setIsSaving(true);
    try {
      const response = await axios.post(
        `${API}/coaches/${coachId}/notes`,
        { text: newNoteText.trim(), is_private: newNotePrivate },
        { withCredentials: true }
      );
      
      setNotes(prev => [response.data, ...prev]);
      setNewNoteText('');
      setNewNotePrivate(false);
      setShowAddForm(false);
      toast.success('Note added');
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error(err.response?.data?.detail || 'Failed to add note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = async (noteId) => {
    if (!editNoteText.trim()) return;
    
    setIsSaving(true);
    try {
      const response = await axios.put(
        `${API}/coaches/${coachId}/notes/${noteId}`,
        { text: editNoteText.trim(), is_private: editNotePrivate },
        { withCredentials: true }
      );
      
      setNotes(prev => prev.map(n => n.note_id === noteId ? response.data : n));
      setEditingNoteId(null);
      toast.success('Note updated');
    } catch (err) {
      console.error('Failed to update note:', err);
      toast.error(err.response?.data?.detail || 'Failed to update note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await axios.delete(`${API}/coaches/${coachId}/notes/${noteId}`, { withCredentials: true });
      setNotes(prev => prev.filter(n => n.note_id !== noteId));
      toast.success('Note deleted');
    } catch (err) {
      console.error('Failed to delete note:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete note');
    }
  };

  const startEditing = (note) => {
    setEditingNoteId(note.note_id);
    setEditNoteText(note.text);
    setEditNotePrivate(note.is_private);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditNoteText('');
    setEditNotePrivate(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy, HH:mm');
    } catch {
      return dateStr;
    }
  };

  // Filter notes based on visibility
  // Coach developers see all notes
  // Coaches see: shared notes + their own private notes
  const visibleNotes = notes;

  return (
    <Card data-testid="coach-notes-card">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                <StickyNote className="w-5 h-5 text-amber-500" />
                <CardTitle className="font-['Manrope']">
                  {isOwnProfile ? 'My Notes' : 'Profile Notes'}
                </CardTitle>
                <Badge variant="outline" className="ml-2">{visibleNotes.length}</Badge>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                )}
              </div>
            </CollapsibleTrigger>
            {!showAddForm && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setShowAddForm(true); setIsExpanded(true); }}
                data-testid="add-note-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Note
              </Button>
            )}
          </div>
          <CardDescription>
            {isCoachDeveloper 
              ? `Notes about ${coachName}'s development and progress`
              : 'Your personal development notes'}
          </CardDescription>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Add Note Form */}
            {showAddForm && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200" data-testid="add-note-form">
                <Textarea
                  placeholder="Write your note here..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  rows={3}
                  className="mb-3 bg-white"
                  data-testid="new-note-textarea"
                />
                
                {/* Privacy toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <Switch
                    id="new-note-private"
                    checked={newNotePrivate}
                    onCheckedChange={setNewNotePrivate}
                    data-testid="new-note-private-toggle"
                  />
                  <Label htmlFor="new-note-private" className="flex items-center gap-1 text-sm cursor-pointer">
                    {newNotePrivate ? (
                      <>
                        <Lock className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-600">Private note</span>
                        <span className="text-xs text-slate-400">
                          {isCoachDeveloper 
                            ? '(Only coach developers can see this)' 
                            : '(Only you can see this)'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-green-500" />
                        <span className="text-slate-600">Shared note</span>
                        <span className="text-xs text-slate-400">
                          {isCoachDeveloper 
                            ? `(Visible to ${coachName})` 
                            : '(Visible to coach developers)'}
                        </span>
                      </>
                    )}
                  </Label>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleAddNote}
                    disabled={isSaving || !newNoteText.trim()}
                    data-testid="save-note-btn"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Save Note
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setShowAddForm(false); setNewNoteText(''); setNewNotePrivate(false); }}
                    data-testid="cancel-note-btn"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : visibleNotes.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notes yet</p>
                <p className="text-xs mt-1">Add a note to track development observations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleNotes.map((note) => {
                  const isOwnNote = note.author_id === currentUserId;
                  const canEdit = isOwnNote;
                  const canDelete = isOwnNote || currentUserRole === 'admin';
                  
                  return (
                    <div 
                      key={note.note_id} 
                      className={`p-4 rounded-lg border ${
                        note.is_private 
                          ? 'bg-slate-50 border-slate-200' 
                          : 'bg-white border-slate-200'
                      }`}
                      data-testid={`note-item-${note.note_id}`}
                    >
                      {editingNoteId === note.note_id ? (
                        // Edit Mode
                        <div>
                          <Textarea
                            value={editNoteText}
                            onChange={(e) => setEditNoteText(e.target.value)}
                            rows={3}
                            className="mb-3"
                            data-testid={`edit-note-textarea-${note.note_id}`}
                          />
                          
                          {/* Privacy toggle for edit */}
                          <div className="flex items-center gap-2 mb-3">
                            <Switch
                              id={`edit-note-private-${note.note_id}`}
                              checked={editNotePrivate}
                              onCheckedChange={setEditNotePrivate}
                            />
                            <Label htmlFor={`edit-note-private-${note.note_id}`} className="flex items-center gap-1 text-sm">
                              {editNotePrivate ? (
                                <>
                                  <Lock className="w-3 h-3" /> Private
                                </>
                              ) : (
                                <>
                                  <Globe className="w-3 h-3 text-green-500" /> Shared
                                </>
                              )}
                            </Label>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateNote(note.note_id)}
                              disabled={isSaving}
                            >
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span className="ml-1">Save</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={cancelEditing}>
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-slate-700 whitespace-pre-wrap">{note.text}</p>
                            </div>
                            
                            {/* Actions */}
                            {(canEdit || canDelete) && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                    onClick={() => startEditing(note)}
                                    data-testid={`edit-note-${note.note_id}`}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                                        data-testid={`delete-note-${note.note_id}`}
                                      >
                                        <Trash2 className="w-3 h-3" />
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
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Meta info */}
                          <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                            <span>{note.author_name}</span>
                            <span>•</span>
                            <span>{formatDate(note.created_at)}</span>
                            {note.is_private && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs py-0 px-1">
                                  <Lock className="w-2.5 h-2.5 mr-0.5" />
                                  Private
                                </Badge>
                              </>
                            )}
                            {!note.is_private && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs py-0 px-1 border-green-300 text-green-700">
                                  <Globe className="w-2.5 h-2.5 mr-0.5" />
                                  Shared
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
