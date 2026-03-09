/**
 * Observation Templates API
 * Handles CRUD operations for observation window templates
 */

import { safeGet, safePost, safePut, safeDelete } from './safeFetch';
import { clearSessionPartsCache } from './sessionPartsApi';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Fetch all observation templates for the organization
 * @param {string} observationContext - Optional filter: 'training' or 'game'
 * @returns {Promise<Array>} List of observation templates
 */
export async function fetchObservationTemplates(observationContext = null) {
  let url = `${API_URL}/api/observation-templates`;
  if (observationContext) {
    url += `?observation_context=${observationContext}`;
  }
  
  const result = await safeGet(url);
  if (result.ok && result.data) {
    return result.data.map(toFrontendFormat);
  }
  return [];
}

/**
 * Fetch a specific observation template by ID
 * @param {string} templateId
 * @returns {Promise<Object|null>}
 */
export async function fetchObservationTemplate(templateId) {
  const result = await safeGet(`${API_URL}/api/observation-templates/${templateId}`);
  if (result.ok && result.data) {
    return toFrontendFormat(result.data);
  }
  return null;
}

/**
 * Fetch the default observation template for a context
 * @param {string} observationContext - 'training' or 'game'
 * @returns {Promise<Object|null>}
 */
export async function fetchDefaultObservationTemplate(observationContext = 'training') {
  const result = await safeGet(`${API_URL}/api/observation-templates/default/${observationContext}`);
  if (result.ok && result.data) {
    return toFrontendFormat(result.data);
  }
  return null;
}

/**
 * Create a new observation template
 * @param {Object} template - Template data
 * @returns {Promise<Object|null>}
 */
export async function createObservationTemplate(template) {
  const backendData = toBackendFormat(template);
  const result = await safePost(`${API_URL}/api/observation-templates`, backendData);
  if (result.ok && result.data) {
    // Clear session parts cache since template parts may have changed
    clearSessionPartsCache();
    return toFrontendFormat(result.data);
  }
  throw new Error(result.error || 'Failed to create template');
}

/**
 * Update an existing observation template
 * @param {string} templateId
 * @param {Object} updates - Partial template data
 * @returns {Promise<Object|null>}
 */
export async function updateObservationTemplate(templateId, updates) {
  const backendData = toBackendFormat(updates, true);
  const result = await safePut(`${API_URL}/api/observation-templates/${templateId}`, backendData);
  if (result.ok && result.data) {
    // Clear session parts cache since template parts may have changed
    clearSessionPartsCache();
    return toFrontendFormat(result.data);
  }
  throw new Error(result.error || 'Failed to update template');
}

/**
 * Delete an observation template
 * @param {string} templateId
 * @returns {Promise<boolean>}
 */
export async function deleteObservationTemplate(templateId) {
  const result = await safeDelete(`${API_URL}/api/observation-templates/${templateId}`);
  return result.ok;
}

/**
 * Set a template as the default for its context
 * @param {string} templateId
 * @returns {Promise<boolean>}
 */
export async function setDefaultObservationTemplate(templateId) {
  const result = await safePost(`${API_URL}/api/observation-templates/${templateId}/set-default`);
  return result.ok;
}

/**
 * Convert backend template format to frontend format
 */
function toFrontendFormat(backendTemplate) {
  if (!backendTemplate) return null;
  
  return {
    id: backendTemplate.template_id,
    templateId: backendTemplate.template_id,
    name: backendTemplate.name,
    description: backendTemplate.description,
    observationContext: backendTemplate.observation_context,
    interventionTypes: (backendTemplate.intervention_types || []).map(it => ({
      id: it.id,
      name: it.name,
      color: it.color || 'yellow'
    })),
    // Also provide as eventTypes for compatibility
    eventTypes: (backendTemplate.intervention_types || []).map(it => ({
      id: it.id,
      name: it.name,
      color: it.color || 'yellow'
    })),
    descriptorGroup1: backendTemplate.descriptor_group1 ? {
      id: backendTemplate.descriptor_group1.id,
      name: backendTemplate.descriptor_group1.name,
      color: backendTemplate.descriptor_group1.color || 'blue',
      descriptors: (backendTemplate.descriptor_group1.descriptors || []).map(d => ({
        id: d.id,
        name: d.name
      }))
    } : { id: 'group1', name: 'Group 1', color: 'blue', descriptors: [] },
    descriptorGroup2: backendTemplate.descriptor_group2 ? {
      id: backendTemplate.descriptor_group2.id,
      name: backendTemplate.descriptor_group2.name,
      color: backendTemplate.descriptor_group2.color || 'green',
      descriptors: (backendTemplate.descriptor_group2.descriptors || []).map(d => ({
        id: d.id,
        name: d.name
      }))
    } : { id: 'group2', name: 'Group 2', color: 'green', descriptors: [] },
    sessionParts: (backendTemplate.session_parts || []).map(p => ({
      id: p.id,
      name: p.name,
      order: p.order,
      isDefault: p.isDefault || false
    })),
    isDefault: backendTemplate.is_default || false,
    createdBy: backendTemplate.created_by,
    organizationId: backendTemplate.organization_id,
    createdAt: backendTemplate.created_at,
    updatedAt: backendTemplate.updated_at
  };
}

/**
 * Convert frontend template format to backend format
 * @param {Object} frontendTemplate
 * @param {boolean} isPartial - Whether this is a partial update
 */
function toBackendFormat(frontendTemplate, isPartial = false) {
  const data = {};
  
  if (frontendTemplate.name !== undefined) {
    data.name = frontendTemplate.name;
  }
  if (frontendTemplate.description !== undefined) {
    data.description = frontendTemplate.description;
  }
  if (frontendTemplate.observationContext !== undefined) {
    data.observation_context = frontendTemplate.observationContext;
  }
  if (frontendTemplate.interventionTypes !== undefined || frontendTemplate.eventTypes !== undefined) {
    const types = frontendTemplate.interventionTypes || frontendTemplate.eventTypes || [];
    data.intervention_types = types.map(it => ({
      id: it.id,
      name: it.name,
      color: it.color || 'yellow'
    }));
  }
  if (frontendTemplate.descriptorGroup1 !== undefined) {
    data.descriptor_group1 = {
      id: frontendTemplate.descriptorGroup1.id,
      name: frontendTemplate.descriptorGroup1.name,
      color: frontendTemplate.descriptorGroup1.color || 'blue',
      descriptors: (frontendTemplate.descriptorGroup1.descriptors || []).map(d => ({
        id: d.id,
        name: d.name
      }))
    };
  }
  if (frontendTemplate.descriptorGroup2 !== undefined) {
    data.descriptor_group2 = {
      id: frontendTemplate.descriptorGroup2.id,
      name: frontendTemplate.descriptorGroup2.name,
      color: frontendTemplate.descriptorGroup2.color || 'green',
      descriptors: (frontendTemplate.descriptorGroup2.descriptors || []).map(d => ({
        id: d.id,
        name: d.name
      }))
    };
  }
  if (frontendTemplate.sessionParts !== undefined) {
    data.session_parts = frontendTemplate.sessionParts.map((p, index) => ({
      id: p.id,
      name: p.name,
      order: p.order !== undefined ? p.order : index,
      isDefault: p.isDefault || false
    }));
  }
  if (frontendTemplate.isDefault !== undefined) {
    data.is_default = frontendTemplate.isDefault;
  }
  
  return data;
}
