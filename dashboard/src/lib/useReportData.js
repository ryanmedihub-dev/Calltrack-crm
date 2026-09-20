"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "./api";

/*
 * Data hook for the report pages (call logs, leads).
 *
 * Each page used to run `useCallback(load, [buildParams, activeTab, ...])` behind a bare
 * `useEffect(() => load(), [load])`, which had four problems that all showed up as "the page
 * takes forever after I change a filter":
 *
 *   1. Every keystroke in a filter box rebuilt `filters`, which rebuilt `load`, which fired
 *      another full report request. Typing a six-letter source name = six aggregations.
 *   2. Switching tabs fired twice — once for the new `activeTab`, once more for the
 *      `setHistPage(1)` that the tab change also triggered.
 *   3. Nothing cancelled an in-flight request, so a slow response for an old filter could
 *      land after a fast one for the new filter and overwrite the screen with stale rows.
 *   4. Nothing was cached, so flipping between two tabs re-ran both reports every time.
 *
 * This hook fixes all four: requests are debounced and coalesced, superseded ones are aborted
 * and their results discarded, and an identical (endpoint, params) request inside the TTL is
 * served from memory. `loading` is true only when there is nothing on screen yet — a refetch
 * that has stale rows to show reports `refreshing` instead, so the table never blanks out.
 */

const TTL_MS = 45 * 1000;
const MAX_ENTRIES = 60;

// Module scope: survives navigation between the report pages within a session, cleared on
// a hard reload. Mirrors the backend's own 45s report cache, so the two never disagree by
// more than one window.
const cache = new Map();

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function writeCache(key, data) {
  cache.set(key, { data, at: Date.now() });
  // Map iterates in insertion order — the first key is the oldest.
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export function invalidateReportCache() {
  cache.clear();
}

/**
 * @param {string} endpoint  e.g. "/api/reports/periodic"
 * @param {object} params    query params; MUST be memoised by the caller (useMemo)
 * @param {{debounceMs?: number}} [opts]
 * @returns {{data: any, loading: boolean, refreshing: boolean, refresh: () => void}}
 */
export function useReportData(endpoint, params, { debounceMs = 250 } = {}) {
  const key = useMemo(
    () => `${endpoint}|${JSON.stringify(params)}`,
    [endpoint, params],
  );

  const [data, setData] = useState(() => readCache(key) ?? null);
  const [loading, setLoading] = useState(() => readCache(key) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Mirrors `data` so the effect can ask "do we already have something on screen?" without
  // taking `data` as a dependency and re-running itself on every response.
  const dataRef = useRef(data);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const keyRef = useRef(key);
  keyRef.current = key;

  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  // Force a fresh fetch for the current key: evicting first means the effect below finds no
  // cache entry and refetches, so there is no separate "ignore the cache" code path.
  const refresh = useCallback(() => {
    cache.delete(keyRef.current);
    setReloadTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const cached = readCache(key);
    if (cached !== undefined) {
      dataRef.current = cached;
      setData(cached);
      setLoading(false);
      setRefreshing(false);
      return undefined;
    }

    // Keep the previous tab's rows on screen while the new ones load, rather than flashing a
    // full-page spinner on every filter tweak.
    if (dataRef.current === null) setLoading(true);
    else setRefreshing(true);

    const reqId = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await api.get(endpoint, {
          params: paramsRef.current,
          signal: ctrl.signal,
        });
        if (reqId !== reqIdRef.current) return; // a newer request has already started
        const payload = res.data?.data ?? null;
        writeCache(key, payload);
        dataRef.current = payload;
        setData(payload);
      } catch {
        if (ctrl.signal.aborted || reqId !== reqIdRef.current) return;
        dataRef.current = null;
        setData(null);
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      // Cancel whatever this pass started; the reqId guard above already makes a late
      // response harmless, this just stops paying for it.
      abortRef.current?.abort();
    };
    // `params` is deliberately absent — `key` is its content hash, so depending on the object
    // identity as well would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadTick, endpoint, debounceMs]);

  return { data, loading, refreshing, refresh };
}
