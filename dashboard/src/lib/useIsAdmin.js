'use client';
import { useEffect, useState } from 'react';
import api from './api';
import { isAdminUser } from './auth';

// One /api/auth/me per page load, shared by every component that asks. Login does a full
// reload, so a different user never inherits a previous user's cached answer.
let mePromise = null;

// false until known, so admin-only controls stay hidden rather than flash for managers.
export default function useIsAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    mePromise ||= api.get('/api/auth/me').then((r) => r.data.data).catch(() => { mePromise = null; return null; });
    let live = true;
    mePromise.then((u) => { if (live) setAdmin(isAdminUser(u)); });
    return () => { live = false; };
  }, []);
  return admin;
}
