/**
 * employees.js — Phase 9: Centralized employee fetching helper
 *
 * Fetches ALL employees from /api/employees by paginating through every
 * page until the response's `pages` counter is exhausted. The backend
 * returns `{ success, data, total, page, pages }`.
 *
 * Usage:
 *   import { getAllEmployees } from '@/lib/employees';
 *   const employees = await getAllEmployees(api);
 *
 * Options:
 *   params  — additional query params forwarded to /api/employees
 *             (e.g. { search: 'foo' }). Pagination is managed internally.
 *   limit   — records per request (default 200, same as backend default).
 *             Lowering this increases the number of requests; raising it
 *             reduces them. The backend caps at whatever it wants —
 *             we follow the actual `pages` count in each response.
 *
 * Error policy:
 *   If a page request fails we throw the error so callers can distinguish
 *   between "no employees" and "fetch failed / incomplete list". Callers
 *   that want graceful degradation should catch and handle accordingly.
 *
 * Deduplication:
 *   Each employee is keyed by its MongoDB `_id` string. Duplicates that
 *   may arise from an overlapping page boundary (edge-case under concurrent
 *   writes) are removed before the array is returned.
 */

const PAGE_LIMIT = 200; // match the backend's own default for efficiency

/**
 * Fetch every employee visible to the authenticated user.
 *
 * @param {import('axios').AxiosInstance} apiInstance  Configured axios instance
 * @param {object}                        options
 * @param {object}                        [options.params]  Extra query params
 * @param {number}                        [options.limit]   Page size (default 200)
 * @returns {Promise<object[]>}
 */
export async function getAllEmployees(apiInstance, options = {}) {
  const { params: extraParams = {}, limit = PAGE_LIMIT } = options;

  // ── Page 1 ──────────────────────────────────────────────────────────────
  const firstRes = await apiInstance.get('/api/employees', {
    params: { ...extraParams, page: 1, limit },
  });

  const firstData = firstRes.data;
  if (!firstData || firstData.success === false || !Array.isArray(firstData.data)) {
    throw new Error(firstData?.error || 'Failed to fetch employee list (page 1)');
  }

  const totalPages = firstData?.pages ?? 1;
  const seen = new Set();
  const all = [];

  function merge(records) {
    for (const rec of records || []) {
      const key = rec?._id?.toString();
      if (key && !seen.has(key)) {
        seen.add(key);
        all.push(rec);
      }
    }
  }

  merge(firstData.data);

  // ── Remaining pages (sequential, avoid hammering the server) ──────────
  for (let p = 2; p <= totalPages; p++) {
    const pageRes = await apiInstance.get('/api/employees', {
      params: { ...extraParams, page: p, limit },
    });
    const pageData = pageRes.data;
    if (!pageData || pageData.success === false || !Array.isArray(pageData.data)) {
      throw new Error(pageData?.error || `Failed to fetch employee list (page ${p} of ${totalPages})`);
    }
    merge(pageData.data);
  }

  return all;
}

/**
 * Convenience wrapper: same as getAllEmployees but safely returns []
 * on any failure while logging the error, ensuring that incomplete
 * pagination or API failures are NEVER presented as a complete list.
 *
 * @param {import('axios').AxiosInstance} apiInstance
 * @param {object}                        [options]
 * @returns {Promise<object[]>}
 */
export async function getAllEmployeesSafe(apiInstance, options = {}) {
  try {
    return await getAllEmployees(apiInstance, options);
  } catch (err) {
    console.error('getAllEmployeesSafe failed to load complete employee list:', err.message || err);
    return [];
  }
}

