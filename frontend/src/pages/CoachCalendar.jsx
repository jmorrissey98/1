import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { OBSERVATION_CONTEXTS } from '../lib/storage';
import { safeGet } from '../lib/safeFetch';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { toast } from 'sonner';

const API_URL = '';

export default function CoachCalendar() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      // Use coach-specific calendar endpoint
      const result = await safeGet(`${API_URL}/api/coach/calendar`);
      
      if (result.ok && Array.isArray(result.data)) {
        setSessions(result.data);
      } else {
        console.error('Failed to load calendar:', result.data);
        toast.error('Failed to load calendar');
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      toast.error('Failed to load calendar sessions');
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad with days from previous/next month
  const startPadding = monthStart.getDay();
  const endPadding = 6 - monthEnd.getDay();

  const getSessionsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return sessions.filter(s => {
      let sessionDate;
      if (s.status === 'planned' && s.plannedDate) {
        sessionDate = s.plannedDate;
      } else {
        sessionDate = s.createdAt;
      }
      
      if (sessionDate) {
        const datePart = sessionDate.split('T')[0];
        return datePart === dateStr;
      }
      return false;
    });
  };

  const selectedDateSessions = selectedDate ? getSessionsForDate(selectedDate) : [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'planned': return 'bg-blue-500';
      case 'active': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-slate-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-area-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 font-['Manrope']">My Calendar</h1>
              <p className="text-xs sm:text-sm text-slate-500">View your observation sessions</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-4">
              <CardTitle className="font-['Manrope'] text-base sm:text-lg">
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-xs sm:text-sm font-medium text-slate-500 py-1 sm:py-2">
                    <span className="sm:hidden">{day}</span>
                    <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {/* Padding for start of month */}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-start-${i}`} className="h-12 sm:h-16 lg:h-20 bg-slate-50 rounded-lg" />
                ))}

                {/* Days */}
                {days.map(day => {
                  const daySessions = getSessionsForDate(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "h-12 sm:h-16 lg:h-20 p-0.5 sm:p-1 rounded-lg border text-left transition-all min-h-[48px]",
                        isToday(day) && "border-blue-500",
                        isSelected ? "border-slate-900 bg-slate-100" : "border-transparent hover:bg-slate-50",
                        !isSameMonth(day, currentMonth) && "opacity-40"
                      )}
                    >
                      <div className={cn(
                        "text-xs sm:text-sm font-medium",
                        isToday(day) ? "text-blue-600" : "text-slate-700"
                      )}>
                        {format(day, 'd')}
                      </div>
                      <div className="mt-0.5 sm:mt-1 space-y-0.5 hidden sm:block">
                        {daySessions.slice(0, 2).map(s => (
                          <div
                            key={s.id}
                            className={cn(
                              "h-1 sm:h-1.5 rounded-full",
                              getStatusColor(s.status)
                            )}
                          />
                        ))}
                        {daySessions.length > 2 && (
                          <div className="text-xs text-slate-500">+{daySessions.length - 2}</div>
                        )}
                      </div>
                      {/* Mobile indicator dot */}
                      {daySessions.length > 0 && (
                        <div className="sm:hidden flex justify-center mt-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(daySessions[0].status))} />
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Padding for end of month */}
                {Array.from({ length: endPadding }).map((_, i) => (
                  <div key={`pad-end-${i}`} className="h-12 sm:h-16 lg:h-20 bg-slate-50 rounded-lg" />
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-600">
                  <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-blue-500" />
                  Scheduled
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-600">
                  <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-orange-500" />
                  In Progress
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-600">
                  <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-green-500" />
                  Completed
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Sessions */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="font-['Manrope'] flex items-center gap-2 text-base sm:text-lg">
                <CalendarIcon className="w-4 sm:w-5 h-4 sm:h-5" />
                {selectedDate ? format(selectedDate, 'EEE, d MMM') : 'Select a Day'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-slate-500 text-sm">Click on a day to view sessions</p>
              ) : selectedDateSessions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No sessions on this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateSessions.map(session => {
                    return (
                      <div 
                        key={session.id}
                        className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                        onClick={() => {
                          if (session.status === 'completed') {
                            navigate(`/session/${session.id}/review?view=coach`);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{session.name}</h4>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {session.observationContext === OBSERVATION_CONTEXTS?.GAME ? 'Game' : 'Training'}
                              </Badge>
                              <Badge className={cn("text-xs text-white", getStatusColor(session.status))}>
                                {session.status}
                              </Badge>
                            </div>
                          </div>
                          {session.status === 'completed' && (
                            <Eye className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
