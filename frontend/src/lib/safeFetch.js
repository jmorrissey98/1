// Safe fetch utilities to prevent "body stream already read" errors

/**
 * Safely fetch and parse JSON response
 * Handles network errors gracefully and prevents body stream issues
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any, networkError?: boolean}>}
 */
export async function safeFetch(url, options = {}) {
  // Add abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Read the response text once (avoid body stream issues)
    let data = null;
    try {
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          // Response is not JSON, store as raw text
          data = { message: text };
        }
      }
    } catch (readError) {
      console.warn('Failed to read response body:', readError);
      data = null;
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      console.error('Request timed out:', url);
      return {
        ok: false,
        status: 408,
        data: { detail: 'Request timed out. Please try again.' },
        networkError: true
      };
    }
    
    // Network errors (CORS, offline, etc.)
    console.error('Network error:', error.message, url);
    return {
      ok: false,
      status: 0,
      data: { detail: 'Unable to connect to server. Please check your connection and try again.' },
      networkError: true
    };
  }
}

/**
 * POST request with JSON body
 * @param {string} url - The URL to fetch
 * @param {object} body - The body to send
 * @param {object} extraOptions - Extra fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
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
 * @param {string} url - The URL to fetch
 * @param {object} extraOptions - Extra fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
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
 * @param {string} url - The URL to fetch
 * @param {object} extraOptions - Extra fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
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
 * @param {string} url - The URL to fetch
 * @param {object} body - The body to send
 * @param {object} extraOptions - Extra fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
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
