import { useState } from 'react';
import { Filter, Calendar, X, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

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
  className = '' 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get available timeframes based on retention limits
  const availableTimeframes = getAvailableTimeframes(dataRetention?.months_limit);
  
  const {
    timeframe = 'all',
    startDate = '',
    endDate = '',
    sessionType = 'all',
    daysOfWeek = [] // array of selected day values
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

  const clearFilters = () => {
    onFiltersChange({
      timeframe: 'all',
      startDate: '',
      endDate: '',
      sessionType: 'all',
      daysOfWeek: []
    });
  };

  const hasActiveFilters = timeframe !== 'all' || sessionType !== 'all' || daysOfWeek.length > 0;
  const activeFilterCount = (timeframe !== 'all' ? 1 : 0) + 
                           (sessionType !== 'all' ? 1 : 0) + 
                           (daysOfWeek.length > 0 ? 1 : 0);

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
                onDateChange={handleDateChange}
                availableTimeframes={availableTimeframes}
                dataRetention={dataRetention}
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
          onDateChange={handleDateChange}
          availableTimeframes={availableTimeframes}
          dataRetention={dataRetention}
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
  onDateChange 
}) {
  const { timeframe, startDate, endDate, sessionType, daysOfWeek = [] } = filters;

  return (
    <div className="space-y-4">
      {/* Time Period */}
      <div>
        <Label className="text-sm text-slate-600 mb-2 block">Time Period</Label>
        <Select value={timeframe} onValueChange={onTimeframeChange}>
          <SelectTrigger data-testid="timeframe-select">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_PRESETS.map(preset => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
    </div>
  );
}

// Helper function to apply filters to sessions
export function applySessionFilters(sessions, filters) {
  const { timeframe, startDate, endDate, sessionType, daysOfWeek = [] } = filters;
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

  return result;
}

export default SessionFilters;
