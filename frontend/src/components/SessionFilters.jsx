import { useState, useEffect } from 'react';
import { Filter, Calendar, X, ChevronDown, ChevronUp, Lock, Layers } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { useUpgrade } from '../contexts/UpgradeContext';
import { fetchSessionParts } from '../lib/sessionPartsApi';

// Days of the week
const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

// Session types
const SESSION_TYPES = [
  { value: 'all', label: 'All Sessions' },
  { value: 'training', label: 'Training Only' },
  { value: 'game', label: 'Game Only' }
];

// Timeframe presets with months requirement
const TIMEFRAME_PRESETS = [
  { value: 'all', label: 'All Time', monthsRequired: null }, // null means unlimited
  { value: 'week', label: 'Last 7 Days', monthsRequired: 1 },
  { value: 'month', label: 'This Month', monthsRequired: 1 },
  { value: '3months', label: 'Last 3 Months', monthsRequired: 3 },
  { value: '6months', label: 'Last 6 Months', monthsRequired: 6 },
  { value: 'year', label: 'This Year', monthsRequired: 12 },
  { value: 'custom', label: 'Custom Range', monthsRequired: null }
];

// Get available timeframes based on data retention limit
const getAvailableTimeframes = (monthsLimit) => {
  if (!monthsLimit) return TIMEFRAME_PRESETS; // Unlimited access
  
  return TIMEFRAME_PRESETS.map(preset => ({
    ...preset,
    disabled: preset.monthsRequired === null 
      ? (preset.value === 'all') // Disable "All Time" for limited users
      : preset.monthsRequired > monthsLimit,
    lockedLabel: preset.monthsRequired === null 
      ? (preset.value === 'all' ? `Upgrade for ${preset.label}` : preset.label)
      : (preset.monthsRequired > monthsLimit ? `Upgrade for ${preset.label}` : preset.label)
  }));
};

export function SessionFilters({ 
  filters, 
  onFiltersChange, 
  showCompact = false,
  dataRetention = null, // { is_limited, months_limit, tier }
  availableSessionParts = null, // Optional: pass session parts used in sessions
  className = '',
  subscriptionTier = null // 'individual', 'developer', 'club'
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionParts, setSessionParts] = useState([]);
  const [hasSetDefaultTimeframe, setHasSetDefaultTimeframe] = useState(false);
  
  // Set default timeframe based on tier (only on initial load when dataRetention loads)
  useEffect(() => {
    if (!hasSetDefaultTimeframe && dataRetention !== null) {
      // Determine the tier from dataRetention or subscriptionTier prop
      // Note: API may return 'free' for Individual tier accounts
      const tier = (subscriptionTier || dataRetention?.tier || 'individual').toLowerCase();
      
      // Individual/free tier defaults to 3 months, others get all time
      const isIndividualTier = tier === 'individual' || tier === 'free';
      if (isIndividualTier && filters.timeframe === 'all') {
        onFiltersChange({ ...filters, timeframe: '3months' });
      }
      setHasSetDefaultTimeframe(true);
    }
  }, [dataRetention, subscriptionTier, hasSetDefaultTimeframe, filters, onFiltersChange]);
  
  // Load session parts on mount
  useEffect(() => {
    const loadParts = async () => {
      try {
        const parts = await fetchSessionParts();
        setSessionParts(parts || []);
      } catch (err) {
        console.error('Failed to load session parts:', err);
      }
    };
    loadParts();
  }, []);
  
  // Use available parts from props if provided, otherwise use loaded parts
  const displayParts = availableSessionParts || sessionParts;
  
  // Get available timeframes based on retention limits
  const availableTimeframes = getAvailableTimeframes(dataRetention?.months_limit);
  
  const {
    timeframe = 'all',
    startDate = '',
    endDate = '',
    sessionType = 'all',
    daysOfWeek = [], // array of selected day values
    sessionParts: selectedParts = [] // array of selected part names
  } = filters;

  const handleTimeframeChange = (value) => {
    onFiltersChange({ 
      ...filters, 
      timeframe: value,
      // Clear custom dates if not using custom
      startDate: value === 'custom' ? startDate : '',
      endDate: value === 'custom' ? endDate : ''
    });
  };

  const handleSessionTypeChange = (value) => {
    onFiltersChange({ ...filters, sessionType: value });
  };

  const handleDayToggle = (dayValue) => {
    const newDays = daysOfWeek.includes(dayValue)
      ? daysOfWeek.filter(d => d !== dayValue)
      : [...daysOfWeek, dayValue];
    onFiltersChange({ ...filters, daysOfWeek: newDays });
  };

  const handleDateChange = (field, value) => {
    onFiltersChange({ 
      ...filters, 
      [field]: value,
      timeframe: 'custom'
    });
  };

  const handlePartToggle = (partName) => {
    const newParts = selectedParts.includes(partName)
      ? selectedParts.filter(p => p !== partName)
      : [...selectedParts, partName];
    onFiltersChange({ ...filters, sessionParts: newParts });
  };

  const clearFilters = () => {
    onFiltersChange({
      timeframe: 'all',
      startDate: '',
      endDate: '',
      sessionType: 'all',
      daysOfWeek: [],
      sessionParts: []
    });
  };

  const hasActiveFilters = timeframe !== 'all' || sessionType !== 'all' || daysOfWeek.length > 0 || selectedParts.length > 0;
  const activeFilterCount = (timeframe !== 'all' ? 1 : 0) + 
                           (sessionType !== 'all' ? 1 : 0) + 
                           (daysOfWeek.length > 0 ? 1 : 0) +
                           (selectedParts.length > 0 ? 1 : 0);

  if (showCompact) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className={hasActiveFilters ? 'border-blue-300 bg-blue-50' : ''}
              data-testid="toggle-filters-btn"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0">
                  {activeFilterCount}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-700"
              data-testid="clear-filters-btn"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        <CollapsibleContent>
          <Card className="mt-3">
            <CardContent className="pt-4 space-y-4">
              <FilterContent 
                filters={filters}
                onTimeframeChange={handleTimeframeChange}
                onSessionTypeChange={handleSessionTypeChange}
                onDayToggle={handleDayToggle}
                onPartToggle={handlePartToggle}
                onDateChange={handleDateChange}
                availableTimeframes={availableTimeframes}
                dataRetention={dataRetention}
                sessionParts={displayParts}
              />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </h4>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-700"
              data-testid="clear-filters-btn"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        
        <FilterContent 
          filters={filters}
          onTimeframeChange={handleTimeframeChange}
          onSessionTypeChange={handleSessionTypeChange}
          onDayToggle={handleDayToggle}
          onPartToggle={handlePartToggle}
          onDateChange={handleDateChange}
          availableTimeframes={availableTimeframes}
          dataRetention={dataRetention}
          sessionParts={displayParts}
        />
      </CardContent>
    </Card>
  );
}

