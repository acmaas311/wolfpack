/**
 * useTabGuard — detects when multiple browser tabs have the app open.
 *
 * Each tab registers itself in localStorage with a timestamp (heartbeat).
 * Every HEARTBEAT_MS it refreshes its timestamp and prunes stale entries.
 * It also reacts instantly to changes made by other tabs via the 'storage' event.
 *
 * Returns: `multipleOpen: boolean` — true when more than one tab is live.
 * All affected tabs see multipleOpen=true. When one closes, the rest
 * receive a storage event and unblock within milliseconds.
 */

import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'wolfpack-tab-registry';
const HEARTBEAT_MS = 4000;   // refresh own timestamp this often
const STALE_MS = 12000;      // tabs silent longer than this are considered dead

function readRegistry() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeRegistry(reg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reg));
  } catch {
    // localStorage blocked or full — fail silently
  }
}

export function useTabGuard() {
  // Stable tab ID: timestamp + 6-char random suffix, e.g. "1709820000000-a3f9k2"
  const tabId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;
  const [multipleOpen, setMultipleOpen] = useState(false);

  useEffect(() => {
    function tick() {
      const now = Date.now();

      // Read registry, prune dead tabs, update our own heartbeat
      const raw = readRegistry();
      const alive = {};
      for (const [id, ts] of Object.entries(raw)) {
        if (now - ts < STALE_MS) {
          alive[id] = ts;
        }
      }
      alive[tabId] = now; // always refresh ourselves
      writeRegistry(alive);

      setMultipleOpen(Object.keys(alive).length > 1);
    }

    // Run immediately so detection is instant on mount
    tick();
    const interval = setInterval(tick, HEARTBEAT_MS);

    // React instantly when another tab writes to localStorage
    function onStorage(e) {
      if (e.key === STORAGE_KEY) tick();
    }
    window.addEventListener('storage', onStorage);

    // Remove ourselves when the tab closes
    function deregister() {
      const reg = readRegistry();
      delete reg[tabId];
      writeRegistry(reg);
    }
    // 'beforeunload' fires on close/refresh; 'pagehide' is the iOS Safari fallback
    window.addEventListener('beforeunload', deregister);
    window.addEventListener('pagehide', deregister);

    return () => {
      deregister();
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', deregister);
      window.removeEventListener('pagehide', deregister);
    };
  }, [tabId]);

  return multipleOpen;
}
