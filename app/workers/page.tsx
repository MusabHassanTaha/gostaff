'use client';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import SearchableSelect from '@/components/SearchableSelect';
import { Worker, Site, Notification } from '@/types';
import { Check, Pencil, Trash, X, Briefcase, Eye, Upload, Download, Users, Phone, MapPin, Calendar, CreditCard, ChevronDown, ChevronUp, AlertCircle, ShieldCheck, AlertTriangle, Printer, Search } from 'lucide-react';
import { daysRemaining, statusClasses, labelFor, calculateDaysWorked, calculateDurationString } from '@/lib/date';

export default function WorkersPage() {
  const { state, setState } = useAppState();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');

  const isAdmin = (user?.role as string) === 'admin';
  const isSupervisor = (user?.role as string) === 'supervisor';
  const isEngineer = (user?.role as string) === 'engineer';
  const isViewer = (user?.role as string) === 'viewer';
  
  // Permission checks
  const canAdd = isAdmin || isSupervisor;
  const canEdit = isAdmin || isSupervisor;
  const canDelete = isAdmin;
  const canViewSalary = isAdmin;
  const canApprove = isAdmin;

  const [showExpiryBanner, setShowExpiryBanner] = useState(false);
  const [selectedStatsCategory, setSelectedStatsCategory] = useState<{
    type: 'iqama' | 'insurance';
    status: 'green' | 'yellow' | 'red';
    label: string;
  } | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dismissed = typeof window !== 'undefined' ? localStorage.getItem('expiry-banner-dismissed-date') : null;
    setShowExpiryBanner(dismissed !== today);
  }, []);

  useEffect(() => {
    const query = searchParams.get('search');
    if (query) {
      setSearch(query);
    }
  }, [searchParams]);

  // Backfill worker codes if missing (One-time migration logic)
  useEffect(() => {
    const needsUpdate = state.workers.some(w => !w.code);
    if (needsUpdate) {
        let maxCode = 0;
        // Find max existing code
        state.workers.forEach(w => {
            if (w.code) {
               const num = parseInt(w.code.replace('EM', ''), 10);
               if (!isNaN(num) && num > maxCode) maxCode = num;
            }
        });

        // Assign codes to workers without them, preserving order
        const updatedWorkers = state.workers.map(w => {
            if (!w.code) {
                maxCode++;
                return { ...w, code: `EM${maxCode.toString().padStart(4, '0')}` };
            }
            return w;
        });

        setState(prev => ({ ...prev, workers: updatedWorkers }));
    }
  }, [state.workers, setState]);

  const [filterSkill, setFilterSkill] = useState(''); // New filter state
  const [viewImage, setViewImage] = useState<string | null>(null); // State for viewing image
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Partial<Worker>>({
    name: '',
    englishName: '',
    skill: state.skills[0]?.name || 'General',
    iqamaNumber: '',
    iqamaImage: '',
    nationality: '',
    religion: '',
    phone: '',
    hireDate: '',
    iqamaExpiry: '',
    insuranceExpiry: '',
    bankName: '',
    bankAccount: '',
  });
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Worker>>({});
  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    if (!canAdd && !canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Upload failed');
        }
        
        const data = await res.json();
        if (isEdit) {
            setEdit(prev => ({ ...prev, iqamaImage: data.url }));
        } else {
            setForm(prev => ({ ...prev, iqamaImage: data.url }));
        }
    } catch (err: any) {
        console.error(err);
        alert(`فشل تحميل الصورة: ${err.message}`);
    }
  };

  const accessibleWorkers = useMemo(() => {
    return state.workers.filter(w => {
        // Exclude pending workers from main list (Admins see them in separate section)
        if (w.status === 'pending') return false;

        // Engineer sees all workers now (Read Only)
        
        return true;
    });
  }, [state.workers]);

  const stats = useMemo(() => {
    const s = {
        iqama: { green: 0, yellow: 0, red: 0 },
        insurance: { green: 0, yellow: 0, red: 0 }
    };
    accessibleWorkers.forEach(w => {
        const dIqama = daysRemaining(w.iqamaExpiry);
        if (dIqama !== undefined) {
            if (dIqama <= 5) s.iqama.red++;
            else if (dIqama <= 10) s.iqama.yellow++;
            else s.iqama.green++;
        }
        
        const dIns = daysRemaining(w.insuranceExpiry);
        if (dIns !== undefined) {
            if (dIns <= 5) s.insurance.red++;
            else if (dIns <= 10) s.insurance.yellow++;
            else s.insurance.green++;
        }
    });
    return s;
  }, [accessibleWorkers]);

  const hasIssues = stats.iqama.yellow > 0 || stats.iqama.red > 0 || stats.insurance.yellow > 0 || stats.insurance.red > 0;
  const showWarning = showExpiryBanner && hasIssues;

  // Added state for skills management
  const [isManagingSkills, setIsManagingSkills] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLabel, setNewSkillLabel] = useState('');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editSkillLabel, setEditSkillLabel] = useState('');

  const skillOptions = useMemo(() => {
    return state.skills.map(s => ({ value: s.name, label: s.label }));
  }, [state.skills]);

  const filterSkillOptions = useMemo(() => {
    return [
        { value: "", label: "كل المهن" },
        ...state.skills.map(s => ({ value: s.name, label: s.label }))
    ];
  }, [state.skills]);

  const workerSiteMap = useMemo(() => {
    const map = new Map<string, Site>();
    state.sites.forEach(s => {
        // Handle both assignedWorkerIds (legacy/frontend) and direct worker relation (DB)
        if (s.assignedWorkerIds && Array.isArray(s.assignedWorkerIds)) {
            s.assignedWorkerIds.forEach(wid => map.set(wid, s));
        }
    });
    return map;
  }, [state.sites]);

  const pendingWorkers = useMemo(() => {
    if (!isAdmin) return [];
    return state.workers.filter(w => w.status === 'pending');
  }, [state.workers, isAdmin]);

  const workers = useMemo(() => {
    return accessibleWorkers.filter(w => {
        const searchLower = search.toLowerCase();
        const skillLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
        const assignedSite = workerSiteMap.get(w.id) || state.sites.find(s => s.id === w.assignedSiteId);
        
        const matchSearch = 
            w.name.toLowerCase().includes(searchLower) ||
            (w.iqamaNumber && w.iqamaNumber.includes(searchLower)) ||
            (w.phone && w.phone.includes(searchLower)) ||
            (w.nationality && w.nationality.toLowerCase().includes(searchLower)) ||
            skillLabel.toLowerCase().includes(searchLower) ||
            (assignedSite && assignedSite.name.toLowerCase().includes(searchLower));

        const matchSkill = filterSkill ? w.skill === filterSkill : true;
        return matchSearch && matchSkill;
    });
  }, [accessibleWorkers, search, filterSkill, state.skills, workerSiteMap, state.sites]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    if (!form.name?.trim() || !form.skill?.trim()) return;

    // Check for duplicate Iqama Number
    if (form.iqamaNumber?.trim()) {
        const iqamaExists = state.workers.some(w => w.iqamaNumber === form.iqamaNumber?.trim());
        if (iqamaExists) {
            alert('رقم الإقامة مضاف مسبقا');
            return;
        }
    }

    if (form.hireDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const hire = new Date(form.hireDate);
      hire.setHours(0,0,0,0);
      if (hire.getTime() > today.getTime()) {
        alert('تاريخ التعيين لا يمكن أن يكون في المستقبل');
        return;
      }
    }

    // Generate Code
    let maxCode = 0;
    state.workers.forEach(w => {
        if (w.code) {
            const num = parseInt(w.code.replace('EM', ''), 10);
            if (!isNaN(num) && num > maxCode) maxCode = num;
        }
    });
    const newCode = `EM${(maxCode + 1).toString().padStart(4, '0')}`;

    const newWorker: Worker = {
      id: `w-${Date.now()}`,
      code: newCode,
      name: form.name!,
      englishName: form.englishName || '',
      skill: form.skill!,
      iqamaNumber: form.iqamaNumber || '',
      iqamaImage: form.iqamaImage || '',
      nationality: form.nationality || '',
      religion: form.religion || '',
      phone: form.phone || '',
      hireDate: form.hireDate || '',
      iqamaExpiry: form.iqamaExpiry || '',
      insuranceExpiry: form.insuranceExpiry || '',
      bankName: form.bankName || '',
      bankAccount: form.bankAccount || '',
      assignedSiteId: undefined,
      status: isAdmin ? 'active' : 'pending',
    };

    // Notification Logic
    const newNotification: Notification = {
        id: `notif-${Date.now()}`,
        type: 'new_worker',
        targetId: newWorker.id,
        message: `تم إضافة عامل جديد: ${newWorker.name}`,
        isRead: false,
        createdAt: Date.now()
    };

    setState(prev => ({
      ...prev,
      workers: [newWorker, ...prev.workers],
      availableWorkerIds: [newWorker.id, ...prev.availableWorkerIds],
      notifications: [newNotification, ...(prev.notifications || [])] as Notification[],
    }));
    setForm({
      name: '',
      englishName: '',
      skill: state.skills[0]?.name || 'General',
      iqamaNumber: '',
      iqamaImage: '',
      nationality: '',
      religion: '',
      phone: '',
      hireDate: '',
      iqamaExpiry: '',
      insuranceExpiry: '',
      bankName: '',
      bankAccount: '',
    });
    setIsAdding(false);
    if (!isAdmin) {
        alert('تم إضافة العامل بنجاح وهو الآن في انتظار الاعتماد من قبل الإدارة.');
    }
  };

  const approveWorker = (id: string) => {
    if (!canApprove) return;
    setState(prev => ({
        ...prev,
        workers: prev.workers.map(w => w.id === id ? { ...w, status: 'active' } : w)
    }));
  };

  const rejectWorker = (id: string) => {
      if (!canApprove) return;
      if (!confirm('هل أنت متأكد من رفض وحذف هذا الطلب؟')) return;
      setState(prev => ({
          ...prev,
          workers: prev.workers.filter(w => w.id !== id),
          availableWorkerIds: prev.availableWorkerIds.filter(wid => wid !== id),
      }));
  };

  const startEdit = (w: Worker) => {
    setEditingId(w.id);
    setEdit({ ...w });
  };
  const saveEdit = () => {
    if (!canEdit) return;
    if (!editingId || !edit.name?.trim()) return;

    // Check for duplicate Iqama Number if it's being changed
    if (edit.iqamaNumber?.trim()) {
         const iqamaExists = state.workers.some(w => w.id !== editingId && w.iqamaNumber === edit.iqamaNumber?.trim());
         if (iqamaExists) {
             alert('رقم الإقامة مضاف مسبقا لعامل آخر');
             return;
         }
    }

    if (edit.hireDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const hire = new Date(edit.hireDate);
      hire.setHours(0,0,0,0);
      if (hire.getTime() > today.getTime()) {
        alert('تاريخ التعيين لا يمكن أن يكون في المستقبل');
        return;
      }
    }

    setState(prev => ({
      ...prev,
      workers: prev.workers.map(w => w.id === editingId ? {
        ...w,
        name: edit.name!,
        englishName: edit.englishName ?? w.englishName,
        skill: edit.skill || w.skill,
        iqamaNumber: edit.iqamaNumber ?? w.iqamaNumber,
        iqamaImage: edit.iqamaImage ?? w.iqamaImage,
        nationality: edit.nationality ?? w.nationality,
        religion: edit.religion ?? w.religion,
        phone: edit.phone ?? w.phone,
        hireDate: edit.hireDate ?? w.hireDate,
        iqamaExpiry: edit.iqamaExpiry ?? w.iqamaExpiry,
        insuranceExpiry: edit.insuranceExpiry ?? w.insuranceExpiry,
        bankName: edit.bankName ?? w.bankName,
        bankAccount: edit.bankAccount ?? w.bankAccount,
      } : w),
    }));
    setEditingId(null);
  };

  const remove = (id: string) => {
    if (!canDelete) return;
    if (!confirm('هل تريد حذف العامل؟')) return;
    setState(prev => ({
      ...prev,
      workers: prev.workers.filter(w => w.id !== id),
      availableWorkerIds: prev.availableWorkerIds.filter(wid => wid !== id),
      sites: prev.sites.map(s => ({
        ...s,
        assignedWorkerIds: s.assignedWorkerIds.filter(wid => wid !== id),
      })),
    }));
  };

  // Added handlers for skills management
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isSupervisor) return; // Only Admin/Supervisor can manage skills
    const name = newSkillName.trim();
    const label = newSkillLabel.trim();
    if (!name || !label) return;
    
    // Check for duplicates
    const exists = state.skills.some(s => s.name === name || s.label === label);
    if (exists) {
        alert('المهنة مضافة مسبقا');
        return;
    }

    const newSkill = {
        id: `skill-${Date.now()}`,
        name: name,
        label: label,
        color: 'bg-indigo-100 text-indigo-700 border-indigo-200', // Better default color (matches other skills)
        description: ''
    };

    setState(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill]
    }));
    
    setNewSkillName('');
    setNewSkillLabel('');
  };

  const handleUpdateSkill = (id: string) => {
    if (!isAdmin && !isSupervisor) return;
    if (!editSkillLabel.trim()) return;
    
    setState(prev => ({
        ...prev,
        skills: prev.skills.map(s => s.id === id ? { ...s, label: editSkillLabel.trim() } : s)
    }));
    setEditingSkillId(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedWorkerId === id) {
      setExpandedWorkerId(null);
    } else {
      setExpandedWorkerId(id);
    }
  };

  const statsData = useMemo(() => {
    const total = workers.length;
    const active = workers.filter(w => w.assignedSiteId && w.availabilityStatus !== 'absent').length;
    const available = workers.filter(w => !w.assignedSiteId && w.availabilityStatus !== 'absent').length;
    const absent = workers.filter(w => w.availabilityStatus === 'absent').length;
    
    let topSkill = '';
    let topSkillCount = 0;
    if (!filterSkill) {
        const counts: Record<string, number> = {};
        workers.forEach(w => {
            counts[w.skill] = (counts[w.skill] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            topSkill = state.skills.find(s => s.name === sorted[0][0])?.label || sorted[0][0];
            topSkillCount = sorted[0][1];
        }
    }

    return { total, active, available, absent, topSkill, topSkillCount };
  }, [workers, filterSkill, state.skills]);

  if ((user?.role as string) === 'engineer') {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">عفواً، ليس لديك صلاحية للوصول لهذه الصفحة</h1>
                <p className="text-gray-600 mb-6">يرجى التواصل مع المسؤول للحصول على الصلاحيات اللازمة.</p>
                <Link href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    العودة للرئيسية
                </Link>
            </div>
        </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 relative animate-fade-in print:bg-white">
      {/* Print Header */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-gray-800 pb-4">
          <h1 className="text-3xl font-black text-black mb-2">تقرير العمال الشامل</h1>
          <div className="flex justify-center gap-8 text-sm font-bold text-gray-600 mt-2">
              <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</span>
              <span>إجمالي العمال: {workers.length}</span>
              <span>المستخدم: {user?.username || 'مسؤول النظام'}</span>
          </div>
      </div>

      <div className="w-full max-w-[1920px] mx-auto px-4 py-8 md:p-10 pb-36 print:p-0 print:pb-0">
        <div className="relative flex flex-col md:flex-row md:items-center justify-center mb-8 gap-4 min-h-[3rem] print:hidden">
          <div className="flex items-center gap-4 md:absolute md:right-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">إدارة العمال</h1>
            <div className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full shadow-md transition-all hover:shadow-lg hover:scale-105 border border-blue-400/20">
                <Users className="w-5 h-5" />
                <span className="font-bold text-lg">{workers.length}</span>
                <span className="text-sm font-medium">عامل</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/" className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors flex-1 md:flex-none text-center">لوحة التوزيع</Link>
            {canAdd && (
                <>
                    <button 
                        onClick={() => setIsManagingSkills(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors border border-gray-300 flex-1 md:flex-none"
                    >
                        <Briefcase className="w-4 h-4" />
                        المهن
                    </button>
                    <button onClick={() => setIsAdding(!isAdding)} className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium shadow-sm transition-colors flex-1 md:flex-none">
                    {isAdding ? 'إلغاء' : 'إضافة عامل'}
                    </button>
                </>
            )}
          </div>
        </div>

        {/* Expiry Banner */}
        {mounted && showWarning && (
            <div className="mb-6 border rounded-xl px-4 md:px-6 py-3 flex flex-col md:flex-row items-center justify-between transition-colors gap-3 bg-red-50 border-red-200 animate-door-open" suppressHydrationWarning>
              {/* Left Side - Stats Grid */}
              <div className="flex-1 w-full">
                  <div className="flex items-start gap-4">
                    <div className="text-red-600 pt-2 hidden md:block">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Iqama Stats */}
                        <div className="bg-white/60 p-2 rounded border border-red-100">
                             <div className="text-xs font-bold text-gray-700 mb-1">حالة الإقامات</div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => setSelectedStatsCategory({ type: 'iqama', status: 'green', label: 'إقامات سارية' })}
                                    className="flex-1 flex flex-col items-center bg-green-50 rounded border border-green-100 p-1 hover:bg-green-100 transition-colors cursor-pointer"
                                >
                                    <span className="text-sm font-bold text-green-700">{stats.iqama.green}</span>
                                    <span className="text-[10px] text-green-800">سارية</span>
                                </button>
                                <button 
                                    onClick={() => setSelectedStatsCategory({ type: 'iqama', status: 'yellow', label: 'إقامات على وشك الانتهاء' })}
                                    className="flex-1 flex flex-col items-center bg-yellow-50 rounded border border-yellow-100 p-1 hover:bg-yellow-100 transition-colors cursor-pointer"
                                >
                                    <span className="text-sm font-bold text-yellow-700">{stats.iqama.yellow}</span>
                                    <span className="text-[10px] text-yellow-800 whitespace-nowrap">على وشك الانتهاء</span>
                                </button>
                                <button 
                                    onClick={() => setSelectedStatsCategory({ type: 'iqama', status: 'red', label: 'إقامات منتهية' })}
                                    className="flex-1 flex flex-col items-center bg-red-50 rounded border border-red-100 p-1 hover:bg-red-100 transition-colors cursor-pointer"
                                >
                                    <span className="text-sm font-bold text-red-700">{stats.iqama.red}</span>
                                    <span className="text-[10px] text-red-800">منتهية</span>
                                </button>
                             </div>
                        </div>

                        {/* Insurance Stats */}
                        <div className="bg-white/60 p-2 rounded border border-red-100">
                             <div className="text-xs font-bold text-gray-700 mb-1">حالة التأمين</div>
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => setSelectedStatsCategory({ type: 'insurance', status: 'green', label: 'تأمين ساري' })}
                                    className="flex-1 flex flex-col items-center bg-green-50 rounded border border-green-100 p-1 hover:bg-green-100 transition-colors cursor-pointer"
                                >
                                    <span className="text-sm font-bold text-green-700">{stats.insurance.green}</span>
                                    <span className="text-[10px] text-green-800">سارية</span>
                                </button>
                                <button 
                                    onClick={() => setSelectedStatsCategory({ type: 'insurance', status: 'yellow', label: 'تأمين على وشك الانتهاء' })}
                                    className="flex-1 flex flex-col items-center bg-yellow-50 rounded border border-yellow-100 p-1 hover:bg-yellow-100 transition-colors cursor-pointer"
                                >
                                    <span className="text-sm font-bold text-yellow-700">{stats.insurance.yellow}</span>
                                    <span className="text-[10px] text-yellow-800 whitespace-nowrap">على وشك الانتهاء</span>
                                </button>
                                <button 
                                    onClick={() => setSelectedStatsCategory({ type: 'insurance', status: 'red', label: 'تأمين منتهي' })}
                                    className="flex-1 flex flex-col items-center bg-red-50 rounded border border-red-100 p-1 hover:bg-red-100 transition-colors cursor-pointer"
                                >
                                    <span className="text-sm font-bold text-red-700">{stats.insurance.red}</span>
                                    <span className="text-[10px] text-red-800">منتهية</span>
                                </button>
                             </div>
                        </div>
                    </div>
                  </div>
              </div>

              {/* Right Side - Actions */}
              <div className="flex-none flex justify-end items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().slice(0, 10);
                      if (typeof window !== 'undefined') localStorage.setItem('expiry-banner-dismissed-date', today);
                      setShowExpiryBanner(false);
                    }}
                    className="px-4 py-2 text-sm bg-white text-red-700 border border-red-300 rounded-lg hover:bg-red-50 whitespace-nowrap shadow-sm"
                  >
                    تجاهل
                  </button>
              </div>
            </div>
        )}

        {/* Pending Approvals Section (Admin Only) */}
        {isAdmin && pendingWorkers.length > 0 && (
            <div className="mb-8 bg-amber-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden animate-in slide-in-from-top-4 print:hidden">
                <div className="p-4 border-b border-amber-100 flex items-center justify-between bg-amber-100/50">
                    <div className="flex items-center gap-2 text-amber-800">
                        <ShieldCheck className="w-5 h-5" />
                        <h2 className="font-bold text-lg">طلبات بانتظار الاعتماد ({pendingWorkers.length})</h2>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-sm font-bold text-white border-b border-amber-400">الاسم</th>
                                <th className="px-4 py-3 text-sm font-bold text-white border-b border-amber-400">المهنة</th>
                                <th className="px-4 py-3 text-sm font-bold text-white border-b border-amber-400">الجنسية</th>
                                <th className="px-4 py-3 text-sm font-bold text-white border-b border-amber-400">رقم الإقامة</th>
                                <th className="px-4 py-3 text-sm font-bold text-white text-center border-b border-amber-400">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                            {pendingWorkers.map(w => (
                                <tr key={w.id} className="hover:bg-amber-50 transition-colors odd:bg-white even:bg-amber-50/30">
                                    <td className="px-4 py-3 font-bold text-gray-800">{w.name}</td>
                                    <td className="px-4 py-3 text-gray-700">{state.skills.find(s => s.name === w.skill)?.label || w.skill}</td>
                                    <td className="px-4 py-3 text-gray-700">{w.nationality || '-'}</td>
                                    <td className="px-4 py-3 font-mono text-gray-700">{w.iqamaNumber || '-'}</td>
                                    <td className="px-4 py-3 flex items-center justify-center gap-2">
                                        <button onClick={() => approveWorker(w.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm flex items-center gap-1">
                                            <Check className="w-4 h-4" /> اعتماد
                                        </button>
                                        <button onClick={() => rejectWorker(w.id)} className="px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 flex items-center gap-1">
                                            <X className="w-4 h-4" /> رفض
                                        </button>
                                        <button onClick={() => startEdit(w)} className="px-3 py-1.5 bg-white text-yellow-600 border border-yellow-200 rounded-lg text-sm font-medium hover:bg-yellow-50 flex items-center gap-1">
                                            <Pencil className="w-4 h-4" /> تعديل
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {isAdding && (
          <form onSubmit={handleAdd} className="mb-6 p-4 md:p-6 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">اسم العامل (عربي)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">اسم العامل (إنجليزي)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-left" dir="ltr" value={form.englishName || ''} onChange={e => setForm({ ...form, englishName: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">المهنة</label>
                <SearchableSelect 
                  className="w-full"
                  placeholder="اختر المهنة..."
                  options={skillOptions}
                  value={form.skill || ''}
                  onChange={val => setForm({ ...form, skill: val || '' })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">رقم الإقامة</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.iqamaNumber || ''} onChange={e => setForm({ ...form, iqamaNumber: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">تاريخ التعيين</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.hireDate || ''} onChange={e => setForm({ ...form, hireDate: e.target.value })} />
                {form.hireDate && (
                    <div className="text-xs text-blue-600 font-bold mt-1">
                        منذ {calculateDaysWorked(form.hireDate)} يوم
                    </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">صورة الإقامة</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            type="file" 
                            accept="image/*"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                            onChange={(e) => handleFileUpload(e, false)} 
                        />
                    </div>
                    {form.iqamaImage && (
                        <div className="flex gap-1">
                            <button type="button" onClick={() => setViewImage(form.iqamaImage!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors" title="عرض">
                                <Eye className="w-4 h-4" />
                            </button>
                            <a href={form.iqamaImage} download target="_blank" className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 transition-colors" title="تحميل">
                                <Download className="w-4 h-4" />
                            </a>
                            <button type="button" onClick={() => setForm({ ...form, iqamaImage: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors" title="حذف">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">الجنسية</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.nationality || ''} onChange={e => setForm({ ...form, nationality: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">الديانة</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.religion || ''} onChange={e => setForm({ ...form, religion: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">رقم الجوال</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">انتهاء الإقامة</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.iqamaExpiry || ''} onChange={e => setForm({ ...form, iqamaExpiry: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">انتهاء التأمين</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.insuranceExpiry || ''} onChange={e => setForm({ ...form, insuranceExpiry: e.target.value })} />
              </div>
              {canViewSalary && (
                  <>
                    <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">اسم البنك</label>
                        <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={form.bankName || ''} onChange={e => setForm({ ...form, bankName: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-700 mb-1 block">رقم الحساب (IBAN)</label>
                        <input className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" dir="ltr" value={form.bankAccount || ''} onChange={e => setForm({ ...form, bankAccount: e.target.value })} />
                    </div>
                  </>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium shadow-sm transition-colors flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{isAdmin ? 'حفظ واعتماد' : 'إرسال للاعتماد'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Stats Grid - Moved to Top */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-top-4 print:hidden">
            {/* Card 1: Total */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-2xl shadow-sm border border-blue-100/50 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden">
               <div className="absolute top-0 left-0 w-24 h-24 bg-blue-100/20 rounded-full -translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
               <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-100/50 px-2.5 py-1 rounded-full border border-blue-100">الكل</span>
               </div>
               <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{statsData.total}</h3>
                  <p className="text-sm font-medium text-gray-500">إجمالي العمال</p>
               </div>
            </div>

            {/* Card 2: Active */}
            <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-2xl shadow-sm border border-green-100/50 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden">
               <div className="absolute top-0 left-0 w-24 h-24 bg-green-100/20 rounded-full -translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
               <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-green-600 bg-green-100/50 px-2.5 py-1 rounded-full border border-green-100">نشط</span>
               </div>
               <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{statsData.active}</h3>
                  <p className="text-sm font-medium text-gray-500">على رأس العمل</p>
               </div>
            </div>

            {/* Card 3: Available */}
            <div className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-2xl shadow-sm border border-orange-100/50 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden">
               <div className="absolute top-0 left-0 w-24 h-24 bg-orange-100/20 rounded-full -translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
               <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <Check className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-orange-600 bg-orange-100/50 px-2.5 py-1 rounded-full border border-orange-100">متاح</span>
               </div>
               <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{statsData.available}</h3>
                  <p className="text-sm font-medium text-gray-500">جاهز للعمل</p>
               </div>
            </div>

             {/* Card 4: Absent/Vacation */}
            <div className="bg-gradient-to-br from-red-50 to-white p-5 rounded-2xl shadow-sm border border-red-100/50 flex flex-col justify-between group hover:shadow-md transition-all relative overflow-hidden">
               <div className="absolute top-0 left-0 w-24 h-24 bg-red-100/20 rounded-full -translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform"></div>
               <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <AlertCircle className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-red-600 bg-red-100/50 px-2.5 py-1 rounded-full border border-red-100">غياب</span>
               </div>
               <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{statsData.absent}</h3>
                  <p className="text-sm font-medium text-gray-500">إجازة / غياب</p>
               </div>
            </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm print:hidden">
            <div className="relative w-full md:flex-1">
                <input 
                    type="text" 
                    placeholder="بحث سريع (الاسم، الكود، الإقامة)..." 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm pl-10 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
            <div className="w-full md:w-64">
                <SearchableSelect
                    className="w-full"
                    placeholder="تصفية بالمهنة"
                    options={filterSkillOptions}
                    value={filterSkill}
                    onChange={(val) => setFilterSkill(val || '')}
                />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                 {/* Additional Action Buttons can go here if needed */}
                 <button onClick={() => window.print()} className="flex-1 md:flex-none h-[46px] px-4 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 hover:border-gray-300 transition-colors flex items-center justify-center gap-2" title="طباعة">
                    <Printer className="w-4 h-4" />
                    <span className="md:hidden">طباعة</span>
                 </button>
            </div>
        </div>

        {/* Mobile List View */}
        <div className="grid grid-cols-1 gap-3 md:hidden print:hidden">
          {workers.map((w) => {
             const skillLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
             const assignedSite = workerSiteMap.get(w.id) || state.sites.find(s => s.id === w.assignedSiteId);
             const daysIqama = daysRemaining(w.iqamaExpiry);
             const daysIns = daysRemaining(w.insuranceExpiry);
             
             return (
               <div key={w.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col gap-2">
                 <div className="flex justify-between items-start">
                   <div className="flex items-center gap-2">
                     <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                       <Users className="w-4 h-4" />
                     </div>
                     <div>
                       <div className="font-bold text-gray-900 text-sm">{w.name}</div>
                       {w.englishName && <div className="text-xs text-black font-bold mt-0.5">{w.englishName}</div>}
                       <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                         <span>{w.code || '-'}</span>
                         {w.hireDate && (
                            <>
                              <span className="text-gray-300">•</span>
                              <div className="flex flex-col">
                                <span className="text-blue-600 font-sans font-medium">منذ {calculateDaysWorked(w.hireDate)} يوم</span>
                                <span className="text-gray-400 font-sans text-[9px]">{calculateDurationString(w.hireDate)}</span>
                              </div>
                            </>
                         )}
                       </div>
                     </div>
                   </div>
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${w.status === 'active' || !w.status ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                     {w.status === 'active' || !w.status ? 'نشط' : 'مراجعة'}
                   </span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-1.5 text-xs">
                   <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                     <span className="text-gray-500 text-[10px] block mb-0.5">المهنة</span>
                     <span className="font-bold text-gray-800 truncate block">{skillLabel}</span>
                   </div>
                   <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                     <span className="text-gray-500 text-[10px] block mb-0.5">الموقع الحالي</span>
                     <span className={`font-bold truncate block ${assignedSite ? 'text-primary' : 'text-gray-400'}`}>
                       {assignedSite ? assignedSite.name : 'غير معين'}
                     </span>
                   </div>
                   <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                     <span className="text-gray-500 text-[10px] block mb-0.5">الجوال</span>
                     <span className="font-mono text-gray-800" dir="ltr">{w.phone || '-'}</span>
                   </div>
                   <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                     <span className="text-gray-500 text-[10px] block mb-0.5">الإقامة</span>
                     <span className="font-mono text-gray-800">{w.iqamaNumber || '-'}</span>
                   </div>
                   <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                     <span className="text-gray-500 text-[10px] block mb-0.5">انتهاء الإقامة</span>
                     <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${statusClasses(daysIqama)}`}>
                        {daysIqama !== undefined ? `${daysIqama} يوم` : '-'}
                     </span>
                   </div>
                   <div className="bg-gray-50 p-1.5 rounded border border-gray-100">
                     <span className="text-gray-500 text-[10px] block mb-0.5">انتهاء التأمين</span>
                     <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${statusClasses(daysIns)}`}>
                        {daysIns !== undefined ? `${daysIns} يوم` : '-'}
                     </span>
                   </div>
                 </div>

                 <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-1">
                    <div className="flex gap-2">
                       {w.iqamaImage && (
                          <button onClick={() => setViewImage(w.iqamaImage!)} className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors" title="عرض الإقامة">
                            <Eye className="w-4 h-4" />
                          </button>
                       )}
                    </div>
                    <div className="flex gap-2">
                       {(canEdit || canDelete) && (
                         <>
                           {canEdit && (
                             <button onClick={() => startEdit(w)} className="px-3 py-1.5 text-yellow-700 bg-yellow-50 rounded-lg flex items-center gap-1 hover:bg-yellow-100 transition-colors">
                               <Pencil className="w-3.5 h-3.5" />
                               <span className="text-[10px] font-bold">تعديل</span>
                             </button>
                           )}
                           {canDelete && (
                             <button onClick={() => remove(w.id)} className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                               <Trash className="w-4 h-4" />
                             </button>
                           )}
                         </>
                       )}
                    </div>
                 </div>
               </div>
             );
          })}
          {workers.length === 0 && (
             <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300 text-sm">
                لا يوجد عمال مطابقين للبحث
             </div>
          )}
        </div>

        {/* Full Table View for All Screens */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0">
          <div className="overflow-auto custom-scrollbar max-h-[75vh] print:max-h-none print:overflow-visible">
            <table className="w-full text-right border-collapse min-w-full">
              <thead className="bg-gray-50/90 backdrop-blur-md sticky top-0 z-20 border-b border-gray-200 shadow-sm print:static print:bg-gray-100 print:shadow-none">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-12 text-center print:text-black print:border-b-2 print:border-gray-300">#</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-24 print:text-black print:border-b-2 print:border-gray-300">الكود</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[180px] print:text-black print:border-b-2 print:border-gray-300">الاسم</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-28 text-center print:hidden">الحالة</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap print:text-black print:border-b-2 print:border-gray-300">المهنة</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap print:text-black print:border-b-2 print:border-gray-300">الجنسية</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap print:text-black print:border-b-2 print:border-gray-300">رقم الإقامة</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap print:text-black print:border-b-2 print:border-gray-300">الجوال</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap text-center print:text-black print:border-b-2 print:border-gray-300">الإقامة</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap text-center print:text-black print:border-b-2 print:border-gray-300">التأمين</th>
                  {canViewSalary && (
                    <>
                        <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap print:text-black print:border-b-2 print:border-gray-300">البنك</th>
                    </>
                  )}
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[140px] print:text-black print:border-b-2 print:border-gray-300">الموقع الحالي</th>
                  {(canEdit || canDelete) && (
                      <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap text-center sticky left-0 bg-gray-50 shadow-sm z-30 w-24 print:hidden">إجراءات</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {workers.map((w, idx) => {
                  const skillLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                  const assignedSite = workerSiteMap.get(w.id) || state.sites.find(s => s.id === w.assignedSiteId);
                  const daysIqama = daysRemaining(w.iqamaExpiry);
                  const daysIns = daysRemaining(w.insuranceExpiry);

                  return (
                    <tr key={w.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 py-3 text-sm text-gray-500 font-medium text-center">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-semibold font-mono">{w.code || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col max-w-[200px]">
                            <span className="text-sm font-bold text-gray-900 truncate print:whitespace-normal print:overflow-visible" title={w.name}>{w.name}</span>
                            {w.englishName && <span className="text-[10px] text-gray-500 mt-0.5 truncate uppercase font-medium print:whitespace-normal print:overflow-visible" title={w.englishName}>{w.englishName}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center print:hidden">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-bold w-20 ${
                            w.status === 'active' || !w.status 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                            {w.status === 'active' || !w.status ? 'نشط' : 'قيد المراجعة'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            {skillLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{w.nationality || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap">{w.iqamaNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono whitespace-nowrap" dir="ltr">{w.phone || '-'}</td>
                      
                      <td className="px-4 py-3 text-center">
                        {w.iqamaExpiry ? (
                            <div className="flex flex-col items-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${statusClasses(daysIqama)}`}>
                                    {daysIqama !== undefined ? `${daysIqama} يوم` : '-'}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5 font-mono">{w.iqamaExpiry}</span>
                            </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {w.insuranceExpiry ? (
                            <div className="flex flex-col items-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${statusClasses(daysIns)}`}>
                                    {daysIns !== undefined ? `${daysIns} يوم` : '-'}
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5 font-mono">{w.insuranceExpiry}</span>
                            </div>
                        ) : '-'}
                      </td>
                      {canViewSalary && (
                        <>
                            <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="flex flex-col max-w-[120px]">
                                    <span className="truncate text-xs font-medium print:whitespace-normal print:overflow-visible" title={w.bankName}>{w.bankName || '-'}</span>
                                    <span className="text-[10px] text-gray-400 font-mono truncate print:whitespace-normal print:overflow-visible" dir="ltr" title={w.bankAccount}>{w.bankAccount || '-'}</span>
                                </div>
                            </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                         {assignedSite ? (
                             <Link href={`/?search=${encodeURIComponent(assignedSite.name)}`} className="group/site flex items-center gap-1.5 max-w-[160px]">
                                 <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover/site:bg-blue-600 group-hover/site:text-white transition-colors shrink-0">
                                    <MapPin className="w-3 h-3" />
                                 </div>
                                 <span className="text-sm font-medium text-gray-700 truncate group-hover/site:text-blue-700 transition-colors print:whitespace-normal print:overflow-visible" title={assignedSite.name}>
                                    {assignedSite.name}
                                 </span>
                             </Link>
                         ) : (
                             <span className="text-gray-400 text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                غير معين
                             </span>
                         )}
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-blue-50/40 transition-colors z-10 border-r border-gray-100 shadow-sm text-center print:hidden">
                            <div className="flex items-center justify-center gap-1">
                                {w.iqamaImage && (
                                    <>
                                        <button onClick={() => setViewImage(w.iqamaImage!)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="عرض الإقامة">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <a href={w.iqamaImage} download target="_blank" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" title="تحميل الإقامة">
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </>
                                )}
                                {canEdit && (
                                    <button onClick={() => startEdit(w)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all" title="تعديل">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                                {canDelete && (
                                    <button onClick={() => remove(w.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="حذف">
                                        <Trash className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {workers.length === 0 && (
                    <tr>
                        <td colSpan={15} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                                <Users className="w-12 h-12 mb-4 text-gray-300" />
                                <p className="text-lg font-medium text-gray-500">لا يوجد عمال مطابقين للبحث</p>
                                <button onClick={() => {setSearch(''); setFilterSkill('');}} className="mt-2 text-sm text-blue-600 hover:underline">
                                    مسح عوامل التصفية
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Image Modal */}
      {viewImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setViewImage(null)}>
              <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setViewImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full z-10 transition-colors">
                      <X className="w-6 h-6" />
                  </button>
                  <img src={viewImage} alt="عرض" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                    <a href={viewImage} download target="_blank" className="px-6 py-2 bg-white text-gray-900 rounded-full font-medium shadow-lg hover:bg-gray-100 transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" /> تحميل
                    </a>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">تعديل بيانات العامل</h3>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">اسم العامل (عربي)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">اسم العامل (إنجليزي)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left" dir="ltr" value={edit.englishName || ''} onChange={e => setEdit({ ...edit, englishName: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">المهنة</label>
                <SearchableSelect 
                  className="w-full"
                  options={skillOptions}
                  value={edit.skill || ''}
                  onChange={val => setEdit({ ...edit, skill: val || '' })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">رقم الإقامة</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.iqamaNumber || ''} onChange={e => setEdit({ ...edit, iqamaNumber: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">صورة الإقامة</label>
                <div className="flex gap-2">
                    <input type="file" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" onChange={(e) => handleFileUpload(e, true)} />
                    {edit.iqamaImage && (
                        <div className="flex gap-1">
                            <button type="button" onClick={() => setViewImage(edit.iqamaImage!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100" title="عرض الصورة">
                                <Eye className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setEdit({ ...edit, iqamaImage: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100" title="حذف الصورة">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">الجنسية</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.nationality || ''} onChange={e => setEdit({ ...edit, nationality: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">تاريخ التعيين</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.hireDate || ''} onChange={e => setEdit({ ...edit, hireDate: e.target.value })} />
                {edit.hireDate && (
                    <div className="mt-1 flex flex-col gap-0.5">
                        <div className="text-xs text-blue-600 font-bold">
                            منذ {calculateDaysWorked(edit.hireDate)} يوم
                        </div>
                        <div className="text-xs text-gray-500 font-bold">
                            {calculateDurationString(edit.hireDate)}
                        </div>
                    </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">رقم الجوال</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.phone || ''} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">انتهاء الإقامة</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.iqamaExpiry || ''} onChange={e => setEdit({ ...edit, iqamaExpiry: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">انتهاء التأمين</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.insuranceExpiry || ''} onChange={e => setEdit({ ...edit, insuranceExpiry: e.target.value })} />
              </div>
              {canViewSalary && (
                  <>
                    <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">اسم البنك</label>
                        <input className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={edit.bankName || ''} onChange={e => setEdit({ ...edit, bankName: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-700 mb-1 block">رقم الحساب (IBAN)</label>
                        <input className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono" dir="ltr" value={edit.bankAccount || ''} onChange={e => setEdit({ ...edit, bankAccount: e.target.value })} />
                    </div>
                  </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
              <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">إلغاء</button>
              <button onClick={saveEdit} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 shadow-sm transition-colors">حفظ التغييرات</button>
            </div>
          </div>
        </div>
      )}
      {/* Skills Management Modal */}
      {isManagingSkills && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <h3 className="text-xl font-bold text-gray-800">إدارة المهن</h3>
              <button onClick={() => setIsManagingSkills(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {/* Add New Skill */}
              <div className="mb-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" />
                    إضافة مهنة جديدة
                </h4>
                <form onSubmit={handleAddSkill} className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                        <input 
                            type="text" 
                            placeholder="الاسم البرمجي (مثال: Carpenter)" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
                            dir="ltr"
                            value={newSkillName}
                            onChange={(e) => setNewSkillName(e.target.value)}
                            required
                        />
                        <p className="text-[10px] text-gray-500 mt-1 mr-1">يستخدم في الكود والفلترة (إنجليزي)</p>
                    </div>
                    <div className="flex-1">
                        <input 
                            type="text" 
                            placeholder="الاسم الظاهر (مثال: نجار)" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" 
                            value={newSkillLabel}
                            onChange={(e) => setNewSkillLabel(e.target.value)}
                            required
                        />
                        <p className="text-[10px] text-gray-500 mt-1 mr-1">يظهر في البطاقات والجداول (عربي)</p>
                    </div>
                    <button type="submit" className="h-[38px] px-6 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium whitespace-nowrap shadow-sm transition-colors flex items-center gap-2 self-start">
                        <Check className="w-4 h-4" />
                        إضافة
                    </button>
                </form>
              </div>

              {/* Skills List */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-700 mb-2 text-sm px-1">المهن الحالية ({state.skills.length})</h4>
                {state.skills.map(skill => (
                    <div key={skill.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm hover:border-gray-200 transition-all group">
                        {editingSkillId === skill.id ? (
                            <div className="flex items-center gap-2 flex-1 animate-in fade-in">
                                <span className="text-gray-400 text-xs font-mono w-24 truncate" title={skill.name}>{skill.name}</span>
                                <input 
                                    type="text" 
                                    className="flex-1 px-3 py-1.5 border border-blue-300 ring-2 ring-blue-100 rounded-lg text-sm"
                                    value={editSkillLabel}
                                    onChange={(e) => setEditSkillLabel(e.target.value)}
                                    autoFocus
                                    placeholder="تعديل الاسم..."
                                />
                                <div className="flex items-center gap-1 mr-2">
                                    <button onClick={() => handleUpdateSkill(skill.id)} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors" title="حفظ">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setEditingSkillId(null)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="إلغاء">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-100 font-bold text-lg`}>
                                        {skill.label.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900">{skill.label}</div>
                                        <div className="text-xs text-gray-400 font-mono mt-0.5">{skill.name}</div>
                                    </div>
                                </div>
                                {(isAdmin || isSupervisor) && (
                                    <button 
                                        onClick={() => {
                                            setEditingSkillId(skill.id);
                                            setEditSkillLabel(skill.label);
                                        }}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="تعديل المسمى"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end">
                <button onClick={() => setIsManagingSkills(false)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors">
                    إغلاق
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Expiry Stats Modal */}
      {selectedStatsCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-medium text-lg text-gray-800 flex items-center gap-2">
                {selectedStatsCategory.label}
              </h3>
              <button onClick={() => setSelectedStatsCategory(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="space-y-2">
                {state.workers
                  .filter(w => {
                      const days = selectedStatsCategory.type === 'iqama' 
                          ? daysRemaining(w.iqamaExpiry) 
                          : daysRemaining(w.insuranceExpiry);
                      
                      if (days === undefined) return false;
                      
                      if (selectedStatsCategory.status === 'red') return days <= 5;
                      if (selectedStatsCategory.status === 'yellow') return days > 5 && days <= 10;
                      if (selectedStatsCategory.status === 'green') return days > 10;
                      return false;
                  })
                  .map(w => {
                    const days = selectedStatsCategory.type === 'iqama' 
                        ? daysRemaining(w.iqamaExpiry) 
                        : daysRemaining(w.insuranceExpiry);
                    
                    return (
                      <div key={w.id} className="p-3 bg-gray-50 rounded border border-gray-100 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-800">
                              {w.name}
                              {w.code && <span className="text-black font-normal text-xs mx-1">({w.code})</span>}
                          </div>
                          <div className="text-xs text-gray-500">{w.phone || 'لا يوجد رقم'}</div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded border ${
                            (days !== undefined && days <= 5) ? 'bg-red-50 text-red-700 border-red-100' :
                            (days !== undefined && days <= 10) ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                            'bg-green-50 text-green-700 border-green-100'
                        }`}>
                          {days === 0 ? 'منتهي' : `${days} يوم`}
                        </div>
                      </div>
                    );
                  })}
                  {state.workers.filter(w => {
                      const days = selectedStatsCategory.type === 'iqama' 
                          ? daysRemaining(w.iqamaExpiry) 
                          : daysRemaining(w.insuranceExpiry);
                      
                      if (days === undefined) return false;
                      
                      if (selectedStatsCategory.status === 'red') return days <= 5;
                      if (selectedStatsCategory.status === 'yellow') return days > 5 && days <= 10;
                      if (selectedStatsCategory.status === 'green') return days > 10;
                      return false;
                  }).length === 0 && (
                    <div className="text-center text-gray-500 py-4">لا يوجد عمال في هذه القائمة</div>
                  )}
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedStatsCategory(null)} className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-medium">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
