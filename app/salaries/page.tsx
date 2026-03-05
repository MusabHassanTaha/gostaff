'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppState } from '@/components/state/AppStateContext';
import { SalaryRecord } from '@/types';
import { Wallet, Search, AlertCircle } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { calculateDaysWorked } from '@/lib/date';


// Helper to format currency
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ريال';
};

export default function SalariesPage() {
  const { state, updateSalaryData } = useAppState();
  const [search, setSearch] = useState('');
  const topScrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollerRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState<number>(0);
  const syncingRef = useRef<boolean>(false);
  
  // Use salaryData from global state
  const salaryData = state.salaryData || {};

  useEffect(() => {
    const updateWidths = () => {
      const w = tableRef.current?.scrollWidth || 0;
      setScrollWidth(w);
    };
    updateWidths();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidths) : null;
    if (tableRef.current && ro) ro.observe(tableRef.current);
    window.addEventListener('resize', updateWidths);
    return () => {
      if (tableRef.current && ro) ro.disconnect();
      window.removeEventListener('resize', updateWidths);
    };
  }, []);

  const syncScroll = (fromTop: boolean) => (e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const other = fromTop ? bottomScrollerRef.current : topScrollerRef.current;
    if (other) {
      other.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
    }
    syncingRef.current = false;
  };

  const handleInputChange = (workerId: string, field: keyof SalaryRecord, value: string) => {
    const numValue = parseFloat(value) || 0;
    updateSalaryData(workerId, { [field]: numValue });
  };

  const filteredWorkers = useMemo(() => {
    const query = search.toLowerCase();
    const list = state.workers.filter(w => {
      const skillLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
      const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
      return (
        w.name.toLowerCase().includes(query) ||
        (w.englishName && w.englishName.toLowerCase().includes(query)) ||
        (w.code && w.code.toLowerCase().includes(query)) ||
        (w.iqamaNumber && w.iqamaNumber.includes(query)) ||
        (w.phone && w.phone.includes(query)) ||
        (w.nationality && w.nationality.toLowerCase().includes(query)) ||
        skillLabel.toLowerCase().includes(query) ||
        (assignedSite && assignedSite.name.toLowerCase().includes(query))
      );
    });
    const num = (c?: string) => {
      if (!c) return 0;
      const n = parseInt(c.replace(/\D/g, ''), 10);
      return isNaN(n) ? 0 : n;
    };
    return list.sort((a, b) => num(b.code) - num(a.code));
  }, [state.workers, state.skills, state.sites, search]);

  const calculateRow = (workerId: string) => {
    const data = salaryData[workerId] || {
      basicSalary: 0,
      advance: 0,
      advanceRepayment: 0,
      absenceDays: 0,
      violationValue: 0,
      violationRepayment: 0,
      incentives: 0
    };

    const daily = (data.basicSalary || 0) / 30;
    const absenceDays = data.absenceDays || 0;
    const absencePerDay = typeof data.absenceValue === 'number' && data.absenceValue >= 0 ? data.absenceValue : daily;
    const absenceTotal = Math.max(0, Math.round(absencePerDay * absenceDays * 100) / 100);
    const remainingAdvance = Math.max(0, (data.advance || 0) - (data.advanceRepayment || 0));
    const remainingViolations = Math.max(0, (data.violationValue || 0) - (data.violationRepayment || 0));
    
    const netSalary = Math.max(
      0,
      (daily * (data.daysWorked || 0)) 
      + (data.incentives || 0)
      - (data.advanceRepayment || 0) 
      - absenceTotal 
      - (data.violationRepayment || 0)
    );

    return {
      basicSalary: data.basicSalary || 0,
      advance: data.advance || 0,
      advanceRepayment: data.advanceRepayment || 0,
      absenceDays,
      violationValue: data.violationValue || 0,
      violationRepayment: data.violationRepayment || 0,
      incentives: data.incentives || 0,
      daysWorked: data.daysWorked || 0,
      paymentDate: data.paymentDate || '',
      daily,
      remainingAdvance,
      absencePerDay,
      absenceTotal,
      remainingViolations,
      netSalary
    };
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredWorkers.reduce((acc, w) => {
      const row = calculateRow(w.id);
      return {
        basicSalary: acc.basicSalary + (row.basicSalary || 0),
        netSalary: acc.netSalary + (row.netSalary || 0),
        advances: acc.advances + (row.advance || 0),
        advanceRepayment: acc.advanceRepayment + (row.advanceRepayment || 0),
        remainingAdvance: acc.remainingAdvance + (row.remainingAdvance || 0),
        violations: acc.violations + (row.violationValue || 0),
        violationRepayment: acc.violationRepayment + (row.violationRepayment || 0),
        remainingViolations: acc.remainingViolations + (row.remainingViolations || 0),
        incentives: acc.incentives + (row.incentives || 0),
        absenceDays: acc.absenceDays + (row.absenceDays || 0),
        absenceValueTotal: acc.absenceValueTotal + (row.absenceTotal || 0)
      };
    }, { 
      basicSalary: 0, 
      netSalary: 0, 
      advances: 0, 
      advanceRepayment: 0,
      remainingAdvance: 0,
      violations: 0, 
      violationRepayment: 0,
      remainingViolations: 0,
      incentives: 0,
      absenceDays: 0,
      absenceValueTotal: 0 
    });
  }, [filteredWorkers, salaryData]);

  const exportSalariesToExcel = () => {
    const rows = filteredWorkers.map((worker, idx) => {
      const row = calculateRow(worker.id);
      const skillLabel = (state.skills.find(s => s.name === worker.skill)?.label || worker.skill) as string;
      const paymentDate = (salaryData[worker.id]?.paymentDate as any) || '';
      return {
        '#': idx + 1,
        'الكود': worker.code || '',
        'الاسم العربي': worker.name,
        'الاسم الإنجليزي': (worker as any).englishName || '',
        'المهنة': skillLabel,
        'الراتب الأساسي': row.basicSalary || 0,
        'رقم الحساب': (worker as any).bankAccount || '',
        'اسم البنك': (worker as any).bankName || '',
        'تاريخ الصرف': paymentDate,
        'تاريخ التعيين': (worker as any).hireDate || '',
        'يومية الموظف': Number(row.daily.toFixed(2)),
        'أيام العمل': row.daysWorked || 0,
        'قيمة الغياب (لليوم)': typeof row.absencePerDay === 'number' ? Number(row.absencePerDay.toFixed(2)) : 0,
        'السلفة': row.advance || 0,
        'سداد السلفة': row.advanceRepayment || 0,
        'المتبقي من السلفة': row.remainingAdvance || 0,
        'أيام الغياب': row.absenceDays || 0,
        'إجمالي قيمة الغياب': Number(row.absenceTotal.toFixed(2)),
        'قيمة المخالفة': row.violationValue || 0,
        'سداد المخالفات': row.violationRepayment || 0,
        'متبقي المخالفات': row.remainingViolations || 0,
        'حوافز': row.incentives || 0,
        'صافي الراتب': Number(row.netSalary.toFixed(2))
      };
    });
    // Totals row
    rows.push({
      '#': '',
      'الكود': 'الإجمالي',
      'الاسم العربي': '',
      'الاسم الإنجليزي': '',
      'المهنة': '',
      'الراتب الأساسي': totals.basicSalary,
      'رقم الحساب': '',
      'اسم البنك': '',
      'تاريخ الصرف': '',
      'تاريخ التعيين': '',
      'يومية الموظف': '',
      'أيام العمل': '',
      'السلفة': '',
      'سداد السلفة': '',
      'المتبقي من السلفة': '',
      'أيام الغياب': '',
      'قيمة الغياب': '',
      'قيمة المخالفة': totals.violations,
      'سداد المخالفات': '',
      'متبقي المخالفات': '',
      'حوافز': '',
      'صافي الراتب': totals.netSalary
    } as any);

    const ws = utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 10 },  // الكود
      { wch: 20 },  // الاسم العربي
      { wch: 20 },  // الاسم الإنجليزي
      { wch: 15 },  // المهنة
      { wch: 14 },  // الراتب الأساسي
      { wch: 18 },  // رقم الحساب
      { wch: 16 },  // اسم البنك
      { wch: 12 },  // تاريخ الصرف
      { wch: 12 },  // تاريخ التعيين
      { wch: 12 },  // يومية الموظف
      { wch: 10 },  // أيام العمل
      { wch: 14 },  // قيمة الغياب (لليوم)
      { wch: 12 },  // السلفة
      { wch: 12 },  // سداد السلفة
      { wch: 14 },  // المتبقي من السلفة
      { wch: 10 },  // أيام الغياب
      { wch: 16 },  // إجمالي قيمة الغياب
      { wch: 14 },  // قيمة المخالفة
      { wch: 14 },  // سداد المخالفات
      { wch: 14 },  // متبقي المخالفات
      { wch: 10 },  // حوافز
      { wch: 14 }   // صافي الراتب
    ];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'الرواتب');
    const today = new Date().toISOString().slice(0, 10);
    writeFile(wb, `تقرير_الرواتب_${today}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-8 animate-in fade-in duration-300">
      <div className="max-w-[1920px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-3">
              <span className="p-3 bg-teal-100 rounded-xl text-teal-600">
                <Wallet className="w-8 h-8" />
              </span>
              إدارة الرواتب
            </h1>
            <p className="text-gray-500 mt-2 font-medium">نظام إدارة ومتابعة رواتب العمال والمستحقات والخصومات</p>
          </div>
          
          {/* Stats Cards */}
          <div className="flex items-center gap-4">
             <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-600 font-bold mb-1">إجمالي الرواتب الأساسية</div>
                <div className="text-lg font-black text-blue-700">{formatCurrency(totals.basicSalary)}</div>
             </div>
             <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                <div className="text-xs text-emerald-600 font-bold mb-1">صافي الرواتب المستحقة</div>
                <div className="text-lg font-black text-emerald-700">{formatCurrency(totals.netSalary)}</div>
             </div>
             <button
               onClick={exportSalariesToExcel}
               className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 shadow-sm"
               title="تصدير تقرير الرواتب إلى ملف Excel"
             >
               تصدير Excel
             </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="بحث سريع (الاسم العربي/الإنجليزي، الكود، رقم الإقامة، المهنة، الجنسية)..." 
                    className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Top Scrollbar (synced with bottom) */}
          <div 
            ref={topScrollerRef}
            onScroll={syncScroll(true)}
            className="overflow-x-auto"
          >
            <div style={{ width: scrollWidth || '100%' }} className="h-3" />
          </div>
          <div 
            ref={bottomScrollerRef}
            onScroll={syncScroll(false)}
            className="overflow-x-auto max-h-[70vh]"
          >
            <table ref={tableRef} className="w-full min-w-[2600px] text-right border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-12 text-center sticky right-0 z-20 bg-gray-50 border-l border-gray-200" style={{ right: '0' }}>#</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-24 sticky z-20 bg-gray-50 border-l border-gray-200" style={{ right: '3rem' }}>الكود</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[200px] sticky z-20 bg-gray-50 border-l border-gray-200" style={{ right: '9rem' }}>الاسم</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">المهنة</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-40 bg-blue-50/50 whitespace-nowrap">الراتب الأساسي</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-56 whitespace-nowrap">رقم الحساب</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-48 whitespace-nowrap">اسم البنك</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-40 whitespace-nowrap">تاريخ الصرف</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-40 whitespace-nowrap">تاريخ التعيين</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-40 whitespace-nowrap">يومية الموظف</th>
                  <th className="px-3 py-3 text-xs font-bold text-gray-500 tracking-wider w-32 whitespace-nowrap">أيام العمل</th>
                  <th className="px-3 py-3 text-xs font-bold text-amber-700 tracking-wider w-44 bg-amber-50/30 whitespace-nowrap">السلفة</th>
                  <th className="px-3 py-3 text-xs font-bold text-amber-700 tracking-wider w-44 bg-amber-50/30 whitespace-nowrap">سداد السلفة</th>
                  <th className="px-3 py-3 text-xs font-bold text-amber-700 tracking-wider w-44 bg-amber-50/30 whitespace-nowrap">المتبقي من السلفة</th>
                  <th className="px-3 py-3 text-xs font-bold text-rose-700 tracking-wider w-32 bg-rose-50/30 whitespace-nowrap">أيام الغياب</th>
                  <th className="px-3 py-3 text-xs font-bold text-rose-700 tracking-wider w-44 bg-rose-50/30 whitespace-nowrap">قيمة الغياب</th>
                  <th className="px-3 py-3 text-xs font-bold text-rose-700 tracking-wider w-48 bg-rose-50/30 whitespace-nowrap">إجمالي قيمة الغياب</th>
                  <th className="px-3 py-3 text-xs font-bold text-red-700 tracking-wider w-44 bg-red-50/30 whitespace-nowrap">قيمة المخالفة</th>
                  <th className="px-3 py-3 text-xs font-bold text-red-700 tracking-wider w-44 bg-red-50/30 whitespace-nowrap">سداد المخالفات</th>
                  <th className="px-3 py-3 text-xs font-bold text-red-700 tracking-wider w-44 bg-red-50/30 whitespace-nowrap">متبقي المخالفات</th>
                  <th className="px-3 py-3 text-xs font-bold text-emerald-700 tracking-wider w-44 bg-emerald-50/30 whitespace-nowrap">حوافز</th>
                  <th className="px-3 py-3 text-xs font-bold text-white tracking-wider min-w-[200px] bg-teal-600 sticky left-0 z-10 shadow-lg text-center whitespace-nowrap">صافي الراتب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={22} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <AlertCircle className="w-8 h-8 text-gray-300" />
                            <p>لا يوجد موظفين مطابقين للبحث</p>
                        </div>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((worker, idx) => {
                    const row = calculateRow(worker.id);
                    const skillLabel = state.skills.find(s => s.name === worker.skill)?.label || worker.skill;
                    const daysWorked = calculateDaysWorked(worker.hireDate);
                    const isNew = daysWorked !== undefined && daysWorked < 30;
                    
                    return (
                      <tr key={worker.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className={`px-4 py-3 text-sm text-gray-500 font-medium text-center sticky right-0 z-10 border-l border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} group-hover:bg-gray-50`} style={{ right: '0' }}>{idx + 1}</td>
                        <td className={`px-4 py-3 text-sm text-gray-900 font-semibold font-mono whitespace-nowrap sticky z-10 border-l border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} group-hover:bg-gray-50`} style={{ right: '3rem' }}>{worker.code || '-'}</td>
                        <td className={`px-4 py-3 sticky z-10 border-l border-gray-100 min-w-[200px] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} group-hover:bg-gray-50`} style={{ right: '9rem' }}>
                          <div className="flex flex-col max-w-[220px]">
                            <span className="text-sm font-bold text-gray-900 truncate" title={worker.name}>{worker.name}</span>
                            {worker.englishName && (
                              <span className="text-[10px] text-black mt-0.5 truncate uppercase font-bold" title={worker.englishName}>
                                {worker.englishName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap" title={skillLabel}>
                            {skillLabel}
                          </span>
                        </td>
                        <td className="px-2 py-3 bg-blue-50/10">
                            <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-bold text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center font-mono tabular-nums"
                                value={row.basicSalary || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'basicSalary', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 text-xs font-medium text-gray-600 font-mono tabular-nums whitespace-nowrap overflow-hidden text-ellipsis" dir="ltr">{worker.bankAccount || '-'}</td>
                        <td className="px-2 py-3 text-xs font-medium text-gray-600 max-w-[140px] truncate" title={worker.bankName || ''}>{worker.bankName || '-'}</td>
                        <td className="px-2 py-3">
                            <input 
                                type="date"
                                className="w-full h-9 px-2 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
                                value={(salaryData[worker.id]?.paymentDate as any) || ''}
                                onChange={(e) => updateSalaryData(worker.id, { paymentDate: e.target.value })}
                            />
                        </td>
                        <td className="px-2 py-3 text-xs font-medium whitespace-nowrap">
                            <span className={`${isNew ? 'text-red-600 font-bold' : 'text-gray-600'} print:text-black`}>
                                {worker.hireDate || '-'}
                            </span>
                        </td>
                        <td className="px-2 py-3 text-xs font-bold text-gray-700 text-center font-mono tabular-nums whitespace-nowrap" dir="ltr">{row.daily.toFixed(2)}</td>
                        <td className="px-2 py-3">
                            <input 
                                type="number"
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[100px] h-9 px-2 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-300 text-center font-mono tabular-nums"
                                value={row.daysWorked || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'daysWorked', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-amber-50/10">
                         <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center font-mono tabular-nums"
                                value={row.advance || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'advance', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-amber-50/10">
                             <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center font-mono tabular-nums"
                                value={row.advanceRepayment || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'advanceRepayment', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-amber-50/10">
                            <div className={`text-sm font-bold text-center ${row.remainingAdvance > 0 ? 'text-amber-600' : 'text-gray-400'} font-mono tabular-nums whitespace-nowrap`} dir="ltr">
                                {row.remainingAdvance > 0 ? row.remainingAdvance.toFixed(2) : '-'}
                            </div>
                        </td>
                        <td className="px-2 py-3 bg-rose-50/10">
                             <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[100px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-center font-mono tabular-nums"
                                value={row.absenceDays || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'absenceDays', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-rose-50/10">
                             <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-center font-mono tabular-nums"
                                value={typeof row.absencePerDay === 'number' ? row.absencePerDay : ''}
                                placeholder="0.00"
                                onChange={(e) => handleInputChange(worker.id, 'absenceValue', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-rose-50/10">
                            <div className="text-sm font-black text-center text-rose-700 font-mono tabular-nums whitespace-nowrap" dir="ltr" title="قيمة الغياب × أيام الغياب">
                                {row.absenceTotal.toFixed(2)}
                            </div>
                        </td>
                        <td className="px-2 py-3 bg-red-50/10">
                             <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center font-mono tabular-nums"
                                value={row.violationValue || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'violationValue', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-red-50/10">
                             <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center font-mono tabular-nums"
                                value={row.violationRepayment || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'violationRepayment', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-red-50/10">
                            <div className={`text-sm font-bold text-center ${row.remainingViolations > 0 ? 'text-red-600' : 'text-gray-400'} font-mono tabular-nums whitespace-nowrap`} dir="ltr">
                                {row.remainingViolations > 0 ? row.remainingViolations.toFixed(2) : '-'}
                            </div>
                        </td>
                        <td className="px-2 py-3 bg-emerald-50/10">
                             <input 
                                type="number" 
                                min="0"
                                dir="ltr"
                                className="w-full min-w-[110px] h-9 px-2 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center font-mono tabular-nums"
                                value={row.incentives || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'incentives', e.target.value)}
                            />
                        </td>
                        <td className="px-4 py-3 bg-teal-50 sticky left-0 z-10 shadow-inner group-hover:bg-teal-100 transition-colors text-center border-l-4 border-teal-500">
                            <div className="text-sm font-black text-teal-800 font-mono tabular-nums" dir="ltr">
                                {formatCurrency(row.netSalary)}
                            </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  {/* # */}
                  <td className="px-4 py-3 sticky right-0 z-10 bg-gray-50 border-t border-gray-200" style={{ right: '0' }} />
                  {/* الكود */}
                  <td className="px-4 py-3 sticky z-10 bg-gray-50 border-t border-gray-200" style={{ right: '3rem' }} />
                  {/* الاسم */}
                  <td className="px-4 py-3 sticky z-10 bg-gray-50 border-t border-gray-200" style={{ right: '9rem' }}>الإجمالي</td>
                  {/* المهنة */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* الراتب الأساسي */}
                  <td className="px-2 py-3 text-blue-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.basicSalary)}
                  </td>
                  {/* رقم الحساب */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* اسم البنك */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* تاريخ الصرف */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* تاريخ التعيين */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* يومية الموظف */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* أيام العمل */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* السلفة */}
                  <td className="px-2 py-3 text-amber-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.advances)}
                  </td>
                  {/* سداد السلفة */}
                  <td className="px-2 py-3 text-amber-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.advanceRepayment)}
                  </td>
                  {/* المتبقي من السلفة */}
                  <td className="px-2 py-3 text-amber-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.remainingAdvance)}
                  </td>
                  {/* أيام الغياب */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* قيمة الغياب (لليوم) */}
                  <td className="px-2 py-3 border-t border-gray-200" />
                  {/* إجمالي قيمة الغياب */}
                  <td className="px-2 py-3 text-rose-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.absenceValueTotal)}
                  </td>
                  {/* قيمة المخالفة */}
                  <td className="px-2 py-3 text-red-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.violations)}
                  </td>
                  {/* سداد المخالفات */}
                  <td className="px-2 py-3 text-red-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.violationRepayment)}
                  </td>
                  {/* متبقي المخالفات */}
                  <td className="px-2 py-3 text-red-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.remainingViolations)}
                  </td>
                  {/* حوافز */}
                  <td className="px-2 py-3 text-emerald-700 font-mono tabular-nums text-center border-t border-gray-200" dir="ltr">
                    {formatCurrency(totals.incentives)}
                  </td>
                  {/* صافي الراتب */}
                  <td className="px-4 py-3 bg-teal-50 sticky left-0 z-10 text-center border-l-4 border-teal-500 border-t border-teal-200" dir="ltr">
                    <span className="text-teal-800 font-black font-mono tabular-nums">
                      {formatCurrency(totals.netSalary)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
