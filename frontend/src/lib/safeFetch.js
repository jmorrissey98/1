// Safe fetch utilities to prevent "body stream already read" errors

/**
 * Safely fetch and parse JSON response
 * Handles network errors gracefully and prevents body stream issues
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any, networkError?: boolean, rawText?: string}>}
 */
export async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Read response text once
    let data = null;
    let rawText = '';
    
    try {
      rawText = await response.text();
    } catch (readError) {
      console.warn('Failed to read response body:', readError);
      rawText = '';
    }
    
    // Parse JSON if we have content
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        // Not JSON - create structured error with detail field
        data = { detail: rawText, message: rawText };
      }
    } else {
      // Empty response
      data = response.ok ? {} : { detail: `Request failed with status ${response.status}` };
    }
    
    // Ensure data always has a detail field for error responses
    if (!response.ok && data && !data.detail) {
      data.detail = data.message || data.error || `Request failed with status ${response.status}`;
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      rawText
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        data: { detail: 'Request timed out. Please try again.' },
        networkError: true
      };
    }
    
    // Network errors (CORS, offline, DNS, etc.)
    console.error('Network error:', error.message, url);
    return {
      ok: false,
      status: 0,
      data: { detail: `Network error: ${error.message}` },
      networkError: true
    };
  }
}

/**
 * POST request with JSON body
 */
export async function safePost(url, body, extraOptions = {}) {
  return safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    ...extraOptions
  });
}

/**
 * GET request
 */
export async function safeGet(url, extraOptions = {}) {
  return safeFetch(url, {
    method: 'GET',
    credentials: 'include',
    ...extraOptions
  });
}

/**
 * DELETE request
 */
export async function safeDelete(url, extraOptions = {}) {
  return safeFetch(url, {
    method: 'DELETE',
    credentials: 'include',
    ...extraOptions
  });
}

/**
 * PUT request with JSON body
 */
export async function safePut(url, body, extraOptions = {}) {
  return safeFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    ...extraOptions
  });
}
