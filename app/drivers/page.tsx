 'use client';
 import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { Worker } from '@/types';
import SearchableSelect from '@/components/SearchableSelect';
import { Search, X, Edit2, Trash2, Phone, Truck, Users, Plus, CheckCircle2, Car, Activity } from 'lucide-react';
 
 export default function DriversPage() {
  const { state: globalState, setState } = useAppState();
  const { user } = useAuth();
  const isEngineer = (user?.role as string) === 'engineer';

  const state = globalState;

  // Permission check
  if ((user?.role as string) === 'engineer') {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200">
                <Users className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">عفواً، ليس لديك صلاحية للوصول لهذه الصفحة</h1>
                <p className="text-gray-600 mb-6">يرجى التواصل مع المسؤول للحصول على الصلاحيات اللازمة.</p>
                <Link href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    العودة للرئيسية
                </Link>
            </div>
        </div>
    );
  }

  const router = useRouter();
  const searchParams = useSearchParams();
  const drivers = state.workers.filter(w => w.skill === 'Driver' || w.skill === 'سائق');

  const [search, setSearch] = useState('');

  // Handle URL query params for deep linking
  useEffect(() => {
    const driverId = searchParams.get('id');
    if (driverId) {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
        setSearch(driver.name);
      }
    }
  }, [searchParams, drivers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;

    // Find sites matching the query to include their drivers
    const matchingSites = state.sites.filter(s => s.name.toLowerCase().includes(q));
    const driversInMatchingSites = new Set<string>();
    
    matchingSites.forEach(s => {
        if (s.driverId) driversInMatchingSites.add(s.driverId);
        if (s.assignedDrivers) {
            s.assignedDrivers.forEach(ad => driversInMatchingSites.add(ad.driverId));
        }
    });

    return drivers.filter(d => 
      (d.name?.toLowerCase().includes(q) ?? false) || 
      (d.phone?.includes(q) ?? false) || 
      (d.driverCarPlate?.toLowerCase().includes(q) ?? false) || 
      (d.driverCarType?.toLowerCase().includes(q) ?? false) ||
      driversInMatchingSites.has(d.id)
    );
  }, [drivers, search, state.sites]);

  const stats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter(d => {
       return state.sites.some(s => 
           s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id
       );
    }).length;
    const available = total - active;
    const withVehicle = drivers.filter(d => d.driverCarPlate).length;
    
    return { total, active, available, withVehicle };
  }, [drivers, state.sites]);
 
   const [isAdding, setIsAdding] = useState(false);
  const [searchWorker, setSearchWorker] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  const availableWorkers = useMemo(() => {
    if (!searchWorker.trim()) return [];
    const q = searchWorker.toLowerCase();
    return state.workers.filter(w => 
      (w.name.toLowerCase().includes(q) || (w.phone && w.phone.includes(q))) &&
      w.skill !== 'سائق' // Exclude existing drivers if desired, or allow them to be re-added? Assuming we want to convert worker to driver.
    ).slice(0, 5);
  }, [state.workers, searchWorker]);

  const vehicleOptions = useMemo(() => {
    return (state.vehicles || []).map(v => ({
      value: v.plateNumber,
      label: `${v.plateNumber} ${v.type ? `(${v.type})` : ''}`
    }));
  }, [state.vehicles]);

  const selectWorker = (w: Worker) => {
    setSelectedWorkerId(w.id);
    setNewName(w.name);
    setNewPhone(w.phone || '');
    setNewPlate(''); // Keep empty for new driver details
    setNewType('');
    setSearchWorker(''); // Clear search
    setShowSuggestions(false);
  };
  const [newName, setNewName] = useState('');
   const [newPhone, setNewPhone] = useState('');
   const [newPlate, setNewPlate] = useState('');
   const [newType, setNewType] = useState('');
   const [newCapacity, setNewCapacity] = useState<number>(4);
 
   const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editType, setEditType] = useState('');
  const [editCapacity, setEditCapacity] = useState<number | ''>('');
  const [editAssignments, setEditAssignments] = useState<{ siteId: string; count: number }[]>([]);

  const handleAdd = (e: React.FormEvent) => {
     e.preventDefault();
     if (user?.role === 'viewer') return;
     if (!newName.trim()) return;

     if (selectedWorkerId) {
        setState(prev => ({
            ...prev,
            workers: prev.workers.map(w => w.id === selectedWorkerId ? {
                ...w,
                skill: 'سائق',
                phone: newPhone,
                driverCarPlate: newPlate,
                driverCarType: newType,
                driverCapacity: Number(newCapacity) || 0,
            } : w)
        }));
     } else {
        const newDriver: Worker = {
          id: `w-${Date.now()}`,
          name: newName,
          skill: 'سائق',
          iqamaNumber: '',
          phone: newPhone,
          iqamaExpiry: '',
          insuranceExpiry: '',
          assignedSiteId: undefined,
          driverCarPlate: newPlate,
          driverCarType: newType,
          driverCapacity: Number(newCapacity) || 0,
        };
        setState(prev => ({
          ...prev,
          workers: [newDriver, ...prev.workers],
        }));
     }
     
     setNewName(''); setNewPhone(''); setNewPlate(''); setNewType(''); setNewCapacity(4);
     setSelectedWorkerId(null);
     setIsAdding(false);
   };
 
   const handleDelete = (id: string) => {
     if (user?.role === 'viewer') return;
     if (!confirm('حذف هذا السائق؟')) return;
     setState(prev => ({
       ...prev,
       workers: prev.workers.filter(w => w.id !== id),
       sites: prev.sites.map(s => ({ ...s, driverId: s.driverId === id ? undefined : s.driverId })),
     }));
   };
 
  const startEdit = (d: Worker) => {
    setEditingId(d.id);
    setEditPhone(d.phone || '');
    setEditPlate(d.driverCarPlate || '');
    setEditType(d.driverCarType || '');
    setEditCapacity(typeof d.driverCapacity === 'number' ? d.driverCapacity : '');
    
    const assigned = state.sites
      .filter(s => s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id)
      .map(s => {
         const ad = s.assignedDrivers?.find((x: any) => x.driverId === d.id);
         return { siteId: s.id, count: ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount || 0 : 0) };
      });
    
    setEditAssignments(assigned.length > 0 ? assigned : [{ siteId: '', count: 0 }]);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditPhone('');
    setEditPlate('');
    setEditType('');
    setEditCapacity('');
    setEditAssignments([]);
  };
  const saveEdit = () => {
    if (user?.role === 'viewer') return;
    if (!editingId) return;
    setState(prev => {
      const updatedWorkers = prev.workers.map(w => w.id === editingId ? {
        ...w,
        phone: editPhone,
        driverCarPlate: editPlate,
        driverCarType: editType,
        driverCapacity: editCapacity === '' ? undefined : Number(editCapacity) || 0,
      } : w);

      const updatedSites = prev.sites.map(s => {
        const assignment = editAssignments.find(a => a.siteId === s.id);
        
        let newAssignedDrivers = s.assignedDrivers ? [...s.assignedDrivers] : [];
        
        // Remove current driver from assignedDrivers to start fresh for this site
        newAssignedDrivers = newAssignedDrivers.filter(ad => ad.driverId !== editingId);

        // If site is in the new assignments list, add driver back
        if (assignment && assignment.siteId) {
           newAssignedDrivers.push({ driverId: editingId, count: Number(assignment.count) || 0 });
        }
        
        let newDriverId = s.driverId;
        let newTransportCount = s.driverTransportCount;

        if (assignment && assignment.siteId) {
             // If we are assigning this driver, and no driver was assigned, set as main driver (for backward compat)
             if (!newDriverId || newDriverId === editingId) {
                 newDriverId = editingId;
                 newTransportCount = Number(assignment.count) || 0;
             }
        } else {
             // If we are unassigning this driver
             if (newDriverId === editingId) {
                 if (newAssignedDrivers.length > 0) {
                     newDriverId = newAssignedDrivers[0].driverId;
                     newTransportCount = newAssignedDrivers[0].count;
                 } else {
                     newDriverId = undefined;
                     newTransportCount = undefined;
                 }
             }
        }
        
        return { 
            ...s, 
            assignedDrivers: newAssignedDrivers,
            driverId: newDriverId,
            driverTransportCount: newTransportCount
        };
      });

      return {
        ...prev,
        workers: updatedWorkers,
        sites: updatedSites,
      };
    });
    cancelEdit();
  };

  return (
    <main className="min-h-screen bg-gray-50 font-cairo animate-fade-in">
      <div className="w-full max-w-[1920px] mx-auto px-4 py-8 md:p-10">
         <div className="relative flex flex-col md:flex-row items-center justify-center mb-8 gap-4">
           <h1 className="text-3xl font-bold text-gray-900 md:absolute md:right-0">إدارة السائقين</h1>
           <div className="flex gap-3 flex-wrap justify-center">
             <Link href="/" className="px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:scale-95">لوحة التوزيع</Link>
             <Link href="/projects" className="px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:scale-95">المشاريع</Link>
             {(user?.role as string) !== 'engineer' && (
                 <Link href="/workers" className="px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:scale-95">العمال</Link>
             )}
             {(user?.role as string) !== 'viewer' && (
               <button
                 onClick={() => setIsAdding(v => !v)}
                 className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 font-bold shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95"
               >
                 {isAdding ? 'إلغاء' : 'إضافة سائق'}
               </button>
             )}
           </div>
         </div>
 
         {/* Stats Dashboard */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-in-up">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-default relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-150 duration-500"></div>
                <div className="relative z-10">
                    <p className="text-gray-500 text-xs font-bold mb-1">إجمالي السائقين</p>
                    <h3 className="text-3xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{stats.total}</h3>
                </div>
                <div className="relative z-10 w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <Users className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-default relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-150 duration-500"></div>
                <div className="relative z-10">
                    <p className="text-gray-500 text-xs font-bold mb-1">على رأس العمل</p>
                    <h3 className="text-3xl font-bold text-gray-800 group-hover:text-orange-600 transition-colors">{stats.active}</h3>
                </div>
                <div className="relative z-10 w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <Activity className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-default relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-150 duration-500"></div>
                <div className="relative z-10">
                    <p className="text-gray-500 text-xs font-bold mb-1">متاح للتوزيع</p>
                    <h3 className="text-3xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">{stats.available}</h3>
                </div>
                <div className="relative z-10 w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-default relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-150 duration-500"></div>
                <div className="relative z-10">
                    <p className="text-gray-500 text-xs font-bold mb-1">مع مركبة</p>
                    <h3 className="text-3xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors">{stats.withVehicle}</h3>
                </div>
                <div className="relative z-10 w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                    <Car className="w-6 h-6" />
                </div>
            </div>
         </div>

         <div className="mb-6">
           <div className="relative max-w-lg mx-auto md:mx-0">
             <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
             </div>
             <input
               placeholder="ابحث عن سائق بالاسم، الجوال، رقم اللوحة، أو نوع السيارة..."
               className="block w-full pr-10 pl-10 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm font-bold"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
             {search && (
                 <button 
                    onClick={() => {
                      setSearch('');
                      router.replace('/drivers');
                    }}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                 >
                    <X className="h-5 w-5" />
                 </button>
             )}
           </div>
         </div>
 
         {isAdding && (
          <form onSubmit={handleAdd} className="mb-6 p-4 bg-white rounded-lg border shadow-sm space-y-3">
            <div className="mb-4 relative">
              <label className="text-xs font-bold text-gray-700 block mb-1">بحث عن عامل لإضافته كسائق</label>
              <div className="relative">
                <input 
                  className="w-full px-3 py-2 border rounded pl-10 font-bold" 
                  placeholder="ابحث بالاسم أو الجوال..." 
                  value={searchWorker} 
                  onChange={e => setSearchWorker(e.target.value)} 
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
              {searchWorker && availableWorkers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border rounded-b-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {availableWorkers.map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => selectWorker(w)}
                      className="w-full text-right px-4 py-2 hover:bg-gray-50 flex justify-between items-center border-b last:border-0"
                    >
                      <span className="font-bold">{w.name}</span>
                      <span className="text-xs text-gray-500 font-bold">{w.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700">اسم السائق</label>
                <input className="w-full px-3 py-2 border rounded font-bold" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus disabled={!!selectedWorkerId} />
              </div>
               <div>
                 <label className="text-xs font-bold text-gray-700">رقم الجوال</label>
                 <input className="w-full px-3 py-2 border rounded font-bold" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-700">رقم اللوحة</label>
                 <SearchableSelect
                   className="w-full font-bold"
                   placeholder="اختر المركبة..."
                   options={vehicleOptions}
                   value={newPlate}
                   onChange={val => {
                     setNewPlate(val || '');
                     const vehicle = state.vehicles?.find(v => v.plateNumber === val);
                     if (vehicle) {
                       setNewType(vehicle.type);
                     }
                   }}
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-700">نوع السيارة</label>
                 <input className="w-full px-3 py-2 border rounded font-bold" value={newType} onChange={e => setNewType(e.target.value)} />
               </div>
               <div>
                 <label className="text-xs font-bold text-gray-700">عدد المنقولين</label>
                 <input type="number" min={0} className="w-full px-3 py-2 border rounded font-bold" value={newCapacity} onChange={e => setNewCapacity(parseInt(e.target.value) || 0)} />
               </div>
             </div>
             <div className="flex items-center justify-end gap-2">
               <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border rounded bg-white hover:bg-gray-50 font-bold">إلغاء</button>
               <button type="submit" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 font-bold">إضافة</button>
             </div>
           </form>
         )}
 
         {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {filtered.map(d => {
             const assignedSites = state.sites.filter(s => s.assignedDrivers?.some(ad => ad.driverId === d.id) || s.driverId === d.id);
             
             // Edit Mode Card
             if (editingId === d.id) {
                return (
                  <div key={d.id} className="bg-white rounded-xl shadow-md border-2 border-primary p-4 space-y-4">
                    <div className="font-bold text-lg text-primary mb-2">تعديل بيانات السائق</div>
                    
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">الاسم</label>
                      <div className="font-bold text-gray-900">{d.name}</div>
                    </div>

                    <div>
                       <label className="text-xs font-bold text-gray-700 block mb-1">رقم الجوال</label>
                       <input 
                         className="w-full px-3 py-2 border rounded-lg font-bold" 
                         value={editPhone} 
                         onChange={e => setEditPhone(e.target.value)} 
                       />
                    </div>

                    <div>
                       <label className="text-xs font-bold text-gray-700 block mb-1">رقم اللوحة</label>
                       <SearchableSelect
                            className="w-full font-bold"
                            placeholder="اختر المركبة..."
                            options={vehicleOptions}
                            value={editPlate}
                            onChange={val => {
                              const vVal = val || '';
                              setEditPlate(vVal);
                              const vehicle = state.vehicles?.find(v => v.plateNumber === vVal);
                              if (vehicle) {
                                setEditType(vehicle.type);
                              }
                            }}
                          />
                    </div>

                    <div>
                       <label className="text-xs font-bold text-gray-700 block mb-1">نوع السيارة</label>
                       <input 
                         className="w-full px-3 py-2 border rounded-lg font-bold" 
                         value={editType} 
                         onChange={e => setEditType(e.target.value)} 
                       />
                    </div>

                    <div>
                       <label className="text-xs font-bold text-gray-700 block mb-1">السعة القصوى</label>
                       <input 
                         className="w-full px-3 py-2 border rounded-lg font-bold" 
                         type="number" 
                         value={editCapacity} 
                         onChange={e => setEditCapacity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} 
                       />
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <label className="text-xs font-bold text-gray-700 block mb-2">المشاريع الموزعة</label>
                         <div className="space-y-2">
                            {editAssignments.map((assignment, index) => {
                              const currentSiteOptions = state.sites.map(s => ({
                                value: s.id,
                                label: s.name,
                                disabled: editAssignments.some((a, i) => i !== index && a.siteId === s.id)
                              }));
                              
                              return (
                              <div key={index} className="flex flex-col gap-2 border-b border-gray-200 pb-2 last:border-0">
                                 <SearchableSelect
                                   className="w-full font-bold"
                                   placeholder="اختر المشروع"
                                   options={currentSiteOptions}
                                   value={assignment.siteId}
                                   onChange={val => {
                                      const newAssigns = [...editAssignments];
                                      newAssigns[index].siteId = val || '';
                                      setEditAssignments(newAssigns);
                                   }}
                                 />
                                 <div className="flex items-center gap-2">
                                     <input
                                       type="number"
                                       className="w-20 px-2 py-2 border rounded text-center font-bold"
                                       placeholder="العدد"
                                       min={0}
                                       value={assignment.count}
                                       onChange={e => {
                                          const newAssigns = [...editAssignments];
                                          newAssigns[index].count = parseInt(e.target.value) || 0;
                                          setEditAssignments(newAssigns);
                                       }}
                                     />
                                     <button 
                                        onClick={() => {
                                           const newAssigns = editAssignments.filter((_, i) => i !== index);
                                           setEditAssignments(newAssigns);
                                        }}
                                        className="p-2 text-red-500 bg-red-50 rounded hover:bg-red-100"
                                     >
                                        <Trash2 className="w-4 h-4" />
                                     </button>
                                 </div>
                              </div>
                              );
                            })}
                            <button
                              type="button" 
                              onClick={() => setEditAssignments([...editAssignments, { siteId: '', count: 0 }])}
                              className="text-xs text-primary font-bold flex items-center gap-1 mt-2"
                            >
                               <Plus className="w-3 h-3" />
                               إضافة مشروع
                            </button>
                         </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                       <button onClick={saveEdit} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold shadow-sm">حفظ</button>
                       <button onClick={cancelEdit} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold">إلغاء</button>
                    </div>
                  </div>
                );
             }

             // Display Mode Card
             return (
               <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                       <Truck className="w-5 h-5" />
                     </div>
                     <div>
                       <div className="font-bold text-gray-900">{d.name}</div>
                       {d.englishName && <div className="text-xs text-gray-500 font-bold">{d.englishName}</div>}
                     </div>
                   </div>
                   {user?.role !== 'viewer' && (
                     <div className="flex gap-1">
                        <button onClick={() => startEdit(d)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(d.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                   )}
                 </div>

                 <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                       <span className="text-gray-500 text-xs block mb-1">رقم الجوال</span>
                       <span className="font-bold text-gray-800 dir-ltr block text-right">{d.phone || '-'}</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                       <span className="text-gray-500 text-xs block mb-1">المركبة</span>
                       <span className="font-bold text-gray-800">{d.driverCarType || '-'}</span>
                       {d.driverCarPlate && <span className="block text-xs text-gray-500 font-mono mt-0.5">{d.driverCarPlate}</span>}
                    </div>
                 </div>

                 <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-indigo-800">توزيع المشاريع</span>
                       <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                          السعة: {d.driverCapacity || 0}
                       </span>
                    </div>
                    {assignedSites.length > 0 ? (
                       <div className="space-y-1.5">
                          {assignedSites.map(s => {
                             const ad = s.assignedDrivers?.find((x: any) => x.driverId === d.id);
                             const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
                             return (
                                <div key={s.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-indigo-100">
                                   <span className="text-gray-700 font-medium truncate max-w-[150px]">{s.name}</span>
                                   <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{count} عامل</span>
                                </div>
                             );
                          })}
                       </div>
                    ) : (
                       <div className="text-center py-2 text-gray-400 text-xs font-medium">غير موزع على أي مشروع</div>
                    )}
                 </div>
               </div>
             );
          })}
          {filtered.length === 0 && (
             <div className="text-center py-10 text-gray-500 font-bold bg-white rounded-xl border border-dashed border-gray-300">
                لا يوجد سائقين مطابقين للبحث
             </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
           <table className="w-full text-right border-separate border-spacing-0">
             <thead className="bg-gray-100/80">
                <tr>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200 first:rounded-tr-lg">م</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">اسم السائق</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">رقم الجوال</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">رقم اللوحة</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">نوع السيارة</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">السعة القصوى</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">المشروع الموزع له</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">عدد الركاب الفعلي</th>
                  <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200 first:rounded-tr-lg last:rounded-tl-lg">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map((d, idx) => (
                  <tr key={d.id} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    {editingId === d.id ? (
                      <>
                        <td className="px-6 py-5 align-middle font-bold text-gray-900 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-5 align-middle font-bold text-gray-900">
                          <div className="flex flex-col">
                            <span>{d.name}</span>
                                   {d.englishName && <span className="text-xs font-bold text-black">{d.englishName}</span>}
                                 </div>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <input className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none font-bold" placeholder="رقم الجوال" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <SearchableSelect
                            className="w-full font-bold"
                            placeholder="اختر المركبة..."
                            options={vehicleOptions}
                            value={editPlate}
                            onChange={val => {
                              const vVal = val || '';
                              setEditPlate(vVal);
                              const vehicle = state.vehicles?.find(v => v.plateNumber === vVal);
                              if (vehicle) {
                                setEditType(vehicle.type);
                              }
                            }}
                          />
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <input className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none font-bold" placeholder="نوع السيارة" value={editType} onChange={e => setEditType(e.target.value)} />
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <input className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none font-bold" type="number" min={0} placeholder="السعة" value={editCapacity} onChange={e => setEditCapacity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} />
                        </td>
                        <td className="px-6 py-5 align-middle" colSpan={2}>
                          <div className="flex flex-col gap-2 min-w-[300px]">
                            {editAssignments.map((assignment, index) => {
                              const currentSiteOptions = state.sites.map(s => ({
                                value: s.id,
                                label: s.name,
                                disabled: editAssignments.some((a, i) => i !== index && a.siteId === s.id)
                              }));
                              
                              return (
                              <div key={index} className="flex gap-2 items-center">
                                 <div className="flex-1 min-w-[150px]">
                                   <SearchableSelect 
                                     className="font-bold"
                                     placeholder="اختر مشروع..."
                                     options={currentSiteOptions}
                                     value={assignment.siteId}
                                     onChange={val => {
                                       const newAssignments = [...editAssignments];
                                       newAssignments[index].siteId = val || '';
                                       setEditAssignments(newAssignments);
                                     }}
                                   />
                                 </div>
                                 <input 
                                    className="w-20 px-2 py-1.5 border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none font-bold"
                                    type="number" 
                                    min={0} 
                                    placeholder="العدد" 
                                    value={assignment.count || ''} 
                                    onChange={e => {
                                      const newAssignments = [...editAssignments];
                                      newAssignments[index].count = parseInt(e.target.value) || 0;
                                      setEditAssignments(newAssignments);
                                    }} 
                                  />
                                  <button 
                                    onClick={() => {
                                      const newAssignments = editAssignments.filter((_, i) => i !== index);
                                      setEditAssignments(newAssignments);
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="إزالة"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                              </div>
                            );
                          })}
                            <button
                              type="button"
                              onClick={() => setEditAssignments([...editAssignments, { siteId: '', count: 0 }])}
                              className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold px-1 w-fit"
                            >
                              <Plus className="w-3 h-3" />
                              إضافة مشروع آخر
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-5 align-middle">
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="px-3 py-1.5 text-sm font-bold border border-green-200 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-colors shadow-sm">حفظ</button>
                            <button onClick={cancelEdit} className="px-3 py-1.5 text-sm font-bold border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm">إلغاء</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-5 align-middle font-bold text-gray-900 whitespace-nowrap text-center">
                           {idx + 1}
                        </td>
                        <td className="px-6 py-5 align-middle font-bold text-gray-900 whitespace-nowrap group-hover:text-blue-700 hover:underline transition-colors">
                            <div className="flex items-center gap-2">
                                <Truck className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                <div className="flex flex-col">
                                  <span>{d.name}</span>
                                  {d.englishName && <span className="text-xs font-bold text-black">{d.englishName}</span>}
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-5 align-middle whitespace-nowrap text-gray-700 font-mono font-bold group-hover:text-gray-900 transition-colors" dir="ltr"><div className="text-right">{d.phone || '-'}</div></td>
                        <td className="px-6 py-5 align-middle whitespace-nowrap text-gray-700 font-mono font-bold group-hover:text-gray-900 transition-colors">{d.driverCarPlate || '-'}</td>
                        <td className="px-6 py-5 align-middle whitespace-nowrap text-gray-700 font-bold group-hover:text-gray-900 transition-colors">{d.driverCarType || '-'}</td>
                        <td className="px-6 py-5 align-middle whitespace-nowrap text-gray-700 font-mono font-bold group-hover:text-gray-900 transition-colors">{d.driverCapacity ?? '-'}</td>
                        <td className="px-6 py-5 align-middle whitespace-nowrap text-gray-700 transition-colors" colSpan={2}>
                          {(() => {
                            const assignedSites = state.sites.filter(s => s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id);
                            if (assignedSites.length === 0) return <span className="text-gray-400 font-bold">-</span>;
                            
                            return (
                              <div className="flex flex-col gap-1.5 items-start">
                                {assignedSites.map(site => {
                                  const ad = site.assignedDrivers?.find((x: any) => x.driverId === d.id);
                                  const count = ad ? ad.count : (site.driverId === d.id ? site.driverTransportCount : 0);
                                  return (
                                  <div key={site.id} className="flex items-center gap-2 text-xs">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
                                      {site.name}
                                    </span>
                                    {count ? (
                                      <span className="font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-bold">
                                        {count}
                                      </span>
                                    ) : null}
                                  </div>
                                )})}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-5 align-middle whitespace-nowrap">
                          {user?.role !== 'viewer' && (
                            <div className="flex gap-2">
                              <button onClick={() => startEdit(d)} className="px-3 py-1.5 text-sm font-bold border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm">توزيع / تعديل</button>
                              <button onClick={() => handleDelete(d.id)} className="px-3 py-1.5 text-sm font-bold border border-red-200 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-colors shadow-sm">حذف</button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td className="p-12 text-center text-gray-400 text-lg font-bold" colSpan={9}>لا يوجد سائقون</td></tr>
                )}
              </tbody>
            </table>
         </div>
       </div>
     </main>
   );
 }
