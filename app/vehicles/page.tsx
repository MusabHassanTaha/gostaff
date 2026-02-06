'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { Vehicle, MaintenanceRecord, ViolationRecord } from '@/types';
import SearchableSelect from '@/components/SearchableSelect';
import { Wrench, AlertTriangle, Plus, Trash2, X, Calendar, DollarSign, FileText, User, Pencil, Printer, Filter, Eye, Upload, Download, Car } from 'lucide-react';

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

  // Driver Autocomplete State
  const [driverSearchTerm, setDriverSearchTerm] = useState('');
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);

  const filteredDrivers = useMemo(() => {
    if (!driverSearchTerm) return state.workers || [];
    return (state.workers || []).filter(w => 
      w.name.toLowerCase().includes(driverSearchTerm.toLowerCase())
    );
  }, [state.workers, driverSearchTerm]);

  const handleSelectDriver = (driverId: string, driverName: string) => {
    setViolationSearchDriver(driverId);
    setDriverSearchTerm(driverName);
    setShowDriverDropdown(false);
  };

  const violationSearchResults = useMemo(() => {
    const query = violationSearchQuery.toLowerCase();
    const results: { vehicle: Vehicle; violation: ViolationRecord }[] = [];

    (state.vehicles || []).forEach(vehicle => {
      // If vehicle filter is active and doesn't match, skip this vehicle entirely
      if (violationSearchVehicle && vehicle.id !== violationSearchVehicle) return;

      vehicle.violations.forEach(violation => {
        // Driver Filter
        if (violationSearchDriver && violation.driverId !== violationSearchDriver) return;

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
  }, [state.vehicles, violationSearchQuery, violationSearchDriver, violationSearchVehicle]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setForm(prev => ({ ...prev, registrationImage: data.url }));
    } catch (err: any) {
        console.error(err);
        alert(`فشل تحميل الصورة: ${err.message}`);
    }
  };

  const handlePrintViolations = () => {
    window.print();
  };

  const selectedVehicle = useMemo(() => 
    state.vehicles?.find(v => v.id === selectedVehicleId), 
    [state.vehicles, selectedVehicleId]
  );

  const [form, setForm] = useState<Omit<Vehicle, 'id' | 'maintenanceHistory' | 'violations'>>({
    plateNumber: '',
    type: '',
    model: '',
    year: '',
    registrationImage: '',
  });

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
    setForm({ plateNumber: '', type: '', model: '', year: '', registrationImage: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === 'viewer') return;
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
      plateNumber: form.plateNumber,
      type: form.type,
      model: form.model,
      year: form.year,
      registrationImage: form.registrationImage,
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
      plateNumber: v.plateNumber,
      type: v.type,
      model: v.model || '',
      year: v.year || '',
      registrationImage: v.registrationImage || '',
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
        plateNumber: form.plateNumber,
        type: form.type,
        model: form.model,
        year: form.year,
        registrationImage: form.registrationImage,
      } : v)
    }));
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (user?.role === 'viewer') return;
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
    if (user?.role === 'viewer') return;
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
    if (user?.role === 'viewer') return;
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
    <main className="min-h-screen bg-gray-50 font-sans pb-20 animate-fade-in font-cairo">
      <div className="w-full max-w-7xl mx-auto px-4 py-8 md:p-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-cairo">إدارة المركبات</h1>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold">
              الرئيسية
            </Link>
             <Link href="/projects" className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-bold">
              المشاريع
            </Link>
            <button 
              onClick={() => setShowViolationsSearch(true)}
              className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-bold flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              بحث المخالفات
            </button>
            {(user?.role as string) !== 'viewer' && (
              <button 
                onClick={() => { resetForm(); setIsAdding(!isAdding); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
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
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">صورة رخصة السير</label>
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <input 
                            type="file" 
                            accept="image/*"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 font-bold"
                            onChange={handleFileUpload} 
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
                    <div className="text-sm text-gray-500 font-mono">{v.plateNumber}</div>
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
              className="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-80 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">رقم اللوحة</th>
                  <th className="px-6 py-4 whitespace-nowrap">النوع</th>
                  <th className="px-6 py-4 whitespace-nowrap">الموديل</th>
                  <th className="px-6 py-4 whitespace-nowrap">السنة</th>
                  <th className="px-6 py-4 whitespace-nowrap">رخصة السير</th>
                  <th className="px-6 py-4 whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-blue-50 transition-colors group">
                     <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-blue-700 hover:underline transition-colors">{v.plateNumber}</td>
                     <td className="px-6 py-4 text-gray-700 group-hover:text-gray-900 transition-colors font-bold">{v.type}</td>
                    <td className="px-6 py-4 text-gray-600 group-hover:text-gray-900 transition-colors font-bold">{v.model || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 group-hover:text-gray-900 transition-colors font-bold">{v.year || '-'}</td>
                    <td className="px-6 py-4">
                        {v.registrationImage ? (
                            <div className="flex gap-1">
                                <button onClick={() => setViewImage(v.registrationImage!)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1 text-xs font-bold">
                                    <Eye className="w-4 h-4" />
                                    عرض
                                </button>
                                <a href={v.registrationImage} download target="_blank" className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 flex items-center gap-1 text-xs font-bold" title="تحميل">
                                    <Download className="w-4 h-4" />
                                </a>
                            </div>
                        ) : (
                            <span className="text-gray-400 text-xs font-bold">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <button 
                        onClick={() => { setSelectedVehicleId(v.id); setActiveTab('maintenance'); }}
                        className="text-amber-600 hover:text-amber-800 font-bold text-sm px-3 py-1 rounded hover:bg-amber-50 flex items-center gap-1"
                      >
                        <Wrench className="w-4 h-4" />
                        الصيانة والمخالفات
                      </button>
                      {(user?.role as string) !== 'viewer' && (
                        <>
                          <button 
                            onClick={() => startEdit(v)}
                            className="text-blue-600 hover:text-blue-800 font-bold text-sm px-3 py-1 rounded hover:bg-blue-50"
                          >
                            تعديل
                          </button>
                          <button 
                            onClick={() => handleDelete(v.id)}
                            className="text-red-600 hover:text-red-800 font-bold text-sm px-3 py-1 rounded hover:bg-red-50"
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
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">
                      لا توجد مركبات مضافة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Violation Search Modal */}
        {showViolationsSearch && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowViolationsSearch(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-visible animate-in fade-in zoom-in-95 print:fixed print:inset-0 print:max-h-none print:w-full print:max-w-none print:z-[9999] print:bg-white print:animate-none" onClick={e => e.stopPropagation()}>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Driver Filter */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      فلتر حسب السائق
                    </label>
                    <div className="relative">
                      <input 
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm font-bold"
                        placeholder="ابحث باسم السائق..."
                        value={driverSearchTerm}
                        onChange={e => {
                          setDriverSearchTerm(e.target.value);
                          setShowDriverDropdown(true);
                          if (!e.target.value) setViolationSearchDriver('');
                        }}
                        onFocus={() => setShowDriverDropdown(true)}
                      />
                      {driverSearchTerm && (
                        <button 
                          onClick={() => {
                            setDriverSearchTerm('');
                            setViolationSearchDriver('');
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      
                      {showDriverDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowDriverDropdown(false)}></div>
                          <div className="absolute z-50 w-full min-w-[300px] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[500px] overflow-y-auto">
                  <button
                    className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 text-gray-600 border-b border-gray-100 font-bold"
                              onClick={() => handleSelectDriver('', '')}
                            >
                              عرض الكل
                            </button>
                            {filteredDrivers.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-gray-400 text-center font-bold">لا يوجد سائق بهذا الاسم</div>
                            ) : (
                              filteredDrivers.map(w => (
                                <button
                                  key={w.id}
                                  className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${violationSearchDriver === w.id ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-700 font-bold'}`}
                                  onClick={() => handleSelectDriver(w.id, w.name)}
                                >
                                  <span>{w.name}</span>
                                  {violationSearchDriver === w.id && <div className="w-2 h-2 rounded-full bg-red-500"></div>}
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
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

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-b-xl print:p-0 print:bg-white print:overflow-visible">
                {/* Print Header */}
                <div className="hidden print:block mb-6 border-b pb-4">
                   <h1 className="text-2xl font-bold text-center mb-2 font-cairo">تقرير المخالفات المرورية</h1>
                   <div className="flex justify-center gap-4 text-sm text-gray-600 font-bold">
                     <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</span>
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
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-4 print:mb-6">
                        <div className="bg-white p-4 rounded-lg border shadow-sm print:border-2 print:shadow-none">
                          <div className="text-sm text-gray-500 mb-1 font-bold">إجمالي المخالفات</div>
                          <div className="text-2xl font-bold text-gray-900">{violationSearchResults.length} مخالفة</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg border shadow-sm print:border-2 print:shadow-none">
                          <div className="text-sm text-gray-500 mb-1 font-bold">إجمالي المبالغ المستحقة</div>
                          <div className="text-2xl font-bold text-red-600">{violationSearchResults.reduce((sum, item) => sum + item.violation.cost, 0).toLocaleString()} ريال</div>
                        </div>
                     </div>

                     <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm print:border-2 print:shadow-none print:rounded-none">
                        
                        {/* Mobile Card View */}
                        <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100">
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
                        <table className="hidden md:table w-full text-right">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b print:bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 whitespace-nowrap">اسم السائق</th>
                              <th className="px-4 py-3 whitespace-nowrap">التاريخ والوقت</th>
                              <th className="px-4 py-3 whitespace-nowrap">رقم المخالفة</th>
                              <th className="px-4 py-3 whitespace-nowrap">نوع المخالفة</th>
                              <th className="px-4 py-3 whitespace-nowrap">المدينة</th>
                              <th className="px-4 py-3 whitespace-nowrap">رقم السيارة</th>
                              <th className="px-4 py-3 whitespace-nowrap">القيمة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                            {violationSearchResults.map((item, idx) => (
                              <tr key={`${item.violation.id}-${idx}`} className="hover:bg-blue-50 transition-colors group print:hover:bg-transparent">
                                <td className="px-4 py-3">
                                  {item.violation.driverName ? (
                                    <div className="flex items-center gap-1.5 font-bold text-gray-900 group-hover:text-blue-700 hover:underline transition-colors">
                                      <User className="w-4 h-4 text-gray-400 print:hidden" />
                                      {item.violation.driverName}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 font-bold">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 font-bold">
                                  <div>{item.violation.date}</div>
                                  <div className="text-xs text-gray-400 print:text-gray-600">{item.violation.time}</div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  <span className="font-mono font-bold group-hover:text-blue-700 transition-colors">{item.violation.violationNumber || '-'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-50 text-red-700 w-fit print:bg-transparent print:p-0 print:text-black">
                                      {item.violation.type}
                                    </span>
                                    {item.violation.description && (
                                      <span className="text-xs text-gray-500 max-w-[200px] truncate font-bold">{item.violation.description}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-bold">
                                  {item.violation.city || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  <div className="flex flex-col" dir="ltr">
                                    <span className="font-bold group-hover:text-blue-700 hover:underline transition-colors">{item.vehicle.plateNumber}</span>
                                    <span className="text-xs text-gray-500 font-bold">{item.vehicle.type}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-bold text-red-600 print:text-black">
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
                          <span className="text-sm bg-red-50 text-red-700 px-3 py-1 rounded-full font-bold">
                            إجمالي المخالفات: {selectedVehicle.violations.reduce((acc, curr) => acc + curr.cost, 0).toLocaleString()} ريال
                          </span>
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
                  <img 
                      src={viewImage} 
                      alt="Registration" 
                      className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white" 
                  />
              </div>
          </div>
        )}
      </div>
    </main>
  );
}
