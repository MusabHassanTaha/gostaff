'use client';
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { Site, Worker } from '@/types';
import SearchableSelect from '@/components/SearchableSelect';
import { Search, X, Truck } from 'lucide-react';

function ProjectsContent() {
  const { state: globalState, setState } = useAppState();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';
  const isEngineer = user?.role === 'engineer';
  
  const state = useMemo(() => {
    if (isAdmin) return globalState;

    // If user has explicit project assignments, filter sites
    if (user?.assignedProjectIds && user.assignedProjectIds.length > 0) {
        const mySiteIds = new Set(user.assignedProjectIds);
        const mySites = globalState.sites.filter(s => mySiteIds.has(s.id));
        
        const myWorkers = globalState.workers.filter(w => 
            (w.assignedSiteId && mySiteIds.has(w.assignedSiteId)) ||
            !w.assignedSiteId ||
            w.isEngineer
        );

        return { ...globalState, sites: mySites, workers: myWorkers };
    }

    return globalState;
  }, [globalState, isAdmin, user]);

  // Permissions
  const canAdd = isAdmin || isEngineer;
  const canEdit = isAdmin; // Engineer can only ADD, not edit/delete
  const canDelete = isAdmin;

  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const sites = useMemo(() => {
    let filteredSites = state.sites;
    
    // Engineer Restriction: Removed - Engineer can see all projects (Read Only)
    
    return filteredSites.filter(s => s.name.includes(search) || s.location.includes(search));
  }, [state.sites, search, isEngineer, user?.username, state.workers]);

  const engineerOptions = useMemo(() => {
    return [...state.workers]
      .filter(w => w.status !== 'pending') // Only active workers can be assigned as engineers
      .sort((a, b) => (b.isEngineer ? 1 : 0) - (a.isEngineer ? 1 : 0))
      .map(w => ({
        value: w.id,
        label: `${w.name}${w.isEngineer ? ' (مهندس)' : ''} - ${w.phone || 'لا يوجد جوال'}`
      }));
  }, [state.workers]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [form, setForm] = useState<Pick<Site, 'code' | 'name' | 'location' | 'requiredSkills' | 'engineerId' | 'status' | 'statusNote'>>({
    code: '',
    name: '',
    location: '',
    requiredSkills: {},
    engineerId: undefined,
    status: 'active',
    statusNote: '',
  });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    const site = state.sites.find(s => s.id === editingId);
    if (!site) return;
    const fullReq: Record<string, number> = {};
    state.skills.forEach(sk => {
      fullReq[sk.name] = site.requiredSkills[sk.name] || 0;
    });
    setForm({
      code: site.code || '',
      name: site.name,
      location: site.location,
      requiredSkills: fullReq,
      engineerId: site.engineerId,
      status: site.status || 'active',
      statusNote: site.statusNote || '',
    });
  }, [editingId, state.sites, state.skills]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer') return;
    
    if (!form.name.trim()) return;

    // Check for duplicate project name (excluding current project)
    const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
    const isDuplicate = state.sites.some(s => s.id !== editingId && normalize(s.name) === normalize(form.name));

    if (isDuplicate) {
      alert('يوجد مشروع بنفس الاسم بالفعل. يرجى اختيار اسم آخر.');
      return;
    }

    if (isAdding) {
      const newSite: Site = {
          id: `site-${Date.now()}`,
          code: form.code,
          name: form.name,
          location: form.location,
          requiredSkills: form.requiredSkills,
          engineerId: form.engineerId,
          assignedWorkerIds: [],
          status: form.status,
          statusNote: form.statusNote,
      };
      setState(prev => ({
          ...prev,
          sites: [newSite, ...prev.sites]
      }));
      setIsAdding(false);
    } else if (editingId) {
      setState(prev => ({
        ...prev,
        sites: prev.sites.map(s => s.id === editingId ? {
          ...s,
          code: form.code,
          name: form.name,
          location: form.location,
          requiredSkills: form.requiredSkills,
          engineerId: form.engineerId,
          status: form.status,
          statusNote: form.statusNote,
          // Preserve driver info as it is managed in Drivers page
          driverId: s.driverId,
          driverTransportCount: s.driverTransportCount,
        } : s),
      }));
      setEditingId(null);
    }
    
    setForm({
      code: '',
      name: '',
      location: '',
      requiredSkills: {},
      engineerId: undefined,
      status: 'active',
      statusNote: '',
    });
  };

  const deleteProject = (id: string) => {
    if (!canDelete) return;
    if (window.confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
      setState(prev => ({
        ...prev,
        sites: prev.sites.filter(s => s.id !== id),
        workers: prev.workers.map(w => w.assignedSiteId === id ? { ...w, assignedSiteId: undefined } : w)
      }));
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 font-cairo pb-60 animate-fade-in">
      <div className="w-full max-w-[1920px] mx-auto px-4 py-8 md:p-10">
        <div className="relative flex flex-col md:flex-row md:items-center justify-center gap-4 mb-8 min-h-[3rem]">
          <h1 className="text-3xl font-bold text-gray-900 md:absolute md:right-0">إدارة المشاريع</h1>
          <div className="flex flex-wrap gap-3 justify-center">
            {canAdd && (
              <button 
                onClick={() => {
                  setIsAdding(true);
                  setEditingId(null);
                  setForm({ code: '', name: '', location: '', requiredSkills: {}, engineerId: undefined, status: 'active', statusNote: '' });
                }}
                className="px-6 py-2.5 bg-white/80 hover:bg-white text-gray-700 rounded-xl border border-gray-200 hover:border-blue-300 hover:text-blue-600 font-bold transition-all duration-300 text-sm md:text-base shadow-sm hover:shadow-md backdrop-blur-sm transform hover:-translate-y-0.5"
              >
                إضافة مشروع جديد
              </button>
            )}
            <Link href="/" className="px-6 py-2.5 bg-white/80 hover:bg-white text-gray-700 rounded-xl border border-gray-200 hover:border-blue-300 hover:text-blue-600 font-bold transition-all duration-300 text-sm md:text-base shadow-sm hover:shadow-md backdrop-blur-sm transform hover:-translate-y-0.5">لوحة التوزيع</Link>
            <Link href="/workers" className="px-6 py-2.5 bg-white/80 hover:bg-white text-gray-700 rounded-xl border border-gray-200 hover:border-blue-300 hover:text-blue-600 font-bold transition-all duration-300 text-sm md:text-base shadow-sm hover:shadow-md backdrop-blur-sm transform hover:-translate-y-0.5">العمال</Link>
          </div>
        </div>

        {editingId || isAdding ? (
          <form onSubmit={save} className="mb-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm space-y-5">
            <h2 className="text-xl font-medium text-gray-800 mb-4 border-b pb-2">{isAdding ? 'إضافة مشروع جديد' : 'تعديل المشروع'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">كود المشروع</label>
                <input className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="مثال: P-001" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المشروع</label>
                <input className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">الموقع</label>
                <input className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">المهندس المسؤول</label>
              <div className="flex gap-3">
                <SearchableSelect
                  className="flex-1"
                  placeholder="اختر مهندس..."
                  options={engineerOptions}
                  value={form.engineerId}
                  onChange={(val) => setForm({ ...form, engineerId: val })}
                />
                <button type="button" onClick={() => setForm({ ...form, engineerId: undefined })} className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors">
                  حذف الاختيار
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">الاحتياجات المطلوبة</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {state.skills.map(sk => (
                  <div key={sk.id} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-gray-600">{sk.label}</span>
                    <input
                      type="number"
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-center font-medium"
                      value={form.requiredSkills[sk.name] || 0}
                      onChange={e => setForm({
                        ...form,
                        requiredSkills: {
                          ...form.requiredSkills,
                          [sk.name]: parseInt(e.target.value) || 0,
                        },
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => { setEditingId(null); setIsAdding(false); }} className="px-6 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors">إلغاء</button>
              <button type="submit" className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium shadow-sm transition-colors">{isAdding ? 'إضافة المشروع' : 'حفظ التغييرات'}</button>
            </div>
          </form>
        ) : null}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-start gap-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-gray-800">قائمة المشاريع</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">{state.sites.length}</span>
            </div>
          <div className="relative w-full md:flex-1 md:max-w-xl">
              <input 
                type="text"
                placeholder="بحث سريع (اسم المشروع، الموقع)..." 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm pl-10 text-sm" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              {search ? (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              )}
            </div>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right border-separate border-spacing-0">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200 first:rounded-tr-lg">كود المشروع</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200">اسم المشروع</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200">المسؤول</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200">السائقين</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200">الموقع</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200">الحالة</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap w-1/3 border-b border-gray-200">الاحتياجات</th>
                  <th className="px-6 py-4 text-base font-bold text-gray-700 whitespace-nowrap border-b border-gray-200 first:rounded-tr-lg last:rounded-tl-lg">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sites.map((s, idx) => (
                  <tr key={s.id} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      {s.code ? <span className="text-sm font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">{s.code}</span> : <span className="text-gray-400 text-sm">-</span>}
                    </td>
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      <span className="font-semibold text-gray-900 text-base group-hover:text-blue-700 hover:underline transition-colors">{s.name}</span>
                    </td>
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                        {s.engineerId && (() => {
                          const eng = state.workers.find(w => w.id === s.engineerId);
                          return eng ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="text-sm font-bold text-gray-900">م. {eng.name}</span>
                              {eng.englishName && <span className="text-xs font-bold text-gray-500">{eng.englishName}</span>}
                            </div>
                          ) : null;
                        })()}
                    </td>
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      {(() => {
                        const driversToDisplay = s.assignedDrivers && s.assignedDrivers.length > 0
                          ? s.assignedDrivers
                          : (s.driverId ? [{ driverId: s.driverId, count: s.driverTransportCount || 0 }] : []);

                        if (!driversToDisplay || driversToDisplay.length === 0) {
                          return <span className="text-xs text-gray-400">لا يوجد سائقين</span>;
                        }

                        return (
                          <div className="flex flex-col gap-1">
                            {driversToDisplay.length > 1 && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5 text-gray-500" />
                                <span>عدد السائقين: {driversToDisplay.length}</span>
                              </div>
                            )}
                            {driversToDisplay.map((ad, idx) => {
                              const driver = state.workers.find((w: Worker) => w.id === ad.driverId);
                              if (!driver) return null;

                              let text = `${driver.name}${driver.englishName ? ` (${driver.englishName})` : ''} - ${driver.phone}`;
                              if (driver.driverCarType) text += ` - ${driver.driverCarType}`;
                              if (driver.driverCarPlate) text += ` - ${driver.driverCarPlate}`;
                              if (ad.count) {
                                text += ` - ينقل: ${ad.count}`;
                              } else if (typeof driver.driverCapacity === 'number') {
                                text += ` - سعة: ${driver.driverCapacity}`;
                              }

                              return (
                                <div key={idx} className="text-[11px] text-gray-500 flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5 text-gray-400" />
                                  <Link href={`/drivers?id=${driver.id}`} className="hover:text-blue-600 hover:underline transition-colors cursor-pointer">
                                    {text}
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-5 align-middle whitespace-nowrap text-gray-700 font-medium group-hover:text-gray-900 transition-colors">{s.location}</td>
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => s.status === 'stopped' && setExpandedNoteId(expandedNoteId === s.id ? null : s.id)}
                                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all border flex items-center gap-1.5 ${
                                s.status === 'archived' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                                s.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                s.status === 'stopped' ? 'bg-red-50 text-red-700 border-red-100 cursor-pointer hover:bg-red-100' :
                                'bg-green-50 text-green-700 border-green-100'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    s.status === 'archived' ? 'bg-gray-500' :
                                    s.status === 'completed' ? 'bg-blue-500' :
                                    s.status === 'stopped' ? 'bg-red-500' :
                                    'bg-green-500'
                                }`}></span>
                                {s.status === 'archived' ? 'مؤرشف' :
                                 s.status === 'completed' ? 'منتهي' :
                                 s.status === 'stopped' ? 'متوقف' :
                                 'جاري العمل'}
                            </button>
                            {expandedNoteId === s.id && s.status === 'stopped' && s.statusNote && (
                                <div className="text-xs bg-red-50 text-red-800 px-3 py-1.5 rounded-full border border-red-200 animate-in fade-in shadow-sm whitespace-nowrap">
                                    {s.statusNote}
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(s.requiredSkills).map(([name, count]) => {
                          const def = state.skills.find(sk => sk.name === name);
                          if (!count) return null;
                          return (
                            <span key={name} className={`text-xs font-medium px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${def?.color ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                              {def?.color && <span className={`w-2 h-2 rounded-full ${def.color.replace('bg-', 'bg-').replace('text-', 'text-')}`}></span>}
                              <span>{def?.label || name}</span>
                              <span className="bg-gray-100 px-1.5 rounded text-gray-700 font-medium">{count}</span>
                            </span>
                          );
                        })}
                        {Object.keys(s.requiredSkills).length === 0 && <span className="text-sm text-gray-400 italic">بدون احتياجات مسجلة</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      <div className="flex gap-2">
                        {canEdit && (
                          <button onClick={() => setEditingId(s.id)} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm">تحرير</button>
                        )}
                        {canDelete && (
                          <button onClick={() => deleteProject(s.id)} className="px-4 py-2 text-sm font-medium border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors shadow-sm">حذف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sites.length === 0 && (
                  <tr><td className="p-12 text-center text-gray-400 text-lg" colSpan={7}>لا توجد مشاريع مطابقة للبحث</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 pb-8">
          {sites.map((s) => (
            <div key={s.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {s.code && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{s.code}</span>}
                    <h3 className="font-medium text-gray-900 text-lg">{s.name}</h3>
                  </div>
                  <div className="text-gray-500 text-sm flex items-center gap-1">
                    <span>📍</span>
                    {s.location}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={() => s.status === 'stopped' && setExpandedNoteId(expandedNoteId === s.id ? null : s.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all border flex items-center gap-1.5 ${
                    s.status === 'archived' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                    s.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    s.status === 'stopped' ? 'bg-red-50 text-red-700 border-red-100 cursor-pointer hover:bg-red-100' :
                    'bg-green-50 text-green-700 border-green-100'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                        s.status === 'archived' ? 'bg-gray-500' :
                        s.status === 'completed' ? 'bg-blue-500' :
                        s.status === 'stopped' ? 'bg-red-500' :
                        'bg-green-500'
                    }`}></span>
                    {s.status === 'archived' ? 'مؤرشف' :
                     s.status === 'completed' ? 'منتهي' :
                     s.status === 'stopped' ? 'متوقف' :
                     'جاري العمل'}
                  </button>
                </div>
              </div>

              {expandedNoteId === s.id && s.status === 'stopped' && s.statusNote && (
                  <div className="text-xs bg-red-50 text-red-800 px-3 py-2 rounded-lg border border-red-200 animate-in fade-in shadow-sm">
                      {s.statusNote}
                  </div>
              )}

              {s.engineerId && (() => {
                const eng = state.workers.find(w => w.id === s.engineerId);
                return eng ? (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xs">
                      {eng.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs text-blue-500 font-medium mb-0.5">المهندس المسؤول</div>
                      <div className="text-sm font-medium text-blue-900">{eng.name}</div>
                    </div>
                  </div>
                ) : null;
              })()}

              {(() => {
                const driversToDisplay = s.assignedDrivers && s.assignedDrivers.length > 0
                  ? s.assignedDrivers
                  : (s.driverId ? [{ driverId: s.driverId, count: s.driverTransportCount || 0 }] : []);

                if (!driversToDisplay || driversToDisplay.length === 0) return null;

                return (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-2">
                    {driversToDisplay.length > 1 && (
                      <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-gray-600" />
                        <span>عدد السائقين: {driversToDisplay.length}</span>
                      </div>
                    )}
                    {driversToDisplay.map((ad, idx) => {
                      const driver = state.workers.find((w: Worker) => w.id === ad.driverId);
                      if (!driver) return null;

                      let extra = '';
                      if (driver.phone) extra += (extra ? ' - ' : '') + driver.phone;
                      if (driver.driverCarType) extra += (extra ? ' - ' : '') + driver.driverCarType;
                      if (driver.driverCarPlate) extra += (extra ? ' - ' : '') + driver.driverCarPlate;
                      if (ad.count) {
                        extra += (extra ? ' - ' : '') + `ينقل: ${ad.count}`;
                      } else if (typeof driver.driverCapacity === 'number') {
                        extra += (extra ? ' - ' : '') + `سعة: ${driver.driverCapacity}`;
                      }

                      return (
                        <div key={idx} className="text-[11px] text-gray-700 flex items-start gap-2">
                          <Truck className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
                          <div>
                            <div className="font-medium">
                              <Link href={`/drivers?id=${driver.id}`} className="hover:text-blue-600 hover:underline transition-colors cursor-pointer">
                                {driver.name}{driver.englishName ? ` (${driver.englishName})` : ''}
                              </Link>
                            </div>
                            {extra && <div className="text-[10px] text-gray-500">{extra}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-500">الاحتياجات:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(s.requiredSkills).map(([name, count]) => {
                    const def = state.skills.find(sk => sk.name === name);
                    if (!count) return null;
                    return (
                      <span key={name} className={`text-xs font-medium px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${def?.color ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        {def?.color && <span className={`w-2 h-2 rounded-full ${def.color.replace('bg-', 'bg-').replace('text-', 'text-')}`}></span>}
                        <span>{def?.label || name}</span>
                        <span className="bg-gray-100 px-1.5 rounded text-gray-700 font-medium">{count}</span>
                      </span>
                    );
                  })}
                  {Object.keys(s.requiredSkills).length === 0 && <span className="text-sm text-gray-400 italic">بدون احتياجات مسجلة</span>}
                </div>
              </div>

              {user?.role !== 'viewer' && (
                <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <button onClick={() => setEditingId(s.id)} className="px-4 py-3 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm">
                    تحرير
                  </button>
                  <button onClick={() => deleteProject(s.id)} className="px-4 py-3 text-sm font-medium border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors shadow-sm">
                    حذف
                  </button>
                </div>
              )}
            </div>
          ))}
          {sites.length === 0 && (
            <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
              لا توجد مشاريع مطابقة للبحث
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">جاري التحميل...</div>
    </div>}>
      <ProjectsContent />
    </Suspense>
  );
}
