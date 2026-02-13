import { safeFetch } from './safeFetch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Fetch all reflection templates, optionally filtered by target role
 * @param {string} targetRole - Optional: 'coach_educator' or 'coach'
 */
export async function fetchReflectionTemplates(targetRole = null) {
  const url = targetRole 
    ? `${API_URL}/api/reflection-templates?target_role=${targetRole}`
    : `${API_URL}/api/reflection-templates`;
  
  const response = await safeFetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to fetch reflection templates');
  }
  
  return response.data;
}

/**
 * Get a single reflection template by ID
 * @param {string} templateId 
 */
export async function fetchReflectionTemplate(templateId) {
  const response = await safeFetch(`${API_URL}/api/reflection-templates/${templateId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to fetch reflection template');
  }
  
  return response.data;
}

/**
 * Create a new reflection template
 * @param {Object} templateData 
 * @param {string} templateData.name - Template name
 * @param {string} templateData.target_role - 'coach_educator' or 'coach'
 * @param {string} templateData.description - Optional description
 * @param {Array} templateData.questions - Array of question objects
 * @param {boolean} templateData.is_default - Whether this is the default template
 */
export async function createReflectionTemplate(templateData) {
  const response = await safeFetch(`${API_URL}/api/reflection-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData)
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to create reflection template');
  }
  
  return response.data;
}

/**
 * Update an existing reflection template
 * @param {string} templateId 
 * @param {Object} updateData 
 */
export async function updateReflectionTemplate(templateId, updateData) {
  const response = await safeFetch(`${API_URL}/api/reflection-templates/${templateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to update reflection template');
  }
  
  return response.data;
}

/**
 * Delete a reflection template
 * @param {string} templateId 
 */
export async function deleteReflectionTemplate(templateId) {
  const response = await safeFetch(`${API_URL}/api/reflection-templates/${templateId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to delete reflection template');
  }
  
  return response.data;
}

/**
 * Set a template as the default for its target role
 * @param {string} templateId 
 */
export async function setTemplateAsDefault(templateId) {
  const response = await safeFetch(`${API_URL}/api/reflection-templates/${templateId}/set-default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to set template as default');
  }
  
  return response.data;
}

/**
 * Remove default status from a template
 * @param {string} templateId 
 */
export async function unsetTemplateAsDefault(templateId) {
  const response = await safeFetch(`${API_URL}/api/reflection-templates/${templateId}/unset-default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(response.data?.detail || 'Failed to unset template as default');
  }
  
  return response.data;
}

/**
 * Generate a unique question ID
 */
export function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new question object with default values
 * @param {string} type - Question type: 'text', 'scale', 'dropdown', 'checkbox'
 */
export function createQuestion(type = 'text') {
  const baseQuestion = {
    question_id: generateQuestionId(),
    question_text: '',
    question_type: type,
    required: false
  };
  
  switch (type) {
    case 'scale':
      return {
        ...baseQuestion,
        scale_min: 1,
        scale_max: 5,
        scale_min_label: 'Poor',
        scale_max_label: 'Excellent'
      };
    case 'dropdown':
    case 'checkbox':
      return {
        ...baseQuestion,
        options: ['Option 1', 'Option 2']
      };
    default:
      return baseQuestion;
  }
}
