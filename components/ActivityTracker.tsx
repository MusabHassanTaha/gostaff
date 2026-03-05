'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { useAuth } from './state/AuthContext';

export default function ActivityTracker() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    if (prev.current !== pathname) {
      prev.current = pathname;
      logActivity('view', pathname, user.username);
    }
  }, [pathname, user]);
  return null;
}
