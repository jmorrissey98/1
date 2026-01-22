// Safe fetch utilities to prevent "body stream already read" errors

/**
 * Safely fetch and parse JSON response
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    // Clone the response immediately in case we need to read it multiple times
    const clonedResponse = response.clone();
    
    let data = null;
    try {
      const text = await clonedResponse.text();
      data = text ? JSON.parse(text) : null;
    } catch (parseError) {
      console.warn('Failed to parse response as JSON:', parseError);
      data = null;
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
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
