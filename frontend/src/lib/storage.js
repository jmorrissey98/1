// Local storage helper for "My Coach Developer"
// All data persists locally for offline-first functionality

const STORAGE_KEYS = {
  SESSIONS: 'mcd_sessions',
  TEMPLATES: 'mcd_templates',
  REFLECTION_TEMPLATES: 'mcd_reflection_templates',
  ACTIVE_SESSION: 'mcd_active_session',
  SETTINGS: 'mcd_settings',
  COACHES: 'mcd_coaches',
  CURRENT_USER: 'mcd_current_user',
  USERS: 'mcd_users',
  SESSION_PARTS_CACHE: 'mcd_session_parts_cache'
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
  { id: 'guided_discovery', name: 'Guided Discovery', color: 'yellow' },
  { id: 'transmission', name: 'Transmission', color: 'yellow' }
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

// Fallback default session parts (used when backend unavailable)
const FALLBACK_SESSION_PARTS = [
  { id: 'default_technique', name: 'Develop The Technique', order: 0, isDefault: true },
  { id: 'default_game_model', name: 'Develop The Game Model', order: 1, isDefault: true },
  { id: 'default_performance', name: 'Develop Performance', order: 2, isDefault: true },
  { id: 'default_mentality', name: 'Develop Mentality', order: 3, isDefault: true }
];

// Legacy default session parts (for backwards compatibility)
const DEFAULT_SESSION_PARTS = [
  { id: 'default_technique', name: 'Develop The Technique', order: 0, isDefault: true },
  { id: 'default_game_model', name: 'Develop The Game Model', order: 1, isDefault: true },
  { id: 'default_performance', name: 'Develop Performance', order: 2, isDefault: true },
  { id: 'default_mentality', name: 'Develop Mentality', order: 3, isDefault: true }
];

// Get default template
export const getDefaultTemplate = () => ({
  id: 'default',
  name: 'Default Template',
  // Use both property names for compatibility
  interventionTypes: DEFAULT_INTERVENTION_TYPES,
  eventTypes: DEFAULT_INTERVENTION_TYPES,
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
      let templates = data ? JSON.parse(data) : [];
      // Migrate and include default template
      templates = templates.map(migrateTemplate);
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

  // Reflection Templates
  getReflectionTemplates: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REFLECTION_TEMPLATES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveReflectionTemplate: (template) => {
    const templates = storage.getReflectionTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    localStorage.setItem(STORAGE_KEYS.REFLECTION_TEMPLATES, JSON.stringify(templates));
    return template;
  },

  deleteReflectionTemplate: (templateId) => {
    const templates = storage.getReflectionTemplates().filter(t => t.id !== templateId);
    localStorage.setItem(STORAGE_KEYS.REFLECTION_TEMPLATES, JSON.stringify(templates));
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
  },

  // Users
  getUsers: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveUser: (user) => {
    const users = storage.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return user;
  },

  getCurrentUser: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  // Planned sessions (future dated)
  getPlannedSessions: () => {
    return storage.getSessions().filter(s => s.status === 'planned');
  },

  getSessionsByDate: (date) => {
    const dateStr = new Date(date).toISOString().split('T')[0];
    return storage.getSessions().filter(s => {
      const sessionDate = s.plannedDate || s.createdAt;
      return sessionDate?.split('T')[0] === dateStr;
    });
  }
};

// Create a new session object
export const createSession = (name, template = null, coachId = null, options = {}) => {
  const tmpl = migrateTemplate(template || getDefaultTemplate());
  const now = new Date().toISOString();
  const interventions = tmpl.interventionTypes || tmpl.eventTypes || DEFAULT_INTERVENTION_TYPES;
  
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || `Session ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    status: options.planned ? 'planned' : 'draft', // planned, draft, active, completed
    
    // Observation context
    observationContext: options.observationContext || OBSERVATION_CONTEXTS.TRAINING,
    
    // Planned session date (for future sessions)
    plannedDate: options.plannedDate || null,
    
    // Coach reference (optional - null for one-off sessions)
    coachId: coachId,
    
    // Configuration (from template) - renamed to interventionTypes
    interventionTypes: [...interventions],
    // Keep eventTypes for backward compatibility
    eventTypes: [...interventions],
    descriptorGroup1: { ...tmpl.descriptorGroup1, descriptors: [...tmpl.descriptorGroup1.descriptors] },
    descriptorGroup2: { ...tmpl.descriptorGroup2, descriptors: [...tmpl.descriptorGroup2.descriptors] },
    sessionParts: tmpl.sessionParts.map(p => ({
      ...p,
      startTime: null,
      endTime: null,
      ballRollingTime: 0,
      ballNotRollingTime: 0,
      used: false
    })),
    
    // Runtime data
    startTime: null,
    endTime: null,
    totalDuration: 0,
    activePartId: tmpl.sessionParts[0]?.id || null,
    ballRolling: false,
    ballRollingTime: 0,
    ballNotRollingTime: 0,
    
    // Interventions log (renamed from events)
    events: [],
    
    // Ball rolling state changes log
    ballRollingLog: [],
    
    // Reflections
    observerReflections: [], // Array of { id, text, timestamp, author: 'observer' }
    coachReflections: [], // Array of { id, text, timestamp, author: 'coach' }
    
    // Session notes (legacy - kept for compatibility)
    sessionNotes: '',
    
    // AI-generated summary
    aiSummary: '',
    
    // Attachments (file references)
    attachments: [] // Array of { id, name, type, size, uploadedAt, url }
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
    email: '',
    notes: '', // General notes about the coach
    
    // Profile photo (base64 or URL)
    photoUrl: null,
    
    // Development targets
    targets: [], // Array of { id, text, status: 'active' | 'achieved', createdAt, ageGroup }
    
    // Intervention style targets (optional)
    interventionTargets: [], // Array of { id, interventionType, targetPercentage, ageGroup, enabled }
    
    // AI-generated trend summary
    aiTrendSummary: '',
    aiTrendSummaryDate: null,
    
    // Attachments (file references)
    attachments: [], // Array of { id, name, type, size, uploadedAt, url }
    
    // Linked user account (for coach view)
    userId: null
  };
};

// Create a user profile
export const createUser = (name, role = USER_ROLES.COACH_DEVELOPER) => {
  const now = new Date().toISOString();
  
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || 'User',
    createdAt: now,
    role: role, // coach_developer or coach
    linkedCoachId: null // For coach role, links to their coach profile
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