function FilterContent({ 
  filters, 
  onTimeframeChange, 
  onSessionTypeChange, 
  onDayToggle,
  onPartToggle,
  onDateChange,
  availableTimeframes = TIMEFRAME_PRESETS,
  dataRetention = null,
  sessionParts = []
}) {
  const { openUpgradeModal } = useUpgrade();
  const { timeframe, startDate, endDate, sessionType, daysOfWeek = [], sessionParts: selectedParts = [] } = filters;

  // Handle timeframe selection - open upgrade modal if selecting disabled option
  const handleTimeframeSelect = (value, isDisabled) => {
    if (isDisabled) {
      openUpgradeModal();
      return;
    }
    onTimeframeChange(value);
  };

  // Get the current timeframe label
  const currentTimeframeLabel = availableTimeframes.find(t => t.value === timeframe)?.label || 'Select timeframe';

  return (
    <div className="space-y-4">
      {/* Time Period */}
      <div>
        <Label className="text-sm text-slate-600 mb-2 block">Time Period</Label>
        <Select value={timeframe} onValueChange={(val) => {
          const preset = availableTimeframes.find(p => p.value === val);
          if (preset?.disabled) {
            openUpgradeModal();
          } else {
            onTimeframeChange(val);
          }
        }}>
          <SelectTrigger data-testid="timeframe-select">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            {availableTimeframes.map(preset => (
              <SelectItem 
                key={preset.value} 
                value={preset.value}
                className={preset.disabled ? 'opacity-60 cursor-pointer' : ''}
              >
                <span className="flex items-center gap-2">
                  {preset.disabled && <Lock className="w-3 h-3 text-amber-500" />}
                  <span className={preset.disabled ? 'text-amber-600' : ''}>
                    {preset.disabled ? preset.lockedLabel : preset.label}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dataRetention?.is_limited && (
          <p className="text-xs text-slate-500 mt-1">
            Your {dataRetention.tier} plan shows data from the last {dataRetention.months_limit} months. 
            <button 
              onClick={openUpgradeModal}
              className="text-blue-600 hover:underline ml-1"
            >
              Upgrade for more
            </button>
          </p>
        )}
      </div>

      {/* Custom Date Range */}
      {timeframe === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onDateChange('startDate', e.target.value)}
              data-testid="filter-start-date"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onDateChange('endDate', e.target.value)}
              data-testid="filter-end-date"
            />
          </div>
        </div>
      )}

      {/* Session Type */}
      <div>
        <Label className="text-sm text-slate-600 mb-2 block">Session Type</Label>
        <Select value={sessionType} onValueChange={onSessionTypeChange}>
          <SelectTrigger data-testid="session-type-select">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {SESSION_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Days of Week */}
      <div>
        <Label className="text-sm text-slate-600 mb-2 block">Days of Week</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(day => (
            <label 
              key={day.value}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer select-none text-sm
                transition-colors
                ${daysOfWeek.includes(day.value) 
                  ? 'bg-blue-100 border-blue-300 text-blue-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }
              `}
            >
              <Checkbox
                checked={daysOfWeek.includes(day.value)}
                onCheckedChange={() => onDayToggle(day.value)}
                className="sr-only"
                data-testid={`filter-day-${day.value}`}
              />
              {day.label.slice(0, 3)}
            </label>
          ))}
        </div>
        {daysOfWeek.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            Showing sessions on: {daysOfWeek.map(d => 
              DAYS_OF_WEEK.find(day => day.value === d)?.label
            ).join(', ')}
          </p>
        )}
      </div>

      {/* Session Parts */}
      {sessionParts.length > 0 && (
        <div>
          <Label className="text-sm text-slate-600 mb-2 block flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Session Parts
          </Label>
          <div className="flex flex-wrap gap-2">
            {sessionParts.map(part => {
              const partName = part.name || part;
              const isSelected = selectedParts.includes(partName);
              return (
                <label 
                  key={partName}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer select-none text-sm
                    transition-colors
                    ${isSelected 
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }
                  `}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onPartToggle(partName)}
                    className="sr-only"
                    data-testid={`filter-part-${partName.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  {partName}
                </label>
              );
            })}
          </div>
          {selectedParts.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              Showing sessions with: {selectedParts.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to apply filters to sessions
// Returns { sessions: filtered sessions, partFilteredEvents: events filtered by part (if part filter active) }
export function applySessionFilters(sessions, filters, returnPartFilteredData = false) {
  const { timeframe, startDate, endDate, sessionType, daysOfWeek = [], sessionParts: selectedParts = [] } = filters;
  let result = [...sessions];

  // Apply timeframe filter
  const now = new Date();
  if (timeframe === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      return sessionDate >= weekAgo;
    });
  } else if (timeframe === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      return sessionDate >= monthStart;
    });
  } else if (timeframe === '3months') {
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      return sessionDate >= threeMonthsAgo;
    });
  } else if (timeframe === '6months') {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      return sessionDate >= sixMonthsAgo;
    });
  } else if (timeframe === 'year') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      return sessionDate >= yearStart;
    });
  } else if (timeframe === 'custom' && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      return sessionDate >= start && sessionDate <= end;
    });
  }

  // Apply session type filter
  if (sessionType && sessionType !== 'all') {
    result = result.filter(s => {
      const context = s.observation_context || s.observationContext || 'training';
      return context === sessionType;
    });
  }

  // Apply days of week filter
  if (daysOfWeek.length > 0) {
    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    
    result = result.filter(s => {
      const sessionDate = new Date(s.date || s.created_at || s.createdAt);
      const dayName = dayNameMap[sessionDate.getDay()];
      return daysOfWeek.includes(dayName);
    });
  }

  // Apply session parts filter - filter sessions that contain the selected parts
  if (selectedParts.length > 0) {
    result = result.filter(s => {
      // Get parts from the session (could be in different formats)
      const parts = s.session_parts || s.sessionParts || s.parts || [];
      
      // Check if any of the selected parts were used in this session
      return selectedParts.some(selectedPart => {
        return parts.some(part => {
          const partName = part.name || part.part_name || part;
          // Check if the part was used (has used=true or has startTime/endTime)
          const wasUsed = part.used === true || (part.startTime && part.endTime);
          return wasUsed && partName.toLowerCase() === selectedPart.toLowerCase();
        });
      });
    });
  }

  return result;
}

// Helper function to filter events by session parts
// Returns only the events that occurred during the selected parts
export function filterEventsByParts(session, selectedParts) {
  if (!selectedParts || selectedParts.length === 0) {
    return session.events || [];
  }
  
  const parts = session.session_parts || session.sessionParts || session.parts || [];
  const events = session.events || [];
  
  // Find the part IDs that match the selected part names
  const selectedPartIds = parts
    .filter(part => {
      const partName = part.name || part.part_name || part;
      const wasUsed = part.used === true || (part.startTime && part.endTime);
      return wasUsed && selectedParts.some(sp => sp.toLowerCase() === partName.toLowerCase());
    })
    .map(part => part.id);
  
  // Filter events that belong to the selected parts
  return events.filter(event => {
    // If event has a sessionPartId, check if it's in our selected parts
    if (event.sessionPartId) {
      return selectedPartIds.includes(event.sessionPartId);
    }
    // If event has timestamp information, check if it falls within any selected part's time range
    if (event.timestamp || event.time) {
      const eventTime = event.timestamp || event.time;
      return parts.some(part => {
        const partName = part.name || part.part_name || part;
        if (!selectedParts.some(sp => sp.toLowerCase() === partName.toLowerCase())) {
          return false;
        }
        const startTime = part.startTime || part.start_time;
        const endTime = part.endTime || part.end_time;
        if (startTime && endTime) {
          return eventTime >= startTime && eventTime <= endTime;
        }
        return false;
      });
    }
    return false;
  });
}

// Helper to calculate analytics from filtered data with part-specific filtering
export function calculateFilteredAnalytics(sessions, selectedParts = []) {
  // Filter for sessions that have actual data (events, or are marked as completed, or have ball rolling time)
  // Don't strictly require status === 'completed' as some sessions may not have this field
  const validSessions = sessions.filter(s => {
    const hasEvents = (s.events || []).length > 0;
    const isCompleted = s.status === 'completed';
    const hasBallTime = (s.ball_rolling_time || s.ballRollingTime || 0) > 0;
    return hasEvents || isCompleted || hasBallTime;
  });
  
  if (validSessions.length === 0) {
    // If no valid sessions, still return the count of all sessions passed in
    // This handles the case where sessions exist but don't have events yet
    return {
      total_sessions: sessions.length,
      total_interventions: 0,
      avg_per_session: 0,
      avg_ball_rolling: 0,
      intervention_chart_data: [],
      variety_percentage: 0,
      most_common_pattern: null
    };
  }
  
  let totalInterventions = 0;
  let totalBallRolling = 0;
  let totalBallStopped = 0;
  const interventionCounts = {};
  
  validSessions.forEach(session => {
    // If session parts filter is active, only count events from those parts
    const events = selectedParts.length > 0 
      ? filterEventsByParts(session, selectedParts)
      : (session.events || []);
    
    totalInterventions += events.length;
    
    // For ball rolling time, if filtering by parts, calculate only for those parts
    if (selectedParts.length > 0) {
      const parts = session.session_parts || session.sessionParts || session.parts || [];
      parts.forEach(part => {
        const partName = part.name || part.part_name || part;
        if (selectedParts.some(sp => sp.toLowerCase() === partName.toLowerCase())) {
          const wasUsed = part.used === true || (part.startTime && part.endTime);
          if (wasUsed) {
            // Use camelCase field names (ballRollingTime) as that's what the data uses
            const partBallRolling = part.ballRollingTime ?? part.ball_rolling_time ?? 0;
            const partBallStopped = part.ballNotRollingTime ?? part.ball_not_rolling_time ?? 0;
            totalBallRolling += partBallRolling;
            totalBallStopped += partBallStopped;
          }
        }
      });
    } else {
      totalBallRolling += session.ball_rolling_time || session.ballRollingTime || 0;
      totalBallStopped += session.ball_not_rolling_time || session.ballNotRollingTime || 0;
    }
    
    events.forEach(event => {
      const typeName = event.eventTypeName || event.eventTypeId || 'Unknown';
      interventionCounts[typeName] = (interventionCounts[typeName] || 0) + 1;
    });
  });
  
  const avgPerSession = completedSessions.length > 0 
    ? Math.round(totalInterventions / completedSessions.length * 10) / 10 
    : 0;
  const totalDuration = totalBallRolling + totalBallStopped;
  const avgBallRolling = totalDuration > 0 ? Math.round((totalBallRolling / totalDuration) * 100) : 0;
  
  // Build intervention chart data
  const chartData = Object.entries(interventionCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalInterventions > 0 ? Math.round((count / totalInterventions) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
  
  // Calculate variety score
  let varietyPercentage = 0;
  const numTypes = Object.keys(interventionCounts).length;
  
  if (numTypes > 1 && totalInterventions > 0) {
    let shannonEntropy = 0;
    Object.values(interventionCounts).forEach(count => {
      if (count > 0) {
        const p = count / totalInterventions;
        shannonEntropy -= p * Math.log(p);
      }
    });
    const maxEntropy = Math.log(numTypes);
    if (maxEntropy > 0) {
      varietyPercentage = Math.round((shannonEntropy / maxEntropy) * 100);
    }
  }
  
  // Find most common pattern
  const sortedCombos = Object.entries(interventionCounts).sort((a, b) => b[1] - a[1]);
  let mostCommonPattern = null;
  if (sortedCombos.length > 0) {
    mostCommonPattern = {
      pattern: sortedCombos[0][0],
      count: sortedCombos[0][1]
    };
  }
  
  return {
    total_sessions: completedSessions.length,
    total_interventions: totalInterventions,
    avg_per_session: avgPerSession,
    avg_ball_rolling: avgBallRolling,
    intervention_chart_data: chartData,
    variety_percentage: varietyPercentage,
    most_common_pattern: mostCommonPattern
  };
}

export default SessionFilters;
