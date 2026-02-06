'use client';

import React, { useState, useMemo } from 'react';
import { useAppState } from '@/components/state/AppStateContext';
import { SalaryRecord } from '@/types';
import { Wallet, Search, AlertCircle } from 'lucide-react';


// Helper to format currency
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ريال';
};

export default function SalariesPage() {
  const { state, updateSalaryData } = useAppState();
  const [search, setSearch] = useState('');
  
  // Use salaryData from global state
  const salaryData = state.salaryData || {};

  const handleInputChange = (workerId: string, field: keyof SalaryRecord, value: string) => {
    const numValue = parseFloat(value) || 0;
    updateSalaryData(workerId, { [field]: numValue });
  };

  const filteredWorkers = useMemo(() => {
    return state.workers.filter(w => 
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.code && w.code.toLowerCase().includes(search.toLowerCase()))
    );
  }, [state.workers, search]);

  const calculateRow = (workerId: string) => {
    const data = salaryData[workerId] || {
      basicSalary: 0,
      advance: 0,
      advanceRepayment: 0,
      absenceDays: 0,
      absenceValue: 0,
      violationValue: 0,
      violationRepayment: 0,
      incentives: 0
    };

    const remainingAdvance = Math.max(0, data.advance - data.advanceRepayment);
    const absenceValue = data.absenceValue;
    const remainingViolations = Math.max(0, data.violationValue - data.violationRepayment);
    
    // Net Salary = Basic + Incentives - Advance Repayment - Absence Value - Violation Repayment
    const netSalary = Math.max(0, data.basicSalary + data.incentives - data.advanceRepayment - absenceValue - data.violationRepayment);

    return {
      ...data,
      remainingAdvance,
      absenceValue,
      remainingViolations,
      netSalary
    };
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredWorkers.reduce((acc, w) => {
      const row = calculateRow(w.id);
      return {
        basicSalary: acc.basicSalary + row.basicSalary,
        netSalary: acc.netSalary + row.netSalary,
        advances: acc.advances + row.advance,
        violations: acc.violations + (row.violationValue || 0)
      };
    }, { basicSalary: 0, netSalary: 0, advances: 0, violations: 0 });
  }, [filteredWorkers, salaryData]);

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
          <div className="flex gap-4">
             <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-600 font-bold mb-1">إجمالي الرواتب الأساسية</div>
                <div className="text-lg font-black text-blue-700">{formatCurrency(totals.basicSalary)}</div>
             </div>
             <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                <div className="text-xs text-emerald-600 font-bold mb-1">صافي الرواتب المستحقة</div>
                <div className="text-lg font-black text-emerald-700">{formatCurrency(totals.netSalary)}</div>
             </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="بحث باسم الموظف أو الكود..." 
                    className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-right border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16 text-center">الكود</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[180px]">الموظف</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">اسم البنك</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">رقم الحساب</th>
                  <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-28 bg-blue-50/50">الراتب الاساسي</th>
                  
                  {/* Advances Group */}
                  <th className="px-4 py-4 text-xs font-bold text-amber-700 uppercase tracking-wider w-24 bg-amber-50/30 border-r border-amber-100">السلفه</th>
                  <th className="px-4 py-4 text-xs font-bold text-amber-700 uppercase tracking-wider w-24 bg-amber-50/30">سداد سلفه</th>
                  <th className="px-4 py-4 text-xs font-bold text-amber-700 uppercase tracking-wider w-24 bg-amber-50/30">باقي السلفه</th>

                  {/* Absence Group */}
                  <th className="px-4 py-4 text-xs font-bold text-rose-700 uppercase tracking-wider w-20 bg-rose-50/30 border-r border-rose-100">أيام غياب</th>
                  <th className="px-4 py-4 text-xs font-bold text-rose-700 uppercase tracking-wider w-24 bg-rose-50/30">قيمة الغياب</th>

                  {/* Violations Group */}
                  <th className="px-4 py-4 text-xs font-bold text-red-700 uppercase tracking-wider w-24 bg-red-50/30 border-r border-red-100">قيمة مخالفات</th>
                  <th className="px-4 py-4 text-xs font-bold text-red-700 uppercase tracking-wider w-24 bg-red-50/30">سداد مخالفات</th>
                  <th className="px-4 py-4 text-xs font-bold text-red-700 uppercase tracking-wider w-24 bg-red-50/30">متبقي مخالفات</th>

                  <th className="px-4 py-4 text-xs font-bold text-emerald-700 uppercase tracking-wider w-24 bg-emerald-50/30 border-r border-emerald-100">حوافز</th>
                  <th className="px-4 py-4 text-xs font-bold text-white uppercase tracking-wider w-32 bg-teal-600 sticky left-0 z-10 shadow-lg text-center">صافي الراتب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                            <AlertCircle className="w-8 h-8 text-gray-300" />
                            <p>لا يوجد موظفين مطابقين للبحث</p>
                        </div>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((worker) => {
                    const row = calculateRow(worker.id);
                    return (
                      <tr key={worker.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-4 py-3 text-center text-xs font-bold text-gray-400 bg-gray-50/30">{worker.code || '-'}</td>
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                                {worker.avatar ? (
                                    <img src={worker.avatar} alt={worker.name} className="w-8 h-8 rounded-full object-cover border border-gray-100" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-xs font-bold">
                                        {worker.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{worker.name}</div>
                                    {worker.englishName && <div className="text-xs text-black font-medium">{worker.englishName}</div>}
                                    <div className="text-[10px] text-gray-400 mt-0.5">{worker.skill}</div>
                                </div>
                            </div>
                        </td>

                        <td className="px-4 py-3 text-xs font-medium text-gray-600">
                            {worker.bankName || '-'}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-600 font-mono">
                            {worker.bankAccount || '-'}
                        </td>
                        
                        {/* Basic Salary */}
                        <td className="px-2 py-3 bg-blue-50/10">
                            <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                                value={row.basicSalary || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'basicSalary', e.target.value)}
                            />
                        </td>

                        {/* Advance */}
                        <td className="px-2 py-3 bg-amber-50/10 border-r border-amber-50">
                             <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center"
                                value={row.advance || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'advance', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-amber-50/10">
                             <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center"
                                value={row.advanceRepayment || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'advanceRepayment', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-amber-50/10">
                            <div className={`text-sm font-bold text-center ${row.remainingAdvance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                {row.remainingAdvance > 0 ? row.remainingAdvance : '-'}
                            </div>
                        </td>

                        {/* Absence */}
                        <td className="px-2 py-3 bg-rose-50/10 border-r border-rose-50">
                             <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-center"
                                value={row.absenceDays || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'absenceDays', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-rose-50/10">
                            <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-center"
                                value={row.absenceValue || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'absenceValue', e.target.value)}
                            />
                        </td>

                        {/* Violations */}
                        <td className="px-2 py-3 bg-red-50/10 border-r border-red-50">
                             <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center"
                                value={row.violationValue || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'violationValue', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-red-50/10">
                             <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center"
                                value={row.violationRepayment || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'violationRepayment', e.target.value)}
                            />
                        </td>
                        <td className="px-2 py-3 bg-red-50/10">
                            <div className={`text-sm font-bold text-center ${row.remainingViolations > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {row.remainingViolations > 0 ? row.remainingViolations : '-'}
                            </div>
                        </td>

                        {/* Incentives */}
                        <td className="px-2 py-3 bg-emerald-50/10 border-r border-emerald-50">
                             <input 
                                type="number" 
                                min="0"
                                className="w-full px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-center"
                                value={row.incentives || ''}
                                placeholder="0"
                                onChange={(e) => handleInputChange(worker.id, 'incentives', e.target.value)}
                            />
                        </td>

                        {/* Net Salary */}
                        <td className="px-4 py-3 bg-teal-50 sticky left-0 z-10 shadow-inner group-hover:bg-teal-100 transition-colors text-center border-l-4 border-teal-500">
                            <div className="text-sm font-black text-teal-800">
                                {formatCurrency(row.netSalary)}
                            </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
