'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { Vehicle, MaintenanceRecord, ViolationRecord } from '@/types';
import SearchableSelect from '@/components/SearchableSelect';
import { Wrench, AlertTriangle, Plus, Trash2, X, Calendar, DollarSign, FileText, User, Pencil, Printer, Filter, Eye, Upload, Download, Car, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

export default function VehiclesPage() {
  const { user } = useAuth();
  const { state, setState } = useAppState();
  const [search, setSearch] = useState('');
  const [viewImage, setViewImage] = useState<string | null>(null); // State for viewing image
  
  // Protect page: Only Admin and Supervisor
  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 animate-fade-in">
          <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">غير مصرح</h1>
            <p className="text-gray-600 mb-4">ليس لديك صلاحية للوصول إلى هذه الصفحة.</p>
            <Link href="/" className="text-primary hover:underline font-medium">العودة للرئيسية</Link>
          </div>
        </div>
      );
  }

  // Ensure vehicles array exists
  const vehicles = useMemo(() => {
    return (state.vehicles || []).filter(v => 
      v.plateNumber.includes(search) || 
      v.type.includes(search) ||
      (v.model || '').includes(search)
    );
  }, [state.vehicles, search]);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'maintenance' | 'violations'>('maintenance');
  
  // Edit States for Modal Items
  const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(null);
  const [editingViolationId, setEditingViolationId] = useState<string | null>(null);
  const [originalViolationVehicleId, setOriginalViolationVehicleId] = useState<string | null>(null);

  // Violation Search State
  const [showViolationsSearch, setShowViolationsSearch] = useState(false);
  const [violationSearchQuery, setViolationSearchQuery] = useState('');
  const [violationSearchDriver, setViolationSearchDriver] = useState('');
  const [violationSearchVehicle, setViolationSearchVehicle] = useState('');
  const [violationSearchStartDate, setViolationSearchStartDate] = useState('');
  const [violationSearchEndDate, setViolationSearchEndDate] = useState('');

  // Maintenance Search State
  const [showMaintenanceSearch, setShowMaintenanceSearch] = useState(false);
  const [maintenanceSearchQuery, setMaintenanceSearchQuery] = useState('');
  const [maintenanceSearchVehicle, setMaintenanceSearchVehicle] = useState('');
  const [maintenanceSearchStartDate, setMaintenanceSearchStartDate] = useState('');
  const [maintenanceSearchEndDate, setMaintenanceSearchEndDate] = useState('');
  const [maintenanceSearchType, setMaintenanceSearchType] = useState('');

  const vehicleOptions = useMemo(() => {
    return (state.vehicles || []).map(v => ({
      value: v.id,
      label: `${v.type} - ${v.plateNumber}`
    }));
  }, [state.vehicles]);

  const workerOptions = useMemo(() => {
    return state.workers.map(w => ({
      value: w.id,
      label: w.name
    }));
  }, [state.workers]);

  const maintenanceTypeOptions = [
      { value: 'repair', label: 'إصلاح' },
      { value: 'oil_change', label: 'غيار زيت' },
      { value: 'other', label: 'أخرى' }
  ];



  const violationSearchResults = useMemo(() => {
    const query = violationSearchQuery.toLowerCase();
    const results: { vehicle: Vehicle; violation: ViolationRecord }[] = [];

    (state.vehicles || []).forEach(vehicle => {
      // If vehicle filter is active and doesn't match, skip this vehicle entirely
      if (violationSearchVehicle && vehicle.id !== violationSearchVehicle) return;

      vehicle.violations.forEach(violation => {
        // Driver Filter
        if (violationSearchDriver && violation.driverId !== violationSearchDriver) return;

        // Date Range Filter
        if (violationSearchStartDate && violation.date < violationSearchStartDate) return;
        if (violationSearchEndDate && violation.date > violationSearchEndDate) return;

        // Text Search Filter
        if (query) {
           const matchDriver = violation.driverName?.toLowerCase().includes(query);
           const matchPlate = vehicle.plateNumber.toLowerCase().includes(query);
           const matchViolationNumber = violation.violationNumber?.toLowerCase().includes(query);
           const matchDesc = violation.description?.toLowerCase().includes(query);
           
           if (!matchDriver && !matchPlate && !matchViolationNumber && !matchDesc) return;
        }
        
        results.push({ vehicle, violation });
      });
    });

    return results;
  }, [state.vehicles, violationSearchQuery, violationSearchDriver, violationSearchVehicle, violationSearchStartDate, violationSearchEndDate]);

  const maintenanceSearchResults = useMemo(() => {
    const query = maintenanceSearchQuery.toLowerCase();
    const results: { vehicle: Vehicle; maintenance: MaintenanceRecord }[] = [];

    (state.vehicles || []).forEach(vehicle => {
      // If vehicle filter is active and doesn't match, skip this vehicle entirely
      if (maintenanceSearchVehicle && vehicle.id !== maintenanceSearchVehicle) return;

      (vehicle.maintenanceHistory || []).forEach(maintenance => {
        // Type Filter
        if (maintenanceSearchType && maintenance.type !== maintenanceSearchType) return;

        // Date Range Filter
        if (maintenanceSearchStartDate && maintenance.date < maintenanceSearchStartDate) return;
        if (maintenanceSearchEndDate && maintenance.date > maintenanceSearchEndDate) return;

        // Text Search Filter
        if (query) {
           const matchPlate = vehicle.plateNumber.toLowerCase().includes(query);
           const matchNotes = maintenance.notes?.toLowerCase().includes(query);
           
           if (!matchPlate && !matchNotes) return;
        }
        
        results.push({ vehicle, maintenance });
      });
    });

    return results;
  }, [state.vehicles, maintenanceSearchQuery, maintenanceSearchVehicle, maintenanceSearchType, maintenanceSearchStartDate, maintenanceSearchEndDate]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'registrationImage' | 'insuranceImage' = 'registrationImage') => {
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
        setForm(prev => ({ ...prev, [field]: data.url }));
    } catch (err: any) {
        console.error(err);
        alert(`فشل تحميل الملف: ${err.message}`);
    }
  };

  const handlePrintViolations = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const data = vehicles.map(v => ({
      'كود المركبة': v.code || '',
      'رقم اللوحة': v.plateNumber,
      'النوع': v.type,
      'الموديل': v.model || '',
      'سنة الصنع': v.year || '',
      'انتهاء الاستمارة': v.registrationExpiry || '',
      'انتهاء الفحص': v.periodicInspectionExpiry || '',
      'انتهاء التأمين': v.insuranceExpiry || '',
      'غيار الزيت الحالي': v.oilChangeCurrentDate || '',
      'غيار الزيت القادم': v.oilChangeNextDate || ''
    }));

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "المركبات");
    writeFile(wb, "vehicles_report.xlsx");
  };

  const selectedVehicle = useMemo(() => 
    state.vehicles?.find(v => v.id === selectedVehicleId), 
    [state.vehicles, selectedVehicleId]
  );

  const [form, setForm] = useState<Omit<Vehicle, 'id' | 'maintenanceHistory' | 'violations'>>({
    code: '',
    plateNumber: '',
    type: '',
    model: '',
    year: '',
    registrationImage: '',
    insuranceImage: '',
    registrationExpiry: '',
    periodicInspectionExpiry: '',
    insuranceExpiry: '',
    oilChangeCurrentDate: '',
    oilChangeNextDate: '',
  });

  const getExpiryStatus = (dateString?: string) => {
    if (!dateString) return { status: 'غير محدد', color: 'bg-gray-100 text-gray-600 border-gray-200', days: null };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(dateString);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status = '';
    let color = '';
    
    if (diffDays > 10) {
      status = 'ساري';
      color = 'bg-green-100 text-green-700 border-green-200';
    } else if (diffDays >= 5) {
      status = 'على وشك الانتهاء';
      color = 'bg-amber-100 text-amber-700 border-amber-200';
    } else {
      status = 'منتهي';
      color = 'bg-red-100 text-red-700 border-red-200';
    }
    
    return { status, color, days: diffDays };
  };

  const getOilStatus = (nextDate?: string) => {
    if (!nextDate) return { status: 'غير محدد', color: 'bg-gray-100 text-gray-600 border-gray-200', days: null, due: false, soon: false };
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(nextDate);
    target.setHours(0,0,0,0);
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000*60*60*24));
    const due = diffDays <= 0;
    const soon = diffDays > 0 && diffDays <= 3;
    const color = due ? 'bg-red-100 text-red-700 border-red-200' : (soon ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200');
    const status = due ? 'مستحق' : (soon ? 'قرب الموعد' : 'بعيد');
    return { status, color, days: diffDays, due, soon };
  };

  // Maintenance Form State
  const [mForm, setMForm] = useState<Partial<MaintenanceRecord>>({
    date: new Date().toISOString().split('T')[0],
    type: 'repair',
    cost: 0,
    notes: '',
    withFilter: false
  });

  const getCurrentTime = () => {
    // Get current time in HH:mm format (24-hour)
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  // Violation Form State
  const [vForm, setVForm] = useState<Partial<ViolationRecord>>({
    date: new Date().toISOString().split('T')[0],
    time: getCurrentTime(),
    type: '',
    city: '',
    cost: 0,
    violationNumber: '',
    description: '',
    driverId: ''
  });

  const resetForm = () => {
    setForm({ 
      code: '', 
      plateNumber: '', 
      type: '', 
      model: '', 
      year: '', 
      registrationImage: '',
      insuranceImage: '',
      registrationExpiry: '',
      periodicInspectionExpiry: '',
      insuranceExpiry: '',
      oilChangeCurrentDate: '',
      oilChangeNextDate: '',
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer' || user?.role === 'accountant') return;
    if (!form.plateNumber || !form.type) return;

    // Check for duplicate plate number
    const isDuplicate = (state.vehicles || []).some(v => 
      v.plateNumber.trim() === form.plateNumber.trim()
    );

    if (isDuplicate) {
      alert('رقم اللوحة مسجل مسبقاً، يرجى استخدام رقم آخر.');
      return;
    }

    const newVehicle: Vehicle = {
      id: `v-${Date.now()}`,
      code: form.code,
      plateNumber: form.plateNumber,
      type: form.type,
      model: form.model,
      year: form.year,
      registrationImage: form.registrationImage,
      insuranceImage: form.insuranceImage,
      registrationExpiry: form.registrationExpiry,
      periodicInspectionExpiry: form.periodicInspectionExpiry,
      insuranceExpiry: form.insuranceExpiry,
      oilChangeCurrentDate: form.oilChangeCurrentDate,
      oilChangeNextDate: form.oilChangeNextDate,
      maintenanceHistory: [],
      violations: []
    };

    setState(prev => ({
      ...prev,
      vehicles: [newVehicle, ...(prev.vehicles || [])]
    }));
    resetForm();
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      code: v.code || '',
      plateNumber: v.plateNumber,
      type: v.type,
      model: v.model || '',
      year: v.year || '',
      registrationImage: v.registrationImage || '',
      insuranceImage: v.insuranceImage || '',
      registrationExpiry: v.registrationExpiry || '',
      periodicInspectionExpiry: v.periodicInspectionExpiry || '',
      insuranceExpiry: v.insuranceExpiry || '',
      oilChangeCurrentDate: v.oilChangeCurrentDate || '',
      oilChangeNextDate: v.oilChangeNextDate || '',
    });
    setIsAdding(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    // Check for duplicate plate number (excluding current vehicle)
    const isDuplicate = (state.vehicles || []).some(v => 
      v.id !== editingId && v.plateNumber.trim() === form.plateNumber.trim()
    );

    if (isDuplicate) {
      alert('رقم اللوحة مسجل لمركبة أخرى، يرجى استخدام رقم آخر.');
      return;
    }

    setState(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(v => v.id === editingId ? {
        ...v,
        code: form.code,
        plateNumber: form.plateNumber,
        type: form.type,
        model: form.model,
        year: form.year,
        registrationImage: form.registrationImage,
        insuranceImage: form.insuranceImage,
        registrationExpiry: form.registrationExpiry,
        periodicInspectionExpiry: form.periodicInspectionExpiry,
        insuranceExpiry: form.insuranceExpiry,
        oilChangeCurrentDate: form.oilChangeCurrentDate,
        oilChangeNextDate: form.oilChangeNextDate,
      } : v)
    }));
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (user?.role === 'viewer' || user?.role === 'accountant') return;
    if (window.confirm('هل أنت متأكد من حذف هذه المركبة؟')) {
      setState(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).filter(v => v.id !== id)
    }));
    }
  };

  const startEditMaintenance = (record: MaintenanceRecord) => {
    setEditingMaintenanceId(record.id);
    setMForm({
      date: record.date,
      type: record.type,
      cost: record.cost,
      notes: record.notes || '',
      withFilter: record.withFilter || false
    });
  };

  const cancelEditMaintenance = () => {
    setEditingMaintenanceId(null);
    setMForm({
      date: new Date().toISOString().split('T')[0],
      type: 'repair',
      cost: 0,
      notes: '',
      withFilter: false
    });
  };

  const addMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer' || user?.role === 'accountant') return;
    if (!selectedVehicleId) return;

    if (editingMaintenanceId) {
      // Update existing
      setState(prev => ({
        ...prev,
        vehicles: (prev.vehicles || []).map(v => v.id === selectedVehicleId ? {
          ...v,
          maintenanceHistory: v.maintenanceHistory.map(m => m.id === editingMaintenanceId ? {
            ...m,
            date: mForm.date || '',
            type: mForm.type as any,
            cost: Number(mForm.cost),
            notes: mForm.notes,
            withFilter: mForm.withFilter
          } : m)
        } : v)
      }));
      cancelEditMaintenance();
    } else {
      // Add new
      const record: MaintenanceRecord = {
        id: `m-${Date.now()}`,
        date: mForm.date || '',
        type: mForm.type as any,
        cost: Number(mForm.cost),
        notes: mForm.notes,
        withFilter: mForm.withFilter
      };

      setState(prev => ({
        ...prev,
        vehicles: (prev.vehicles || []).map(v => v.id === selectedVehicleId ? {
          ...v,
          maintenanceHistory: [record, ...v.maintenanceHistory]
        } : v)
      }));

      setMForm({
        date: new Date().toISOString().split('T')[0],
        type: 'repair',
        cost: 0,
        notes: '',
        withFilter: false
      });
    }
  };

  const deleteMaintenance = (mId: string) => {
    if (!confirm('حذف سجل الصيانة؟')) return;
    if (!selectedVehicleId) return;

    setState(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(v => v.id === selectedVehicleId ? {
        ...v,
        maintenanceHistory: v.maintenanceHistory.filter(m => m.id !== mId)
      } : v)
    }));
  };

  const startEditViolation = (record: ViolationRecord) => {
    setEditingViolationId(record.id);
    setOriginalViolationVehicleId(selectedVehicleId);
    setVForm({
      date: record.date,
      time: record.time,
      type: record.type,
      city: record.city,
      cost: record.cost,
      violationNumber: record.violationNumber || '',
      description: record.description || '',
      driverId: record.driverId || ''
    });
  };

  const cancelEditViolation = () => {
    setEditingViolationId(null);
    setOriginalViolationVehicleId(null);
    setVForm({
      date: new Date().toISOString().split('T')[0],
      time: getCurrentTime(),
      type: '',
      city: '',
      cost: 0,
      violationNumber: '',
      description: '',
      driverId: ''
    });
  };

  const addViolation = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer' || user?.role === 'accountant') return;
    if (!selectedVehicleId) return;

    const driverName = state.workers.find(w => w.id === vForm.driverId)?.name;

    // Check for duplicate violation number across all vehicles
    if (vForm.violationNumber && vForm.violationNumber.trim()) {
      const violationNumber = vForm.violationNumber.trim();
      const isDuplicate = (state.vehicles || []).some(v => 
        v.violations.some(vio => 
          vio.violationNumber?.trim() === violationNumber && 
          vio.id !== editingViolationId
        )
      );

      if (isDuplicate) {
        alert('رقم المخالفة مسجل مسبقاً، يرجى التحقق من الرقم.');
        return;
      }
    }

    if (editingViolationId) {
      // Update existing
      if (originalViolationVehicleId && originalViolationVehicleId !== selectedVehicleId) {
        // Move violation to new vehicle
        setState(prev => {
          // 1. Remove from old vehicle
          const vehiclesAfterRemove = (prev.vehicles || []).map(v => 
            v.id === originalViolationVehicleId 
            ? { ...v, violations: v.violations.filter(vio => vio.id !== editingViolationId) }
            : v
          );
          
          // 2. Create updated record
          const updatedRecord: ViolationRecord = {
            id: editingViolationId,
            date: vForm.date || '',
            time: vForm.time || '',
            type: vForm.type || '',
            city: vForm.city || '',
            cost: Number(vForm.cost),
            violationNumber: vForm.violationNumber,
            description: vForm.description,
            driverId: vForm.driverId,
            driverName: driverName
          };

          // 3. Add to new vehicle
          return {
            ...prev,
            vehicles: vehiclesAfterRemove.map(v => 
              v.id === selectedVehicleId
              ? { ...v, violations: [updatedRecord, ...v.violations] }
              : v
            )
          };
        });
      } else {
        // Update in same vehicle
        setState(prev => ({
          ...prev,
          vehicles: (prev.vehicles || []).map(v => v.id === selectedVehicleId ? {
            ...v,
            violations: v.violations.map(vio => vio.id === editingViolationId ? {
              ...vio,
              date: vForm.date || '',
              time: vForm.time || '',
              type: vForm.type || '',
              city: vForm.city || '',
              cost: Number(vForm.cost),
              violationNumber: vForm.violationNumber,
              description: vForm.description,
              driverId: vForm.driverId,
              driverName: driverName
            } : vio)
          } : v)
        }));
      }
      cancelEditViolation();
    } else {
      // Add new
      const record: ViolationRecord = {
        id: `vio-${Date.now()}`,
        date: vForm.date || '',
        time: vForm.time || '',
        type: vForm.type || '',
        city: vForm.city || '',
        cost: Number(vForm.cost),
        violationNumber: vForm.violationNumber,
        description: vForm.description,
        driverId: vForm.driverId,
        driverName: driverName
      };

      setState(prev => ({
        ...prev,
        vehicles: (prev.vehicles || []).map(v => v.id === selectedVehicleId ? {
          ...v,
          violations: [record, ...v.violations]
        } : v)
      }));

      setVForm({
        date: new Date().toISOString().split('T')[0],
        time: getCurrentTime(),
        type: '',
        city: '',
        cost: 0,
        violationNumber: '',
        description: '',
        driverId: ''
      });
    }
  };

  const deleteViolation = (vId: string) => {
    if (!confirm('حذف المخالفة؟')) return;
    if (!selectedVehicleId) return;

    setState(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).map(v => v.id === selectedVehicleId ? {
        ...v,
        violations: v.violations.filter(vio => vio.id !== vId)
      } : v)
    }));
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans pb-8 animate-fade-in font-cairo">
      <div className="w-full max-w-[1920px] mx-auto p-4 md:p-6 lg:p-8">
        <div className={showViolationsSearch || showMaintenanceSearch ? 'print:hidden' : ''}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-cairo">إدارة المركبات</h1>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold print:hidden">
              الرئيسية
            </Link>
             <Link href="/projects" className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold print:hidden">
              المشاريع
            </Link>
            <button 
              onClick={handlePrintViolations}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold flex items-center gap-2 print:hidden"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-bold flex items-center gap-2 print:hidden"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تصدير إكسل
            </button>
            <button 
              onClick={() => setShowViolationsSearch(true)}
              className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-bold flex items-center gap-2 print:hidden"
            >
              <AlertTriangle className="w-4 h-4" />
              بحث المخالفات
            </button>
            <button 
              onClick={() => setShowMaintenanceSearch(true)}
              className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-bold flex items-center gap-2 print:hidden"
            >
              <Wrench className="w-4 h-4" />
              تقرير الصيانة
            </button>
            {(user?.role as string) !== 'viewer' && (
              <button 
                onClick={() => { resetForm(); setIsAdding(!isAdding); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm print:hidden"
              >
                {isAdding ? 'إلغاء' : 'إضافة مركبة'}
              </button>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        {(isAdding || editingId) && (
          <form onSubmit={editingId ? handleSave : handleAdd} className="mb-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm space-y-5">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 font-cairo">
              {editingId ? 'تعديل مركبة' : 'إضافة مركبة جديدة'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">رقم اللوحة</label>
                <input 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  value={form.plateNumber}
                  onChange={e => setForm({ ...form, plateNumber: e.target.value })}
                  required
                  placeholder="مثال: أ ب ج 1234"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">كود المركبة</label>
                <input 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  value={form.code || ''}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  placeholder="مثال: V-001"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">النوع</label>
                <input 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  required
                  placeholder="مثال: دينا، باص، سيدان"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">الموديل</label>
                <input 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  value={form.model || ''}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                  placeholder="مثال: تويوتا هايلكس"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">سنة الصنع</label>
                <input 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  value={form.year || ''}
                  onChange={e => setForm({ ...form, year: e.target.value })}
                  placeholder="مثال: 2023"
                />
              </div>

              <div className="md:col-span-2 mt-2">
                <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  تواريخ الانتهاء
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">تاريخ انتهاء الاستمارة</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm"
                      value={form.registrationExpiry || ''}
                      onChange={e => setForm({ ...form, registrationExpiry: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">تاريخ انتهاء الفحص</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm"
                      value={form.periodicInspectionExpiry || ''}
                      onChange={e => setForm({ ...form, periodicInspectionExpiry: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">تاريخ انتهاء التأمين (اختياري)</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm"
                      value={form.insuranceExpiry || ''}
                      onChange={e => setForm({ ...form, insuranceExpiry: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-2 mt-2">
                <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  مواعيد غيار الزيت
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">تاريخ غيار الزيت الحالي</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold text-sm"
                      value={form.oilChangeCurrentDate || ''}
                      onChange={e => setForm({ ...form, oilChangeCurrentDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">تاريخ الغيار القادم</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold text-sm"
                      value={form.oilChangeNextDate || ''}
                      onChange={e => setForm({ ...form, oilChangeNextDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">صورة رخصة السير</label>
                  <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                          <input 
                              type="file" 
                              accept="image/*,.pdf"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 font-bold"
                              onChange={(e) => handleFileUpload(e, 'registrationImage')} 
                          />
                      </div>
                      {form.registrationImage && (
                          <div className="flex gap-2">
                              <button type="button" onClick={() => setViewImage(form.registrationImage!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center gap-1" title="عرض">
                                  <Eye className="w-5 h-5" />
                                  <span className="text-sm font-bold">عرض</span>
                              </button>
                              <a href={form.registrationImage} download target="_blank" className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 flex items-center gap-1" title="تحميل">
                                  <Download className="w-5 h-5" />
                              </a>
                              {(user?.role as string) !== 'viewer' && (
                                  <button type="button" onClick={() => setForm({ ...form, registrationImage: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 flex items-center gap-1" title="حذف">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              )}
                          </div>
                      )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">صورة وثيقة التأمين (اختياري)</label>
                  <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                          <input 
                              type="file" 
                              accept="image/*,.pdf"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 font-bold"
                              onChange={(e) => handleFileUpload(e, 'insuranceImage')} 
                          />
                      </div>
                      {form.insuranceImage && (
                          <div className="flex gap-2">
                              <button type="button" onClick={() => setViewImage(form.insuranceImage!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center gap-1" title="عرض">
                                  <Eye className="w-5 h-5" />
                                  <span className="text-sm font-bold">عرض</span>
                              </button>
                              <a href={form.insuranceImage} download target="_blank" className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 flex items-center gap-1" title="تحميل">
                                  <Download className="w-5 h-5" />
                              </a>
                              {(user?.role as string) !== 'viewer' && (
                                  <button type="button" onClick={() => setForm({ ...form, insuranceImage: '' })} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 flex items-center gap-1" title="حذف">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              )}
                          </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button" 
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-bold"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
              >
                {editingId ? 'حفظ التغييرات' : 'حفظ المركبة'}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {vehicles.map(v => (
            <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{v.type}</div>
                    <div className="flex items-center gap-2">
                        {v.code && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{v.code}</span>}
                        <div className="text-sm text-gray-500 font-mono">{v.plateNumber}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500 text-xs block mb-1">الموديل</span>
                  <span className="font-bold text-gray-800">{v.model || '-'}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500 text-xs block mb-1">السنة</span>
                  <span className="font-mono text-gray-800">{v.year || '-'}</span>
                </div>
                
                <div className="bg-gray-50 p-2 rounded col-span-2">
                    <span className="text-gray-500 text-xs block mb-2 font-bold border-b pb-1">تواريخ الانتهاء</span>
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 font-bold">الاستمارة ({v.registrationExpiry || '-'}):</span>
                            {(() => {
                                const { status, color, days } = getExpiryStatus(v.registrationExpiry);
                                if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                                return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${color} font-bold`}>{status} ({days} يوم)</span>;
                            })()}
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 font-bold">الفحص ({v.periodicInspectionExpiry || '-'}):</span>
                            {(() => {
                                const { status, color, days } = getExpiryStatus(v.periodicInspectionExpiry);
                                if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                                return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${color} font-bold`}>{status} ({days} يوم)</span>;
                            })()}
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 font-bold">التأمين ({v.insuranceExpiry || '-'}):</span>
                            {(() => {
                                const { status, color, days } = getExpiryStatus(v.insuranceExpiry);
                                if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                                return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${color} font-bold`}>{status} ({days} يوم)</span>;
                            })()}
                        </div>
                    </div>
                </div>
              </div>

              {v.registrationImage && (
                 <div className="flex gap-2 bg-gray-50 p-2 rounded items-center">
                    <span className="text-gray-500 text-xs font-bold">رخصة السير:</span>
                    <button onClick={() => setViewImage(v.registrationImage!)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-200">
                        <Eye className="w-3 h-3" />
                        عرض
                    </button>
                    <a href={v.registrationImage} download target="_blank" className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center gap-1 hover:bg-green-200">
                        <Download className="w-3 h-3" />
                        تحميل
                    </a>
                 </div>
              )}

              {v.insuranceImage && (
                 <div className="flex gap-2 bg-gray-50 p-2 rounded items-center">
                    <span className="text-gray-500 text-xs font-bold">وثيقة التأمين:</span>
                    <button onClick={() => setViewImage(v.insuranceImage!)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center gap-1 hover:bg-blue-200">
                        <Eye className="w-3 h-3" />
                        عرض
                    </button>
                    <a href={v.insuranceImage} download target="_blank" className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center gap-1 hover:bg-green-200">
                        <Download className="w-3 h-3" />
                        تحميل
                    </a>
                 </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-1 gap-2">
                 <button 
                    onClick={() => { setSelectedVehicleId(v.id); setActiveTab('maintenance'); }}
                    className="flex-1 py-2 text-amber-700 bg-amber-50 rounded-lg flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors text-xs font-bold"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    الصيانة
                  </button>
                 
                 {user?.role !== 'viewer' && (
                   <div className="flex gap-2">
                      <button onClick={() => startEdit(v)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                 )}
              </div>
            </div>
          ))}
          {vehicles.length === 0 && (
             <div className="text-center py-10 text-gray-500 font-bold bg-white rounded-xl border border-dashed border-gray-300">
                لا توجد مركبات مضافة حالياً
             </div>
          )}
        </div>

        <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-800 font-cairo">قائمة المركبات ({vehicles.length})</h2>
            <input 
              placeholder="بحث برقم اللوحة أو النوع..." 
              className="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold print:hidden"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          {/* Oil change reminders */}
          {(() => {
            const reminders = (vehicles || []).map(v => ({ v, s: getOilStatus(v.oilChangeNextDate) }));
            const due = reminders.filter(r => r.s.due);
            const soon = reminders.filter(r => r.s.soon);
            if (due.length === 0 && soon.length === 0) return null;
            return (
              <div className="mx-6 my-4 p-3 rounded-xl border print:hidden flex items-center justify-between"
                   style={{ borderColor: '#FDE68A', background: '#FFFBEB' }}>
                <div className="flex items-center gap-2 text-amber-700 font-bold">
                  <AlertTriangle className="w-5 h-5" />
                  {due.length > 0 && <span>مستحق: {due.length}</span>}
                  {soon.length > 0 && <span>قريب: {soon.length}</span>}
                </div>
                <div className="text-xs text-amber-800 font-bold flex flex-wrap gap-2">
                  {[...due.slice(0,3), ...soon.slice(0,3)].map((r, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded border ${r.s.due ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {r.v.plateNumber} • {r.v.oilChangeNextDate} ({r.s.days}ي)
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">المركبة</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">التفاصيل</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">انتهاء الاستمارة</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">انتهاء الفحص</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">انتهاء التأمين</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">غيار الزيت الحالي</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide">الغيار القادم</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide print:hidden">رخصة السير</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide print:hidden">وثيقة التأمين</th>
                  <th className="px-6 py-3 text-xs font-bold text-gray-600 whitespace-nowrap tracking-wide print:hidden">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-blue-50/60 even:bg-gray-50/50 transition-colors group">
                     <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1">
                            <span className="font-black text-gray-900 text-base" dir="ltr">{v.plateNumber}</span>
                            {v.code && <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 w-fit">{v.code}</span>}
                        </div>
                     </td>
                     <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-gray-800">{v.type}</span>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <span>{v.model || '-'}</span>
                                {v.year && <span>• {v.year}</span>}
                            </div>
                        </div>
                     </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                        {(() => {
                            const { status, color, days } = getExpiryStatus(v.registrationExpiry);
                            if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                            return (
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-900 font-bold text-[13px] font-mono tabular-nums" dir="ltr">{v.registrationExpiry}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border w-fit ${color} text-[11px] font-bold`}>
                                {status} ({days} يوم)
                                </span>
                            </div>
                            );
                        })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                        {(() => {
                            const { status, color, days } = getExpiryStatus(v.periodicInspectionExpiry);
                            if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                            return (
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-900 font-bold text-[13px] font-mono tabular-nums" dir="ltr">{v.periodicInspectionExpiry}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border w-fit ${color} text-[11px] font-bold`}>
                                {status} ({days} يوم)
                                </span>
                            </div>
                            );
                        })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                        {(() => {
                            const { status, color, days } = getExpiryStatus(v.insuranceExpiry);
                            if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                            return (
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-900 font-bold text-[13px] font-mono tabular-nums" dir="ltr">{v.insuranceExpiry}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border w-fit ${color} text-[11px] font-bold`}>
                                {status} ({days} يوم)
                                </span>
                            </div>
                            );
                        })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                      {v.oilChangeCurrentDate 
                        ? <span className="text-gray-900 font-bold text-[13px] font-mono tabular-nums" dir="ltr">{v.oilChangeCurrentDate}</span>
                        : <span className="text-gray-400 text-xs font-bold">-</span>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                        {(() => {
                            const { status, color, days, due, soon } = getOilStatus(v.oilChangeNextDate);
                            if (days === null) return <span className="text-gray-400 text-xs font-bold">-</span>;
                            return (
                              <div className="flex flex-col gap-1">
                                <span className={`font-bold text-[13px] font-mono tabular-nums ${due ? 'text-red-600' : 'text-gray-900'}`} dir="ltr" title={due ? 'موعد الغيار مستحق' : soon ? 'موعد الغيار قريب' : 'موعد الغيار بعيد'}>
                                  {v.oilChangeNextDate}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border w-fit ${color} text-[11px] font-bold gap-1`}>
                                  {soon && !due && <AlertTriangle className="w-3.5 h-3.5" />}
                                  {status} ({days} يوم)
                                </span>
                              </div>
                            );
                        })()}
                    </td>
                    <td className="px-6 py-4 align-top print:hidden">
                        {v.registrationImage ? (
                            <div className="flex gap-1">
                                <button onClick={() => setViewImage(v.registrationImage!)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1 text-[11px] font-bold" title="عرض رخصة السير">
                                    <Eye className="w-4 h-4" />
                                    عرض
                                </button>
                                <a href={v.registrationImage} download target="_blank" className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 flex items-center gap-1 text-[11px] font-bold" title="تحميل">
                                    <Download className="w-4 h-4" />
                                </a>
                            </div>
                        ) : (
                            <span className="text-gray-400 text-xs font-bold">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 align-top print:hidden">
                        {v.insuranceImage ? (
                            <div className="flex gap-1">
                                <button onClick={() => setViewImage(v.insuranceImage!)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1 text-[11px] font-bold" title="عرض وثيقة التأمين">
                                    <Eye className="w-4 h-4" />
                                    عرض
                                </button>
                                <a href={v.insuranceImage} download target="_blank" className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 flex items-center gap-1 text-[11px] font-bold" title="تحميل">
                                    <Download className="w-4 h-4" />
                                </a>
                            </div>
                        ) : (
                            <span className="text-gray-400 text-xs font-bold">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2 align-top print:hidden">
                      <button 
                        onClick={() => { setSelectedVehicleId(v.id); setActiveTab('maintenance'); }}
                        className="text-amber-700 hover:text-amber-800 font-bold text-xs px-3 py-1.5 rounded-md hover:bg-amber-50 border border-amber-200 flex items-center gap-1"
                      >
                        <Wrench className="w-4 h-4" />
                        الصيانة والمخالفات
                      </button>
                      {(user?.role as string) !== 'viewer' && (
                        <>
                          <button 
                            onClick={() => startEdit(v)}
                            className="text-blue-700 hover:text-blue-800 font-bold text-xs px-3 py-1.5 rounded-md hover:bg-blue-50 border border-blue-200"
                          >
                            تعديل
                          </button>
                          <button 
                            onClick={() => handleDelete(v.id)}
                            className="text-red-700 hover:text-red-800 font-bold text-xs px-3 py-1.5 rounded-md hover:bg-red-50 border border-red-200"
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-gray-500 font-bold">
                      لا توجد مركبات مضافة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>

        {/* Violation Search Modal */}
        {showViolationsSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm print:static print:bg-white print:block print:p-0 print:h-auto" onClick={() => setShowViolationsSearch(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-visible animate-in fade-in zoom-in-95 print:block print:w-full print:h-auto print:max-h-none print:max-w-none print:shadow-none print:border-none print:bg-white print:animate-none" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl print:hidden">
                <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2 font-cairo">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  بحث المخالفات المرورية
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrintViolations}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2 font-bold"
                    title="طباعة التقرير"
                  >
                    <Printer className="w-5 h-5" />
                    <span className="hidden sm:inline">طباعة</span>
                  </button>
                  <button onClick={() => setShowViolationsSearch(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 border-b bg-white print:hidden space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Driver Filter */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        فلتر حسب السائق
                      </label>
                      <SearchableSelect
                        placeholder="ابحث باسم السائق..."
                        options={workerOptions}
                        value={violationSearchDriver || undefined}
                        onChange={(val) => setViolationSearchDriver(val || '')}
                      />
                    </div>

                    {/* Vehicle Filter */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5" />
                        فلتر حسب المركبة
                      </label>
                      <SearchableSelect
                        placeholder="جميع المركبات"
                        options={vehicleOptions}
                        value={violationSearchVehicle || undefined}
                        onChange={(val) => setViolationSearchVehicle(val || '')}
                      />
                    </div>

                    {/* Date Range Start */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            من تاريخ
                        </label>
                        <input 
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-bold"
                            value={violationSearchStartDate}
                            onChange={e => setViolationSearchStartDate(e.target.value)}
                        />
                    </div>

                    {/* Date Range End */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            إلى تاريخ
                        </label>
                        <input 
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-bold"
                            value={violationSearchEndDate}
                            onChange={e => setViolationSearchEndDate(e.target.value)}
                        />
                    </div>
                  </div>

                  {/* Text Search */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">بحث عام</label>
                    <div className="relative">
                      <input 
                        className="w-full px-3 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-bold"
                        placeholder="ابحث برقم المخالفة أو ملاحظات..."
                        value={violationSearchQuery}
                        onChange={e => setViolationSearchQuery(e.target.value)}
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-b-xl print:p-0 print:bg-white print:overflow-visible print:block print:h-auto">
                {/* Print Header */}
                <div className="hidden print:block mb-6 border-b pb-4">
                   <h1 className="text-2xl font-bold text-center mb-2 font-cairo">تقرير المخالفات المرورية</h1>
                   <div className="flex justify-center gap-4 text-sm text-gray-600 font-bold flex-wrap">
                     <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</span>
                     {violationSearchStartDate && <span>من: {violationSearchStartDate}</span>}
                     {violationSearchEndDate && <span>إلى: {violationSearchEndDate}</span>}
                     {violationSearchDriver && <span>السائق: {state.workers.find(w => w.id === violationSearchDriver)?.name}</span>}
                     {violationSearchVehicle && <span>المركبة: {state.vehicles?.find(v => v.id === violationSearchVehicle)?.plateNumber}</span>}
                   </div>
                </div>

                {violationSearchResults.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 print:hidden">
                    <p className="text-lg font-bold">لا توجد نتائج مطابقة</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                     {/* Summary Cards */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid print:grid-cols-2 print:gap-6 print:mb-8 print:break-inside-avoid">
                        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between h-24 print:border print:shadow-none print:break-inside-avoid print:h-28 print:rounded-xl print:border-gray-200">
                          <div className="text-sm text-gray-500 font-bold whitespace-nowrap text-right">إجمالي المخالفات</div>
                          <div className="text-3xl font-bold text-gray-900 whitespace-nowrap text-left" dir="ltr">{violationSearchResults.length} مخالفة</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between h-24 print:border print:shadow-none print:break-inside-avoid print:h-28 print:rounded-xl print:border-gray-200">
                          <div className="text-sm text-gray-500 font-bold whitespace-nowrap text-right">إجمالي المبالغ المستحقة</div>
                          <div className="text-3xl font-bold text-red-600 whitespace-nowrap text-left" dir="ltr">{violationSearchResults.reduce((sum, item) => sum + item.violation.cost, 0).toLocaleString()} ريال</div>
                        </div>
                     </div>

                     <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm print:border print:border-gray-200 print:shadow-none print:rounded-xl print:overflow-hidden">
                        
                        {/* Mobile Card View */}
                        <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100 print:hidden">
                           {violationSearchResults.map((item, idx) => (
                              <div key={`${item.violation.id}-${idx}-mobile`} className="p-4 flex flex-col gap-3">
                                 <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                       <div className="p-2 bg-red-50 rounded-full text-red-600">
                                          <AlertTriangle className="w-4 h-4" />
                                       </div>
                                       <div>
                                          <div className="font-bold text-gray-900 text-sm">{item.violation.type}</div>
                                          <div className="text-xs text-gray-500 font-mono">{item.violation.violationNumber || '-'}</div>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="font-bold text-red-600">{item.violation.cost.toLocaleString()} ريال</div>
                                       <div className="text-xs text-gray-500">{item.violation.date}</div>
                                    </div>
                                 </div>

                                 <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded-lg">
                                    <div>
                                       <span className="text-gray-400 block mb-0.5">السائق</span>
                                       <span className="font-bold text-gray-700">{item.violation.driverName || '-'}</span>
                                    </div>
                                    <div>
                                       <span className="text-gray-400 block mb-0.5">المركبة</span>
                                       <span className="font-bold text-gray-700">{item.vehicle.plateNumber}</span>
                                    </div>
                                    <div>
                                       <span className="text-gray-400 block mb-0.5">المدينة</span>
                                       <span className="font-bold text-gray-700">{item.violation.city || '-'}</span>
                                    </div>
                                    <div>
                                       <span className="text-gray-400 block mb-0.5">الوقت</span>
                                       <span className="font-bold text-gray-700">{item.violation.time || '-'}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>

                        {/* Desktop Table View */}
                        {/* Desktop Table View */}
                        <table className="hidden md:table print:table w-full text-right print:text-xs print:mb-8 print:border-collapse">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b print:bg-gray-100 print:border-b print:border-gray-200 print:table-header-group">
                            <tr>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-normal print:text-right print:w-[250px] font-bold">اسم السائق</th>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-nowrap print:text-center">التاريخ والوقت</th>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-normal print:text-center">رقم المخالفة</th>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-normal print:text-center">نوع المخالفة</th>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-normal print:text-center">المدينة</th>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-normal print:text-center">رقم السيارة</th>
                              <th className="px-4 py-4 whitespace-nowrap print:px-4 print:py-3 print:whitespace-normal print:text-center">القيمة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                            {violationSearchResults.map((item, idx) => (
                              <tr key={`${item.violation.id}-${idx}`} className="hover:bg-blue-50 transition-colors group print:hover:bg-transparent break-inside-avoid print:border-b print:border-gray-200">
                                <td className="px-4 py-4 print:px-4 print:py-3 print:align-top print:text-right">
                                  {item.violation.driverName ? (
                                    <div className="flex flex-col gap-1 print:items-start">
                                      <div className="flex items-center gap-1.5 font-bold text-gray-900 group-hover:text-blue-700 hover:underline transition-colors print:text-sm print:break-words print:whitespace-normal">
                                        <User className="w-4 h-4 text-gray-400 print:block" />
                                        {item.violation.driverName}
                                      </div>
                                      {/* English Name - Always visible for print context */}
                                      {(() => {
                                        const worker = state.workers.find(w => w.id === item.violation.driverId);
                                        return (
                                          <div className="text-xs text-gray-500 font-bold hidden md:block print:block print:text-[10px] print:text-gray-500 print:uppercase print:font-bold print:break-words print:whitespace-normal print:leading-tight print:text-right w-full" dir="ltr">
                                            {worker?.englishName || '-'}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 font-bold">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600 font-bold print:px-4 print:py-3 print:align-top print:text-center">
                                  <div className="whitespace-nowrap text-gray-900">{item.violation.date}</div>
                                  <div className="text-xs text-gray-400 print:text-gray-500 whitespace-nowrap" dir="ltr">{item.violation.time}</div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900 print:px-4 print:py-3 print:align-top print:text-center">
                                  <span className="font-mono font-bold group-hover:text-blue-700 transition-colors print:break-all">{item.violation.violationNumber || '-'}</span>
                                </td>
                                <td className="px-4 py-4 print:px-4 print:py-3 print:align-top print:text-center">
                                  <div className="flex flex-col gap-1 print:items-center">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-50 text-red-700 w-fit print:bg-red-50 print:text-red-700 print:break-words print:whitespace-normal">
                                      {item.violation.type}
                                    </span>
                                    {item.violation.description && (
                                      <span className="text-xs text-gray-500 max-w-[200px] truncate font-bold print:whitespace-normal print:max-w-[150px] print:text-gray-500 print:break-words">{item.violation.description}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900 font-bold print:px-4 print:py-3 print:align-top print:text-center">
                                  <span className="print:break-words">{item.violation.city || '-'}</span>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900 print:px-4 print:py-3 print:align-top print:text-center">
                                  <div className="flex flex-col print:items-center" dir="ltr">
                                    <span className="font-bold group-hover:text-blue-700 hover:underline transition-colors print:break-all text-gray-900">{item.vehicle.plateNumber}</span>
                                    <span className="text-xs text-gray-500 font-bold print:break-words">{item.vehicle.type}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 font-bold text-red-600 print:px-4 print:py-3 print:align-top print:text-center">
                                  {item.violation.cost.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Maintenance Search Modal */}
        {showMaintenanceSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm print:static print:bg-white print:block print:p-0 print:h-auto" onClick={() => setShowMaintenanceSearch(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-visible animate-in fade-in zoom-in-95 print:block print:w-full print:h-auto print:max-h-none print:max-w-none print:shadow-none print:border-none print:bg-white print:animate-none" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl print:hidden">
                <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2 font-cairo">
                  <Wrench className="w-6 h-6 text-blue-600" />
                  تقرير الصيانة
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2 font-bold"
                    title="طباعة التقرير"
                  >
                    <Printer className="w-5 h-5" />
                    <span className="hidden sm:inline">طباعة</span>
                  </button>
                  <button onClick={() => setShowMaintenanceSearch(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 border-b bg-white print:hidden space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Vehicle Filter */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5" />
                        فلتر حسب المركبة
                      </label>
                      <SearchableSelect
                        placeholder="جميع المركبات"
                        options={vehicleOptions}
                        value={maintenanceSearchVehicle || undefined}
                        onChange={(val) => setMaintenanceSearchVehicle(val || '')}
                      />
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5" />
                        نوع الصيانة
                      </label>
                      <SearchableSelect
                        placeholder="جميع الأنواع"
                        options={maintenanceTypeOptions}
                        value={maintenanceSearchType || undefined}
                        onChange={(val) => setMaintenanceSearchType(val || '')}
                      />
                    </div>

                    {/* Date Range Start */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            من تاريخ
                        </label>
                        <input 
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-bold"
                            value={maintenanceSearchStartDate}
                            onChange={e => setMaintenanceSearchStartDate(e.target.value)}
                        />
                    </div>

                    {/* Date Range End */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            إلى تاريخ
                        </label>
                        <input 
                            type="date"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-bold"
                            value={maintenanceSearchEndDate}
                            onChange={e => setMaintenanceSearchEndDate(e.target.value)}
                        />
                    </div>
                  </div>

                  {/* Text Search */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">بحث عام</label>
                    <div className="relative">
                      <input 
                        className="w-full px-3 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-bold"
                        placeholder="ابحث بالملاحظات..."
                        value={maintenanceSearchQuery}
                        onChange={e => setMaintenanceSearchQuery(e.target.value)}
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Wrench className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-b-xl print:p-0 print:bg-white print:overflow-visible print:block print:h-auto">
                {/* Print Header */}
                <div className="hidden print:block mb-6 border-b pb-4">
                   <h1 className="text-2xl font-bold text-center mb-2 font-cairo">تقرير الصيانة</h1>
                   <div className="flex justify-center gap-4 text-sm text-gray-600 font-bold flex-wrap">
                     <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</span>
                     {maintenanceSearchStartDate && <span>من: {maintenanceSearchStartDate}</span>}
                     {maintenanceSearchEndDate && <span>إلى: {maintenanceSearchEndDate}</span>}
                     {maintenanceSearchVehicle && <span>المركبة: {state.vehicles?.find(v => v.id === maintenanceSearchVehicle)?.plateNumber}</span>}
                     {maintenanceSearchType && <span>النوع: {maintenanceTypeOptions.find(t => t.value === maintenanceSearchType)?.label}</span>}
                   </div>
                </div>

                {maintenanceSearchResults.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 print:hidden">
                    <p className="text-lg font-bold">لا توجد نتائج مطابقة</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                     {/* Summary Cards */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-4 print:mb-6">
                        <div className="bg-white p-4 rounded-lg border shadow-sm print:border-2 print:shadow-none">
                          <div className="text-sm text-gray-500 mb-1 font-bold">إجمالي السجلات</div>
                          <div className="text-2xl font-bold text-gray-900">{maintenanceSearchResults.length} سجل</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border shadow-sm print:border-2 print:shadow-none">
                          <div className="text-sm text-gray-500 mb-1 font-bold">إجمالي التكلفة</div>
                          <div className="text-2xl font-bold text-blue-600">{maintenanceSearchResults.reduce((sum, item) => sum + item.maintenance.cost, 0).toLocaleString()} ريال</div>
                        </div>
                     </div>

                     {/* Print Grouped View */}
                     <div className="hidden print:block space-y-6">
                        {(() => {
                            const recordsByVehicle = maintenanceSearchResults.reduce((acc, item) => {
                                if (!acc[item.vehicle.id]) acc[item.vehicle.id] = [];
                                acc[item.vehicle.id].push(item.maintenance);
                                return acc;
                            }, {} as Record<string, MaintenanceRecord[]>);

                            const vehiclesToPrint = maintenanceSearchVehicle
                           ? (state.vehicles || []).filter(v => v.id === maintenanceSearchVehicle)
                           : [...(state.vehicles || [])].sort((a, b) => (a.plateNumber || '').localeCompare(b.plateNumber || ''));

                            return vehiclesToPrint.map(vehicle => {
                                const records = recordsByVehicle[vehicle.id] || [];
                                const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

                                return (
                                    <div key={vehicle.id} className="break-inside-avoid border-2 border-gray-800 rounded-lg overflow-hidden">
                                        <div className="bg-gray-100 border-b-2 border-gray-800 p-4 flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="text-2xl font-bold text-black">{vehicle.plateNumber}</div>
                                                <div className="text-gray-600 font-bold">{vehicle.type} - {vehicle.model}</div>
                                            </div>
                                            <div className="font-bold text-black border-2 border-gray-800 px-3 py-1 rounded bg-white">
                                                الإجمالي: {totalCost.toLocaleString()} ريال
                                            </div>
                                        </div>
                                        {records.length > 0 ? (
                                            <table className="w-full text-right text-sm print:text-[10px]">
                                                <thead className="bg-gray-50 border-b border-gray-400 text-black print:table-header-group">
                                                    <tr>
                                                        <th className="px-4 py-2 print:px-2 print:py-1">التاريخ</th>
                                                        <th className="px-4 py-2 print:px-2 print:py-1">النوع</th>
                                                        <th className="px-4 py-2 print:px-2 print:py-1">التفاصيل</th>
                                                        <th className="px-4 py-2 print:px-2 print:py-1">التكلفة</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-300">
                                                    {records.map((rec, idx) => (
                                                        <tr key={idx} className="break-inside-avoid">
                                                            <td className="px-4 py-2 text-black font-mono print:px-2 print:py-1" dir="ltr">{rec.date}</td>
                                                            <td className="px-4 py-2 text-black font-bold print:px-2 print:py-1">
                                                              {rec.type === 'oil_change' ? 'غيار زيت' : rec.type === 'repair' ? 'إصلاح' : 'أخرى'}
                                                            </td>
                                                            <td className="px-4 py-2 text-black print:px-2 print:py-1">
                                                              {rec.notes || '-'}
                                                              {rec.withFilter && <span className="mr-2 text-xs border border-gray-400 px-1 rounded print:border-black">مع فلتر</span>}
                                                            </td>
                                                            <td className="px-4 py-2 text-black font-bold print:px-2 print:py-1">{rec.cost.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 font-bold">
                                                لا توجد سجلات صيانة مسجلة ضمن نطاق البحث
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                     </div>

                     <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm print:hidden">
                        
                        {/* Mobile Card View */}
                        <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100">
                           {maintenanceSearchResults.map((item, idx) => (
                              <div key={`${item.maintenance.id}-${idx}-mobile`} className="p-4 flex flex-col gap-3">
                                 <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                       <div className={`p-2 rounded-full ${
                                          item.maintenance.type === 'oil_change' ? 'bg-amber-50 text-amber-600' :
                                          item.maintenance.type === 'repair' ? 'bg-red-50 text-red-600' :
                                          'bg-gray-50 text-gray-600'
                                       }`}>
                                          <Wrench className="w-4 h-4" />
                                       </div>
                                       <div>
                                          <div className="font-bold text-gray-900 text-sm">
                                            {item.maintenance.type === 'oil_change' ? 'غيار زيت' : item.maintenance.type === 'repair' ? 'إصلاح' : 'أخرى'}
                                          </div>
                                          <div className="text-xs text-gray-500 font-mono">{item.maintenance.date}</div>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="font-bold text-blue-600">{item.maintenance.cost.toLocaleString()} ريال</div>
                                    </div>
                                 </div>

                                 <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded-lg">
                                    <div>
                                       <span className="text-gray-400 block mb-0.5">المركبة</span>
                                       <span className="font-bold text-gray-700">{item.vehicle.plateNumber}</span>
                                    </div>
                                    <div>
                                       <span className="text-gray-400 block mb-0.5">تفاصيل</span>
                                       <span className="font-bold text-gray-700 truncate">{item.maintenance.notes || '-'}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>

                        {/* Desktop Table View */}
                        <table className="hidden md:table print:hidden w-full text-right">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b print:bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 whitespace-nowrap">المركبة</th>
                              <th className="px-4 py-3 whitespace-nowrap">التاريخ</th>
                              <th className="px-4 py-3 whitespace-nowrap">النوع</th>
                              <th className="px-4 py-3 whitespace-nowrap">تفاصيل</th>
                              <th className="px-4 py-3 whitespace-nowrap">التكلفة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                            {maintenanceSearchResults.map((item, idx) => (
                              <tr key={`${item.maintenance.id}-${idx}`} className="hover:bg-blue-50 transition-colors group print:hover:bg-transparent">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  <div className="flex flex-col" dir="ltr">
                                    <span className="font-bold group-hover:text-blue-700 hover:underline transition-colors">{item.vehicle.plateNumber}</span>
                                    <span className="text-xs text-gray-500 font-bold">{item.vehicle.type}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 font-bold font-mono">
                                  {item.maintenance.date}
                                </td>
                                <td className="px-4 py-3">
                                   <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold w-fit ${
                                      item.maintenance.type === 'oil_change' ? 'bg-amber-50 text-amber-700' :
                                      item.maintenance.type === 'repair' ? 'bg-red-50 text-red-700' :
                                      'bg-gray-50 text-gray-700'
                                   }`}>
                                      {item.maintenance.type === 'oil_change' ? 'غيار زيت' : item.maintenance.type === 'repair' ? 'إصلاح' : 'أخرى'}
                                   </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 font-bold">
                                  {item.maintenance.notes || '-'}
                                  {item.maintenance.withFilter && <span className="mr-2 text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">مع فلتر</span>}
                                </td>
                                <td className="px-4 py-3 font-bold text-blue-600 print:text-black">
                                  {item.maintenance.cost.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Maintenance & Violations Modal */}
        {selectedVehicle && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedVehicleId(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <div>
                  <h3 className="font-bold text-xl text-gray-800 font-cairo">{selectedVehicle.type} - {selectedVehicle.plateNumber}</h3>
                  <p className="text-sm text-gray-500">{selectedVehicle.model} {selectedVehicle.year}</p>
                </div>
                <button onClick={() => setSelectedVehicleId(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="flex border-b bg-gray-50">
                <button 
                  onClick={() => setActiveTab('maintenance')}
                  className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'maintenance' ? 'bg-white border-t-2 border-t-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Wrench className="w-4 h-4" />
                  سجل الصيانة
                </button>
                <button 
                  onClick={() => setActiveTab('violations')}
                  className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'violations' ? 'bg-white border-t-2 border-t-red-600 text-red-600' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  المخالفات المرورية
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'maintenance' ? (
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Add Form */}
                      {(user?.role as string) !== 'viewer' && (
                        <div className="lg:col-span-1">
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-0">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 font-cairo">
                              {editingMaintenanceId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                              {editingMaintenanceId ? 'تعديل الصيانة' : 'إضافة صيانة'}
                            </h4>
                            <form onSubmit={addMaintenance} className="space-y-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ</label>
                                <input 
                                  type="date"
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  value={mForm.date}
                                  onChange={e => setMForm({...mForm, date: e.target.value})}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">النوع</label>
                                <SearchableSelect 
                                  className="w-full font-bold"
                                  placeholder="اختر نوع الصيانة..."
                                  options={maintenanceTypeOptions}
                                  value={mForm.type || 'repair'}
                                  onChange={val => setMForm({...mForm, type: val as any})}
                                  
                                />
                              </div>
                              {mForm.type === 'oil_change' && (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="checkbox"
                                    id="withFilter"
                                    checked={mForm.withFilter}
                                    onChange={e => setMForm({...mForm, withFilter: e.target.checked})}
                                    className="rounded text-blue-600"
                                  />
                                  <label htmlFor="withFilter" className="text-sm text-gray-700 font-bold">مع سيفون (فلتر)</label>
                                </div>
                              )}
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">التكلفة</label>
                                <input 
                                  type="number"
                                  min="0"
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  value={mForm.cost}
                                  onChange={e => setMForm({...mForm, cost: Number(e.target.value)})}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات</label>
                                <textarea 
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  rows={3}
                                  value={mForm.notes}
                                  onChange={e => setMForm({...mForm, notes: e.target.value})}
                                />
                              </div>
                              <div className="flex gap-2">
                                {editingMaintenanceId && (
                                  <button 
                                    type="button"
                                    onClick={cancelEditMaintenance}
                                    className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-bold text-gray-700"
                                  >
                                    إلغاء
                                  </button>
                                )}
                                <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold">
                                  {editingMaintenanceId ? 'حفظ التعديلات' : 'حفظ السجل'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}

                      {/* List */}
                      <div className={`space-y-4 ${(user?.role as string) !== 'viewer' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-gray-800 font-cairo">السجلات السابقة</h4>
                          <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
                            إجمالي الصيانة: {selectedVehicle.maintenanceHistory.reduce((acc, curr) => acc + curr.cost, 0).toLocaleString()} ريال
                          </span>
                        </div>
                        {selectedVehicle.maintenanceHistory.length === 0 ? (
                          <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300 font-bold">
                            لا توجد سجلات صيانة
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedVehicle.maintenanceHistory.map(m => (
                              <div key={m.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:bg-blue-50/30 transition-all flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                      m.type === 'oil_change' ? 'bg-amber-100 text-amber-800' :
                                      m.type === 'repair' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {m.type === 'oil_change' ? 'غيار زيت' : m.type === 'repair' ? 'إصلاح' : 'أخرى'}
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1 font-bold">
                                      <Calendar className="w-3 h-3" />
                                      {m.date}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-700 font-bold">
                                    التكلفة: {m.cost} ريال
                                    {m.withFilter && <span className="mr-2 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-bold">مع فلتر</span>}
                                  </div>
                                  {m.notes && <p className="text-sm text-gray-500 mt-1 font-bold">{m.notes}</p>}
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => startEditMaintenance(m)} className="text-gray-400 hover:text-blue-500 p-1">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => deleteMaintenance(m.id)} className="text-gray-400 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Add Violation Form */}
                      {(user?.role as string) !== 'viewer' && (
                      <div className="lg:col-span-1">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 sticky top-0">
                          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 font-cairo">
                            {editingViolationId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {editingViolationId ? 'تعديل المخالفة' : 'إضافة مخالفة'}
                          </h4>
                          <form onSubmit={addViolation} className="space-y-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">رقم اللوحة</label>
                              <SearchableSelect 
                                className="w-full font-bold"
                                placeholder="اختر المركبة..."
                                options={vehicleOptions}
                                value={selectedVehicleId || ''}
                                onChange={val => setSelectedVehicleId(val || null)}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">رقم المخالفة</label>
                                <input 
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  value={vForm.violationNumber}
                                  onChange={e => setVForm({...vForm, violationNumber: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">التكلفة</label>
                                <input 
                                  type="number"
                                  min="0"
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  value={vForm.cost}
                                  onChange={e => setVForm({...vForm, cost: Number(e.target.value)})}
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ</label>
                                <input 
                                  type="date"
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  value={vForm.date}
                                  onChange={e => setVForm({...vForm, date: e.target.value})}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">الوقت</label>
                                <input 
                                  type="time"
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                  value={vForm.time}
                                  onChange={e => setVForm({...vForm, time: e.target.value})}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">نوع المخالفة</label>
                              <input 
                                className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                value={vForm.type}
                                onChange={e => setVForm({...vForm, type: e.target.value})}
                                placeholder="مثال: سرعة، وقوف خاطئ..."
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">المدينة</label>
                              <input 
                                className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                value={vForm.city}
                                onChange={e => setVForm({...vForm, city: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">السائق</label>
                              <SearchableSelect 
                                className="w-full font-bold"
                                placeholder="اختر السائق..."
                                options={workerOptions}
                                value={vForm.driverId || ''}
                                onChange={val => setVForm({...vForm, driverId: val || ''})}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات</label>
                              <textarea 
                                className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                rows={2}
                                value={vForm.description}
                                onChange={e => setVForm({...vForm, description: e.target.value})}
                              />
                            </div>
                            <div className="flex gap-2">
                              {editingViolationId && (
                                <button 
                                  type="button"
                                  onClick={cancelEditViolation}
                                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-bold text-gray-700"
                                >
                                  إلغاء
                                </button>
                              )}
                              <button className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold">
                                {editingViolationId ? 'حفظ التعديلات' : 'تسجيل المخالفة'}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                      )}

                      {/* List */}
                      <div className={`${(user?.role as string) !== 'viewer' ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-gray-800 font-cairo">سجل المخالفات</h4>
                          <Link
                            href={`/reports?view=violations&plate=${encodeURIComponent(selectedVehicle.plateNumber)}`}
                            className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded-full font-bold hover:bg-red-100 transition-colors flex items-center gap-1"
                            title="عرض تقرير المخالفات لهذه المركبة"
                          >
                            إجمالي المخالفات: {selectedVehicle.violations.reduce((acc, curr) => acc + curr.cost, 0).toLocaleString()} ريال
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        {selectedVehicle.violations.length === 0 ? (
                          <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300 font-bold">
                            لا توجد مخالفات مسجلة
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedVehicle.violations.map(v => (
                              <div key={v.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-red-300 hover:bg-red-50/30 transition-all flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                                      {v.type}
                                    </span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1 font-bold">
                                      <Calendar className="w-3 h-3" />
                                      {v.date} {v.time}
                                    </span>
                                    {v.city && (
                                       <span className="text-xs text-gray-500 border-r border-gray-300 pr-2 mr-1 font-bold">
                                        {v.city}
                                       </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-700 font-medium mb-1">
                                    القيمة: {v.cost} ريال
                                    {v.violationNumber && <span className="mr-3 text-gray-500 font-normal text-xs">رقم: {v.violationNumber}</span>}
                                  </div>
                                  {v.driverName && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-fit mb-1">
                                      <User className="w-3 h-3" />
                                      {v.driverName}
                                    </div>
                                  )}
                                  {v.description && <p className="text-sm text-gray-500">{v.description}</p>}
                              </div>
                              {user?.role !== 'viewer' && (
                                <div className="flex gap-1">
                                  <button onClick={() => startEditViolation(v)} className="text-gray-400 hover:text-blue-500 p-1">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => deleteViolation(v.id)} className="text-gray-400 hover:text-red-500 p-1">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Image Viewer Modal */}
        {viewImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setViewImage(null)}>
              <div className="relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                  <div className="absolute -top-12 right-0 flex gap-2">
                      <a 
                          href={viewImage} 
                          download 
                          target="_blank"
                          className="p-2 text-white hover:text-gray-300 transition-colors"
                          title="تحميل"
                      >
                          <Download className="w-8 h-8" />
                      </a>
                      <button 
                          className="text-white hover:text-gray-300 transition-colors" 
                          onClick={() => setViewImage(null)}
                      >
                          <X className="w-8 h-8" />
                      </button>
                  </div>
                  {(viewImage.toLowerCase().endsWith('.pdf') || viewImage.includes('application/pdf')) ? (
                      <iframe 
                          src={viewImage} 
                          className="w-full h-[85vh] rounded-lg shadow-2xl bg-white"
                          title="Document Viewer"
                      />
                  ) : (
                      <img 
                          src={viewImage} 
                          alt="Document" 
                          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white" 
                      />
                  )}
              </div>
          </div>
        )}
      </div>
    </main>
  );
}
