export function logActivity(action: string, route?: string, userId?: string) {
  try {
    const r = route || (typeof window !== 'undefined' ? window.location.pathname : '/');
    let uid = userId;
    if (!uid && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('labour-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          uid = parsed?.username || '';
        }
      } catch {}
    }
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid || '', action, route: r, timestamp: Date.now() })
    }).catch(() => {});
  } catch {}
}
