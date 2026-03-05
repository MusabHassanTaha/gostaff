'use client';
import { useEffect, useMemo, useState } from 'react';
import { ActivityLog } from '@/types';
import { useAuth } from '@/components/state/AuthContext';
import Link from 'next/link';

export default function ActivityPage() {
  const { user, isLoading } = useAuth();
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [qUser, setQUser] = useState('');
  const [qAction, setQAction] = useState('');
  const [qRoute, setQRoute] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/activity', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          setItems(Array.isArray(j.items) ? j.items : []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
    const toTs = to ? new Date(to).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
    return items.filter(x =>
      (!qUser || x.userId?.toLowerCase().includes(qUser.toLowerCase())) &&
      (!qAction || x.action?.toLowerCase().includes(qAction.toLowerCase())) &&
      (!qRoute || x.route?.toLowerCase().includes(qRoute.toLowerCase())) &&
      x.timestamp >= fromTs && x.timestamp <= toTs
    );
  }, [items, qUser, qAction, qRoute, from, to]);

  const users = useMemo(() => Array.from(new Set(items.map(i => i.userId).filter(Boolean))), [items]);
  const actions = useMemo(() => Array.from(new Set(items.map(i => i.action).filter(Boolean))), [items]);

  const exportCsv = () => {
    const rows = [['User', 'Action', 'Route', 'Time']];
    filtered.forEach(i => {
      rows.push([i.userId || '', i.action, i.route, new Date(i.timestamp).toLocaleString('en-GB')]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return null;
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ليس لديك صلاحية لعرض السجلات</h1>
          <Link href="/" className="text-blue-600 hover:underline font-bold">عودة للرئيسية</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">سجلات نشاط المستخدمين</h1>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">تصدير CSV</button>
            <button onClick={() => location.reload()} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-bold hover:bg-gray-300">{loading ? 'تحديث...' : 'تحديث'}</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-6 gap-3">
          <input className="px-3 py-2 rounded border border-gray-300 md:col-span-1" placeholder="المستخدم" value={qUser} onChange={e => setQUser(e.target.value)} list="users-dl" />
          <input className="px-3 py-2 rounded border border-gray-300 md:col-span-1" placeholder="العملية" value={qAction} onChange={e => setQAction(e.target.value)} list="actions-dl" />
          <input className="px-3 py-2 rounded border border-gray-300 md:col-span-2" placeholder="المسار" value={qRoute} onChange={e => setQRoute(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded border border-gray-300 md:col-span-1" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="px-3 py-2 rounded border border-gray-300 md:col-span-1" value={to} onChange={e => setTo(e.target.value)} />
          <datalist id="users-dl">{users.map(u => <option key={u} value={u} />)}</datalist>
          <datalist id="actions-dl">{actions.map(a => <option key={a} value={a} />)}</datalist>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-sm font-bold text-gray-800">المستخدم</th>
                  <th className="px-4 py-3 text-sm font-bold text-gray-800">العملية</th>
                  <th className="px-4 py-3 text-sm font-bold text-gray-800">المسار</th>
                  <th className="px-4 py-3 text-sm font-bold text-gray-800">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">{i.userId || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{i.action}</td>
                    <td className="px-4 py-3 text-gray-700">{i.route}</td>
                    <td className="px-4 py-3 text-gray-700">{new Date(i.timestamp).toLocaleString('en-GB')}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 font-bold">لا توجد سجلات مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
