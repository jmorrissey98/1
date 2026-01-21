// Local storage helper for "My Coach Developer"
// All data persists locally for offline-first functionality

const STORAGE_KEYS = {
  SESSIONS: 'mcd_sessions',
  TEMPLATES: 'mcd_templates',
  ACTIVE_SESSION: 'mcd_active_session',
  SETTINGS: 'mcd_settings',
  COACHES: 'mcd_coaches',
  CURRENT_USER: 'mcd_current_user',
  USERS: 'mcd_users'
};

// Observation contexts
export const OBSERVATION_CONTEXTS = {
  TRAINING: 'training',
  GAME: 'game'
};

// User roles
export const USER_ROLES = {
  COACH_DEVELOPER: 'coach_developer',
  COACH: 'coach'
};

// Default coach intervention types (yellow buttons) - renamed from "events"
const DEFAULT_INTERVENTION_TYPES = [
  { id: 'command', name: 'Command', color: 'yellow' },
  { id: 'qa', name: 'Q&A', color: 'yellow' },
  { id: 'guided_discovery', name: 'Guided Discovery', color: 'yellow' }
];

// Default descriptor groups
const DEFAULT_DESCRIPTOR_GROUP_1 = {
  id: 'content_focus',
  name: 'Content Focus',
  color: 'blue',
  descriptors: [
    { id: 'technical', name: 'Technical' },
    { id: 'tactical', name: 'Tactical' },
    { id: 'physical', name: 'Physical' },
    { id: 'psych', name: 'Psych' },
    { id: 'social', name: 'Social' }
  ]
};

const DEFAULT_DESCRIPTOR_GROUP_2 = {
  id: 'delivery_method',
  name: 'Delivery Method',
  color: 'green',
  descriptors: [
    { id: 'visual_demo', name: 'Visual Demo' },
    { id: 'triggers', name: 'Triggers' },
    { id: 'kinesthetic', name: 'Kinesthetic' }
  ]
};

// Default session parts
const DEFAULT_SESSION_PARTS = [
  { id: 'part1', name: 'Part 1', order: 0 },
  { id: 'part2', name: 'Part 2', order: 1 },
  { id: 'part3', name: 'Part 3', order: 2 },
  { id: 'part4', name: 'Part 4', order: 3 }
];

// Get default template
export const getDefaultTemplate = () => ({
  id: 'default',
  name: 'Default Template',
  interventionTypes: DEFAULT_INTERVENTION_TYPES,
  descriptorGroup1: DEFAULT_DESCRIPTOR_GROUP_1,
  descriptorGroup2: DEFAULT_DESCRIPTOR_GROUP_2,
  sessionParts: DEFAULT_SESSION_PARTS
});

// Backward compatibility - map old eventTypes to interventionTypes
const migrateTemplate = (template) => {
  if (template.eventTypes && !template.interventionTypes) {
    return { ...template, interventionTypes: template.eventTypes };
  }
  return template;
};

// Storage operations
export const storage = {
  // Sessions
  getSessions: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveSession: (session) => {
    const sessions = storage.getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    return session;
  },

  deleteSession: (sessionId) => {
    const sessions = storage.getSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  getSession: (sessionId) => {
    return storage.getSessions().find(s => s.id === sessionId);
  },

  // Templates
  getTemplates: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      const templates = data ? JSON.parse(data) : [];
      // Always include default template
      if (!templates.find(t => t.id === 'default')) {
        templates.unshift(getDefaultTemplate());
      }
      return templates;
    } catch {
      return [getDefaultTemplate()];
    }
  },

  saveTemplate: (template) => {
    const templates = storage.getTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
    return template;
  },

  deleteTemplate: (templateId) => {
    if (templateId === 'default') return; // Don't delete default
    const templates = storage.getTemplates().filter(t => t.id !== templateId);
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  },

  // Active session (for resuming)
  setActiveSession: (sessionId) => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, sessionId || '');
  },

  getActiveSession: () => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION) || null;
  },

  // Settings
  getSettings: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  saveSettings: (settings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // Coaches
  getCoaches: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COACHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCoach: (coach) => {
    const coaches = storage.getCoaches();
    const index = coaches.findIndex(c => c.id === coach.id);
    if (index >= 0) {
      coaches[index] = coach;
    } else {
      coaches.push(coach);
    }
    localStorage.setItem(STORAGE_KEYS.COACHES, JSON.stringify(coaches));
    return coach;
  },

  deleteCoach: (coachId) => {
    const coaches = storage.getCoaches().filter(c => c.id !== coachId);
    localStorage.setItem(STORAGE_KEYS.COACHES, JSON.stringify(coaches));
  },

  getCoach: (coachId) => {
    return storage.getCoaches().find(c => c.id === coachId);
  },

  getCoachSessions: (coachId) => {
    return storage.getSessions().filter(s => s.coachId === coachId);
  }
};

// Create a new session object
export const createSession = (name, template = null, coachId = null) => {
  const tmpl = template || getDefaultTemplate();
  const now = new Date().toISOString();
  
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || `Session ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    status: 'draft', // draft, active, completed
    
    // Coach reference (optional - null for one-off sessions)
    coachId: coachId,
    
    // Configuration (from template)
    eventTypes: [...tmpl.eventTypes],
    descriptorGroup1: { ...tmpl.descriptorGroup1, descriptors: [...tmpl.descriptorGroup1.descriptors] },
    descriptorGroup2: { ...tmpl.descriptorGroup2, descriptors: [...tmpl.descriptorGroup2.descriptors] },
    sessionParts: tmpl.sessionParts.map(p => ({
      ...p,
      startTime: null,
      endTime: null,
      ballRollingTime: 0,
      ballNotRollingTime: 0,
      used: false // Track if part was used during session
    })),
    
    // Runtime data
    startTime: null,
    endTime: null,
    totalDuration: 0,
    activePartId: tmpl.sessionParts[0]?.id || null,
    ballRolling: false,
    ballRollingTime: 0,
    ballNotRollingTime: 0,
    
    // Events log
    events: [],
    
    // Ball rolling state changes log
    ballRollingLog: [],
    
    // Session notes (user can add during/after observation)
    sessionNotes: '',
    
    // AI-generated summary
    aiSummary: ''
  };
};

// Create a new coach profile
export const createCoach = (name) => {
  const now = new Date().toISOString();
  
  return {
    id: `coach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || 'New Coach',
    createdAt: now,
    updatedAt: now,
    
    // Coach info
    role: '', // e.g., "U14 Head Coach"
    organization: '',
    notes: '', // General notes about the coach
    
    // Development targets
    targets: [], // Array of { id, text, status: 'active' | 'achieved', createdAt }
    
    // AI-generated trend summary
    aiTrendSummary: '',
    aiTrendSummaryDate: null
  };
};

// Create an event object
export const createEvent = (eventTypeId, eventTypeName, sessionPartId, ballRolling) => {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    eventTypeId,
    eventTypeName,
    sessionPartId,
    ballRolling,
    descriptors1: [], // IDs from descriptor group 1
    descriptors2: [], // IDs from descriptor group 2
    note: ''
  };
};

export default storage;
