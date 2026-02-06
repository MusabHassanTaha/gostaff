'use client';
import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { daysRemaining, statusClasses, labelFor, calculateDaysWorked } from '@/lib/date';
import { utils, writeFile } from 'xlsx';
import { Search, Calendar, Download, Printer, Users, UserCheck, UserX, FileText, LayoutDashboard, Truck, Car, AlertTriangle, Coffee, Pencil, Activity, Wallet } from 'lucide-react';
import SalaryReport from './SalaryReport';

function ReportsContent() {
  const { user } = useAuth();
  const { state: globalState, setState, cancelAbsence, updateAbsence, deleteAbsence } = useAppState();
  
  const isEngineer = user?.role === 'engineer';

  const state = useMemo(() => {
    // Global Filter: Exclude Archived Projects
    const activeSites = globalState.sites.filter(s => s.status !== 'archived');
    const filteredGlobalState = { ...globalState, sites: activeSites };

    if (isEngineer) {
        let visibleSites: any[] = [];

        // 1. Explicit Assignments (Priority)
        if (user?.assignedProjectIds && user.assignedProjectIds.length > 0) {
            const assignedSet = new Set(user.assignedProjectIds);
            visibleSites = activeSites.filter(s => assignedSet.has(s.id));
        } 
        // 2. Fallback: Name Matching (Legacy)
        else {
            const normalize = (s: string) => s ? s.toLowerCase().trim().replace(/\s+/g, ' ') : '';
            const uName = normalize(user?.username || '');
            
            const engineerWorker = globalState.workers.find(w => {
                if (!w.isEngineer) return false;
                const wName = normalize(w.name);
                return wName === uName || (uName.length > 3 && wName.includes(uName)) || (wName.length > 3 && uName.includes(wName));
            });

            if (engineerWorker) {
                visibleSites = activeSites.filter(s => s.engineerId === engineerWorker.id);
            }
        }

        if (visibleSites.length > 0) {
             const visibleWorkerIds = new Set(visibleSites.flatMap(s => s.assignedWorkerIds || []));
             const visibleSiteIds = new Set(visibleSites.map(s => s.id));
             
             // Filter workers: include if assigned to one of engineer's sites OR listed in site's assignedWorkerIds
             const visibleWorkers = globalState.workers.filter(w => 
                (w.assignedSiteId && visibleSiteIds.has(w.assignedSiteId)) || visibleWorkerIds.has(w.id)
             );
             
             return {
                 ...globalState,
                 sites: visibleSites,
                 workers: visibleWorkers
             };
        }
        return { ...globalState, sites: [], workers: [] };
    }
    return filteredGlobalState;
  }, [globalState, isEngineer, user]);

  const searchParams = useSearchParams();
  const initialView = 'projects';
  const [view, setView] = useState<'projects' | 'leave' | 'all' | 'projects_summary' | 'drivers' | 'vehicles' | 'violations' | 'absence' | 'salaries'>('projects');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    const v = searchParams.get('view');
    const s = searchParams.get('search');
    if (v) {
        setView(v as any);
    }
    if (s) {
        setHighlightId(s);
    }
  }, [searchParams]);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Violations Report State
  const [violationSearch, setViolationSearch] = useState('');
  const [violationSearchType, setViolationSearchType] = useState<'plate' | 'driver'>('plate');

  const [editingAbsence, setEditingAbsence] = useState<{ workerId: string; oldDate: string; newDate: string; reason: string } | null>(null);

  const handleDeleteAbsence = (workerId: string) => {
      if (confirm('هل أنت متأكد من حذف هذا الغياب؟ سيتم إعادة العامل إلى حالته السابقة.')) {
          cancelAbsence(workerId);
      }
  };

  const handleDeleteHistoryItem = (workerId: string, date: string) => {
      if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
          deleteAbsence(workerId, date);
      }
  };

  const handleSaveAbsence = () => {
      if (!editingAbsence) return;
      updateAbsence(editingAbsence.workerId, editingAbsence.oldDate, editingAbsence.newDate, editingAbsence.reason);
      setEditingAbsence(null);
  };

  useEffect(() => {
    const reportName = view === 'projects' ? 'تقرير_توزيع_المشاريع' : view === 'leave' ? 'تقرير_الإجازات' : view === 'projects_summary' ? 'تقرير_المشاريع_المبسط' : view === 'drivers' ? 'تقرير_السائقين' : view === 'vehicles' ? 'تقرير_المركبات' : view === 'violations' ? 'تقرير_المخالفات' : view === 'absence' ? 'تقرير_الغياب' : view === 'salaries' ? 'تقرير_الرواتب' : 'قاعدة_بيانات_العمال_الكل';
    document.title = `${reportName}_${selectedDate}`;
    return () => {
        document.title = 'Labour App';
    };
  }, [view, selectedDate]);

  const toDMY = (s: string) => {
    if (!s) return '';
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear());
    return `${dd}/${mm}/${yy}`;
  };

  const nowDMYTime = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear());
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hh = String(hours).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy}  ${ampm} ${hh}:${min}`;
  };

  const data = useMemo(() => {
    // Filter out pending workers from reports
    const activeWorkers = state.workers.filter(w => w.status !== 'pending');
    
    return state.sites.map(site => {
      const workers = activeWorkers.filter(w => w.assignedSiteId === site.id);
      const counts: Record<string, number> = {};
      state.skills.forEach(sk => { counts[sk.name] = 0; });
      workers.forEach(w => { counts[w.skill] = (counts[w.skill] || 0) + 1; });
      const driver = activeWorkers.find(w => w.id === site.driverId);
      const engineer = activeWorkers.find(w => w.id === site.engineerId);
      return { site, workers, counts, driver, engineer };
    });
  }, [state.sites, state.workers, state.skills]);

  const realLeaveData = useMemo(() => {
    const activeWorkers = state.workers.filter(w => w.status !== 'pending');
    return activeWorkers.filter(w => !w.assignedSiteId && w.availabilityStatus === 'rest');
  }, [state.workers]);

  const stats = useMemo(() => {
    const activeWorkers = state.workers.filter(w => w.status !== 'pending');
    const total = activeWorkers.length;
    const assigned = activeWorkers.filter(w => w.assignedSiteId).length;
    const leave = activeWorkers.filter(w => !w.assignedSiteId && w.availabilityStatus === 'rest').length;
    return { total, assigned, leave };
  }, [state.workers]);

  const projectStats = useMemo(() => {
    const totalProjects = state.sites.length;
    const stoppedProjects = state.sites.filter(s => s.status === 'stopped').length;
    const completedProjects = state.sites.filter(s => s.status === 'completed').length;
    // Active is everything else (undefined/null/active)
    const activeProjects = totalProjects - stoppedProjects - completedProjects;
    
    // Count workers in these projects (only for displayed projects)
    const siteIds = new Set(state.sites.map(s => s.id));
    const workersInProjects = state.workers.filter(w => w.assignedSiteId && siteIds.has(w.assignedSiteId) && w.status !== 'pending').length;

    return { totalProjects, activeProjects, stoppedProjects, completedProjects, workersInProjects };
  }, [state.sites, state.workers]);

  // waitingData removed


  // History Logic
    const [showHistory, setShowHistory] = useState(true);
    const [absenceSearch, setAbsenceSearch] = useState('');
    const [searchStart, setSearchStart] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    });
    const [searchEnd, setSearchEnd] = useState(() => new Date().toISOString().slice(0, 10));

    const filteredHistoryRows = useMemo(() => {
        if (!showHistory) return [];
        const rows: { w: any, h: any }[] = [];
        state.workers.forEach(w => {
            if (w.absenceHistory && w.absenceHistory.length > 0) {
                 // Pre-filter by search query to optimize
                 if (absenceSearch) {
                    const query = absenceSearch.toLowerCase();
                    const match = (w.name && w.name.toLowerCase().includes(query)) ||
                                (w.code && w.code.toLowerCase().includes(query)) ||
                                (w.iqamaNumber && w.iqamaNumber.includes(query));
                    if (!match) return;
                }
                w.absenceHistory.forEach(h => {
                    if (h.date >= searchStart && h.date <= searchEnd) {
                        rows.push({ w, h });
                    }
                });
            }
        });
        return rows.sort((a, b) => new Date(b.h.date).getTime() - new Date(a.h.date).getTime());
    }, [state.workers, showHistory, searchStart, searchEnd, absenceSearch]);

  const handleExportExcel = () => {
    const wb = utils.book_new();

    let fileName = `Labour_Report_${selectedDate}.xlsx`;
    if (view === 'projects') {
        fileName = `تقرير_توزيع_المشاريع_${selectedDate}.xlsx`;
    } else if (view === 'leave') {
        fileName = `تقرير_الإجازات_${selectedDate}.xlsx`;
    } else if (view === 'all') {
        fileName = `قاعدة_بيانات_العمال_الكل_${selectedDate}.xlsx`;
    } else if (view === 'projects_summary') {
        fileName = `تقرير_المشاريع_المبسط_${selectedDate}.xlsx`;
    } else if (view === 'drivers') {
        fileName = `تقرير_السائقين_${selectedDate}.xlsx`;
    } else if (view === 'vehicles') {
        fileName = `تقرير_المركبات_${selectedDate}.xlsx`;
    }

    if (showHistory && view === 'leave') {
        if (!searchStart || !searchEnd) {
             alert('الرجاء تحديد تاريخ البداية والنهاية');
             return;
        }
        fileName = `تقرير_سجل_الإجازات_${searchStart}_الى_${searchEnd}.xlsx`;
        
        const leaveRows = state.workers.map(w => {
            if (!w.leaveHistory || w.leaveHistory.length === 0) return null;
            
            let totalDays = 0;
            const details: string[] = [];
            
            w.leaveHistory.forEach(leave => {
                // Check overlap
                const lStart = leave.startDate;
                const lEnd = leave.endDate;
                
                // Simple overlap check
                if (lEnd < searchStart || lStart > searchEnd) return;
                
                // Calculate days in range
                const effectiveStart = lStart < searchStart ? searchStart : lStart;
                const effectiveEnd = lEnd > searchEnd ? searchEnd : lEnd;
                
                const startD = new Date(effectiveStart);
                const endD = new Date(effectiveEnd);
                const diffTime = Math.abs(endD.getTime() - startD.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
                
                totalDays += diffDays;
                details.push(`${leave.type}: ${effectiveStart} إلى ${effectiveEnd} (${diffDays} يوم)`);
            });
            
            if (totalDays === 0) return null;

            const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
            
            // Calculate annual balance
            const annualTotal = w.annualLeaveTotal || 30;
            const currentYear = new Date().getFullYear();
            const totalUsedInYear = (w.leaveHistory || []).reduce((acc, l) => {
                const lYear = new Date(l.startDate).getFullYear();
                if (lYear === currentYear && l.type === 'annual') {
                    const s = new Date(l.startDate);
                    const e = new Date(l.endDate);
                    const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    return acc + diff;
                }
                return acc;
            }, 0);
            const remainingBalance = annualTotal - totalUsedInYear;

            return {
                'اسم العامل': w.name,
                'المهنة': skLabel,
                'رقم الجوال': w.phone || '',
                'إجمالي أيام الإجازة (في الفترة)': totalDays,
                'رصيد الإجازة السنوي': annualTotal,
                'المستهلك (سنوي)': totalUsedInYear,
                'المتبقي (سنوي)': remainingBalance,
                'التفاصيل': details.join('\n')
            };
        }).filter(Boolean);

        if (leaveRows.length === 0) {
            alert('لا توجد بيانات إجازات في هذه الفترة');
            return;
        }

        const wsLeave = utils.json_to_sheet(leaveRows);
        wsLeave['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 60 }];
        utils.book_append_sheet(wb, wsLeave, "سجل الإجازات");
        writeFile(wb, fileName);
        return;
    }

    if (view === 'drivers') {
      const drivers = state.workers.filter(w => w.skill === 'Driver' || w.skill === 'سائق');
      const driverRows: any[] = drivers.map(d => {
         const assignedSites = state.sites.filter(s => s.assignedDrivers?.some(ad => ad.driverId === d.id) || s.driverId === d.id);
         let totalTransported = 0;
         const sitesDetails = assignedSites.map(s => {
             const ad = s.assignedDrivers?.find(x => x.driverId === d.id);
             const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
             totalTransported += Number(count);
             return `${s.name} (${count})`;
         }).join('، ');

         return {
             'اسم السائق': d.name,
             'رقم الجوال': d.phone,
             'نوع السيارة': d.driverCarType || '',
             'رقم اللوحة': d.driverCarPlate || '',
             'السعة': d.driverCapacity || '',
             'عدد المواقع': assignedSites.length,
             'إجمالي المنقولين': totalTransported,
             'تفاصيل المواقع': sitesDetails
         };
      });

      // Calculate Totals for Excel
      const totalSites = driverRows.reduce((sum, row) => sum + (Number(row['عدد المواقع']) || 0), 0);
      const totalTransportedAll = driverRows.reduce((sum, row) => sum + (Number(row['إجمالي المنقولين']) || 0), 0);

      // Add Empty Row for spacing
      driverRows.push({});

      // Add Totals Row
      driverRows.push({
          'اسم السائق': 'الإجمالي الكلي:',
          'رقم الجوال': '',
          'نوع السيارة': '',
          'رقم اللوحة': '',
          'السعة': '',
          'عدد المواقع': totalSites,
          'إجمالي المنقولين': totalTransportedAll,
          'تفاصيل المواقع': ''
      });

      const wsDrivers = utils.json_to_sheet(driverRows);
      wsDrivers['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 50 }];
      utils.book_append_sheet(wb, wsDrivers, "السائقين");
      writeFile(wb, fileName);
      return;
    }

    if (view === 'vehicles') {
      const vehicleRows = (state.vehicles || []).map(v => ({
        'رقم اللوحة': v.plateNumber,
        'النوع': v.type,
        'الموديل': v.model,
        'سنة الصنع': v.year,
        'عدد الصيانات': v.maintenanceHistory?.length || 0,
        'عدد المخالفات': v.violations?.length || 0,
        'تاريخ انتهاء الاستمارة': v.registrationExpiry || ''
      }));
      const wsVehicles = utils.json_to_sheet(vehicleRows);
      wsVehicles['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
      utils.book_append_sheet(wb, wsVehicles, "المركبات");
      writeFile(wb, fileName);
      return;
    }

    if (view === 'salaries') {
        fileName = `تقرير_الرواتب_${selectedDate}.xlsx`;
        const salaryData = state.salaryData || {};
        
        const salaryRows = state.workers.map(worker => {
             const data = salaryData[worker.id] || {
                  basicSalary: 0,
                  advance: 0,
                  advanceRepayment: 0,
                  absenceDays: 0,
                  violationValue: 0,
                  violationRepayment: 0,
                  incentives: 0
             };
             
             const remainingAdvance = Math.max(0, (data.advance || 0) - (data.advanceRepayment || 0));
             const absenceValue = Math.round(((data.basicSalary || 0) / 30) * (data.absenceDays || 0));
             const remainingViolations = Math.max(0, (data.violationValue || 0) - (data.violationRepayment || 0));
             const netSalary = Math.max(0, (data.basicSalary || 0) + (data.incentives || 0) - (data.advanceRepayment || 0) - absenceValue - (data.violationRepayment || 0));
             
             return {
                 'الكود': worker.code || '',
                 'الموظف': worker.name,
                 'المهنة': worker.skill,
                 'الراتب الاساسي': data.basicSalary,
                 'السلفه': data.advance,
                 'سداد سلفه': data.advanceRepayment,
                 'باقي السلفه': remainingAdvance,
                 'أيام غياب': data.absenceDays,
                 'قيمة الغياب': absenceValue,
                 'قيمة مخالفات': data.violationValue,
                 'سداد مخالفات': data.violationRepayment,
                 'متبقي مخالفات': remainingViolations,
                 'حوافز': data.incentives,
                 'صافي الراتب': netSalary
             };
        });
        
        // Calculate Totals
        const totals = salaryRows.reduce((acc, row) => ({
             'الراتب الاساسي': acc['الراتب الاساسي'] + row['الراتب الاساسي'],
             'السلفه': acc['السلفه'] + row['السلفه'],
             'سداد سلفه': acc['سداد سلفه'] + row['سداد سلفه'],
             'باقي السلفه': acc['باقي السلفه'] + row['باقي السلفه'],
             'أيام غياب': acc['أيام غياب'] + row['أيام غياب'],
             'قيمة الغياب': acc['قيمة الغياب'] + row['قيمة الغياب'],
             'قيمة مخالفات': acc['قيمة مخالفات'] + row['قيمة مخالفات'],
             'سداد مخالفات': acc['سداد مخالفات'] + row['سداد مخالفات'],
             'متبقي مخالفات': acc['متبقي مخالفات'] + row['متبقي مخالفات'],
             'حوافز': acc['حوافز'] + row['حوافز'],
             'صافي الراتب': acc['صافي الراتب'] + row['صافي الراتب']
        }), {
             'الراتب الاساسي': 0,
             'السلفه': 0,
             'سداد سلفه': 0,
             'باقي السلفه': 0,
             'أيام غياب': 0,
             'قيمة الغياب': 0,
             'قيمة مخالفات': 0,
             'سداد مخالفات': 0,
             'متبقي مخالفات': 0,
             'حوافز': 0,
             'صافي الراتب': 0
        });

        // Add Total Row
        salaryRows.push({
             'الكود': 'الإجمالي',
             'الموظف': '-',
             'المهنة': '-',
             ...totals
        });

        const wsSalaries = utils.json_to_sheet(salaryRows);
        wsSalaries['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
        utils.book_append_sheet(wb, wsSalaries, "الرواتب");
        writeFile(wb, fileName);
        return;
    }

    if (view === 'projects_summary') {
      const summaryRows = state.sites.map(site => {
        const engineer = state.workers.find(w => w.id === site.engineerId);
        let statusText = 'جاري العمل';
        if (site.status === 'completed') statusText = 'منتهي';
        else if (site.status === 'stopped') statusText = 'متوقف';
        
        return {
          'اسم المشروع': site.name,
          'المسؤول عن المشروع': engineer ? engineer.name : 'بدون',
          'الحالة': statusText,
          'ملاحظات': site.statusNote || '',
          'عدد العمال': state.workers.filter(w => w.assignedSiteId === site.id).length
        };
      });
      const wsSummary = utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 10 }];
      utils.book_append_sheet(wb, wsSummary, "تقرير المشاريع المبسط");
      writeFile(wb, fileName);
      return;
    }

    if (showHistory && view === 'absence') {
        if (!searchStart || !searchEnd) {
             alert('الرجاء تحديد تاريخ البداية والنهاية');
             return;
        }
        fileName = `تقرير_سجل_الغياب_${searchStart}_الى_${searchEnd}.xlsx`;
        
        const absenceRows: any[] = [];
        state.workers.forEach(w => {
             if (!w.absenceHistory || w.absenceHistory.length === 0) return;
             w.absenceHistory.forEach(h => {
                 if (h.date < searchStart || h.date > searchEnd) return;
                 const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                 const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
                 absenceRows.push({
                     'الكود': w.code || '',
                     'اسم العامل': w.name,
                     'المهنة': skLabel,
                     'رقم الجوال': w.phone,
                     'تاريخ الغياب': h.date,
                     'سبب الغياب': h.reason || '-',
                     'سُجل بواسطة': h.recordedBy || '-',
                     'المشروع المرتبط': assignedSite ? assignedSite.name : 'غير موزع'
                 });
             });
        });
        
        if (absenceRows.length === 0) {
             alert('لا توجد بيانات غياب في هذه الفترة');
             return;
        }
        
        const wsAbsence = utils.json_to_sheet(absenceRows);
        wsAbsence['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
        utils.book_append_sheet(wb, wsAbsence, "سجل الغياب");
        writeFile(wb, fileName);
        return;
    }

    if (view === 'absence') {
        const absenceRows = state.workers
            .filter(w => w.availabilityStatus === 'absent')
            .map(w => {
                const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
                const absenceReason = w.absenceHistory && w.absenceHistory.length > 0 ? w.absenceHistory[w.absenceHistory.length - 1].reason || '-' : '-';
                const recordedBy = w.absenceHistory && w.absenceHistory.length > 0 ? w.absenceHistory[w.absenceHistory.length - 1].recordedBy || '-' : '-';
                const absenceDate = w.absentSince ? new Date(w.absentSince).toLocaleDateString('en-GB') : '-';
                return {
                    'الكود': w.code || '',
                    'اسم العامل': w.name,
                    'المهنة': skLabel,
                    'رقم الجوال': w.phone,
                    'تاريخ الغياب': absenceDate,
                    'سبب الغياب': absenceReason,
                    'سُجل بواسطة': recordedBy,
                    'المشروع المرتبط': assignedSite ? assignedSite.name : 'غير موزع'
                };
            });
            
        const wsAbsence = utils.json_to_sheet(absenceRows);
        wsAbsence['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
        utils.book_append_sheet(wb, wsAbsence, "الغياب الحالي");
        writeFile(wb, fileName);
        return;
    }

    // 1. Projects Sheet
    const projectRows: any[] = [];
    data.forEach(({ site, workers }) => {
      if (workers.length === 0) return;
      workers.forEach(w => {
        const iqDays = daysRemaining(w.iqamaExpiry);
        const insDays = daysRemaining(w.insuranceExpiry);
        const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
        const driver = state.workers.find(w => w.id === site.driverId);
        
        projectRows.push({
          'الكود': w.code || '',
          'الموقع': site.name,
          'الاسم': w.name,
          'المهنة': skLabel,
          'رقم الإقامة': w.iqamaNumber,
          'الجوال': w.phone,
          'انتهاء الإقامة': w.iqamaExpiry,
          'حالة الإقامة': labelFor(iqDays, !!w.iqamaExpiry),
          'انتهاء التأمين': w.insuranceExpiry,
          'حالة التأمين': labelFor(insDays, !!w.insuranceExpiry),
          'السائق': driver ? driver.name : '',
          'جوال السائق': driver ? driver.phone : '',
          'سعة السائق': driver ? driver.driverCapacity : '',
          'نوع السيارة': driver ? driver.driverCarType : '',
          'لوحة السيارة': driver ? driver.driverCarPlate : '',
        });
      });
    });
    const wsProjects = utils.json_to_sheet(projectRows);
    wsProjects['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
    utils.book_append_sheet(wb, wsProjects, "توزيع المشاريع");

    // 2. Waiting Sheet - Removed


    // 4. Leave Sheet
    const leaveSheetRows = realLeaveData.map(w => {
      const iqDays = daysRemaining(w.iqamaExpiry);
      const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
      const currentLeave = w.leaveHistory?.find(l => {
          const today = new Date().toISOString().slice(0, 10);
          return l.startDate <= today && l.endDate >= today;
      });
      return {
        'الاسم': w.name,
        'المهنة': skLabel,
        'نوع الإجازة': currentLeave ? currentLeave.type : '',
        'تاريخ العودة': currentLeave ? currentLeave.endDate : '',
        'رقم الإقامة': w.iqamaNumber,
        'الجوال': w.phone,
        'انتهاء الإقامة': w.iqamaExpiry,
        'حالة الإقامة': labelFor(iqDays, !!w.iqamaExpiry),
      };
    });
    const wsLeaveSheet = utils.json_to_sheet(leaveSheetRows);
    wsLeaveSheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    utils.book_append_sheet(wb, wsLeaveSheet, "الإجازات");

    // 3. Summary Sheet
    const summaryRows = state.sites.map(site => {
      const engineer = state.workers.find(w => w.id === site.engineerId);
      const driver = state.workers.find(w => w.id === site.driverId);
      const workerNames = state.workers.filter(w => w.assignedSiteId === site.id).map(w => w.name).join(', ');
      
      let statusText = 'جاري العمل';
      if (site.status === 'completed') statusText = 'منتهي';
      else if (site.status === 'stopped') statusText = 'متوقف';

      return {
        'المشروع': site.name,
        'الحالة': statusText,
        'المسؤول': engineer ? engineer.name : '',
        'السائق': driver ? driver.name : '',
        'عدد العمال': state.workers.filter(w => w.assignedSiteId === site.id).length,
      };
    });
    // Add Stats Row
    const totalWorkersSummary = state.sites.reduce((acc, s) => acc + state.workers.filter(w => w.assignedSiteId === s.id).length, 0);
    summaryRows.push({
        'المشروع': '--- الإجمالي ---',
        'المسؤول': '',
        'السائق': '',
        'عدد العمال': totalWorkersSummary
    } as any);
    
    const wsSummary = utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    utils.book_append_sheet(wb, wsSummary, "ملخص");

    // 4. All Workers Sheet
    const allWorkersRows = state.workers.map((w, idx) => {
        const iqDays = daysRemaining(w.iqamaExpiry);
        const insDays = daysRemaining(w.insuranceExpiry);
        const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
        const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
        const daysWorked = calculateDaysWorked(w.hireDate);
        
        return {
          '#': idx + 1,
          'الاسم': w.name,
          'الاسم (EN)': w.englishName || '',
          'المهنة': skLabel,
          'الموقع الحالي': assignedSite ? assignedSite.name : 'غير موزع (غياب)',
          'رقم الإقامة': w.iqamaNumber,
          'رقم الجوال': w.phone,
          'الجنسية': w.nationality || '',
          'الديانة': w.religion || '',
          'تاريخ التعيين': w.hireDate || '',
          'مدة العمل (أيام)': daysWorked === undefined ? '' : daysWorked,
          'انتهاء الإقامة': w.iqamaExpiry,
          'حالة الإقامة': labelFor(iqDays, !!w.iqamaExpiry),
          'انتهاء التأمين': w.insuranceExpiry,
          'حالة التأمين': labelFor(insDays, !!w.insuranceExpiry),
          'اسم البنك': w.bankName || '',
          'رقم الحساب': w.bankAccount || '',
          'حالة التوفر': w.assignedSiteId ? 'موزع' : (w.availabilityStatus === 'absent' ? 'غياب' : 'استراحة'),
          'رابط الإقامة': w.iqamaImage || ''
        };
    });
    const wsAll = utils.json_to_sheet(allWorkersRows);
    wsAll['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];
    wsAll['!pageSetup'] = { orientation: 'landscape' };
    utils.book_append_sheet(wb, wsAll, "جميع العمال");

    writeFile(wb, fileName);
  };

  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-24 print:pt-0 print:pb-0 print:bg-white animate-fade-in font-cairo">
      <div className="max-w-[1920px] mx-auto px-4 md:px-10 print:max-w-none print:px-2">
        <div className="flex flex-col gap-6 print:hidden mb-8">
            <div className="text-center">
                 <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {view === 'projects' ? 'صفحة التقارير' : view === 'projects_summary' ? 'تقرير المشاريع المبسط' : view === 'drivers' ? 'تقرير السائقين' : view === 'vehicles' ? 'تقرير المركبات' : view === 'violations' ? 'تقرير المخالفات' : 'قاعدة بيانات العمال الشاملة'}
                 </h1>
                 <p className="text-gray-500">استخراج التقارير وتصديرها</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/" className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 text-gray-700 font-bold transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5">
                    <LayoutDashboard className="w-5 h-5" />
                    لوحة التوزيع
                </Link>
                
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 group">
                    <Calendar className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <input 
                        type="date" 
                        defaultValue={selectedDate}
                        onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
                        className="text-sm outline-none bg-transparent text-gray-900 font-bold cursor-pointer"
                        dir="ltr"
                    />
                </div>

                {user?.role !== 'viewer' && (
                <>
                <button 
                    onClick={handleExportExcel} 
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    <Download className="w-5 h-5" />
                    تصدير Excel
                </button>
                <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                    <Printer className="w-5 h-5" />
                    طباعة PDF
                </button>
                </>
                )}
            </div>
        </div>

        {/* Professional Tabs Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-8 print:hidden">
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'projects', label: 'تقارير المشاريع', icon: LayoutDashboard, activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-2 ring-blue-100', inactiveClass: 'text-gray-600 hover:bg-blue-50 hover:text-blue-700' },
                    { id: 'absence', label: 'تقارير الغياب', icon: UserX, activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-200 ring-2 ring-rose-100', inactiveClass: 'text-gray-600 hover:bg-rose-50 hover:text-rose-700' },
                    { id: 'projects_summary', label: 'تقرير المشاريع المبسط', icon: FileText, activeClass: 'bg-orange-500 text-white shadow-lg shadow-orange-200 ring-2 ring-orange-100', inactiveClass: 'text-gray-600 hover:bg-orange-50 hover:text-orange-700' },
                    { id: 'drivers', label: 'تقرير السائقين', icon: Truck, activeClass: 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-100', inactiveClass: 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700' },
                    { id: 'vehicles', label: 'تقرير المركبات', icon: Car, activeClass: 'bg-purple-600 text-white shadow-lg shadow-purple-200 ring-2 ring-purple-100', inactiveClass: 'text-gray-600 hover:bg-purple-50 hover:text-purple-700' },
                    { id: 'violations', label: 'تقرير المخالفات', icon: AlertTriangle, activeClass: 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-100', inactiveClass: 'text-gray-600 hover:bg-red-50 hover:text-red-700' },
                    { id: 'salaries', label: 'تقرير الرواتب', icon: Wallet, activeClass: 'bg-teal-600 text-white shadow-lg shadow-teal-200 ring-2 ring-teal-100', inactiveClass: 'text-gray-600 hover:bg-teal-50 hover:text-teal-700' },
                    { id: 'all', label: 'الكل (قاعدة البيانات)', icon: Users, activeClass: 'bg-slate-800 text-white shadow-lg shadow-slate-200 ring-2 ring-slate-100', inactiveClass: 'text-gray-600 hover:bg-slate-50 hover:text-slate-800' },
                ].filter(tab => !(user?.role === 'engineer' && (tab.id === 'vehicles' || tab.id === 'violations' || tab.id === 'projects_summary' || tab.id === 'drivers' || tab.id === 'salaries' || tab.id === 'all'))).map((tab) => {
                    const Icon = tab.icon;
                    const isActive = view === tab.id;
                    return (
                        <button 
                            key={tab.id}
                            onClick={() => setView(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${isActive ? tab.activeClass : tab.inactiveClass}`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Print Header */}
        <div className="hidden print:block mb-6 border-b pb-4">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        {view === 'projects' ? 'تقرير توزيع المشاريع' : view === 'projects_summary' ? 'تقرير المشاريع المبسط' : view === 'drivers' ? 'تقرير السائقين' : view === 'vehicles' ? 'تقرير المركبات' : view === 'violations' ? 'تقرير المخالفات' : view === 'salaries' ? 'تقرير الرواتب' : 'قاعدة بيانات العمال الشاملة'}
                    </h1>
                    <div className="text-base text-gray-600 font-medium">تاريخ التقرير: {toDMY(selectedDate)}</div>
                </div>
                <div className="text-left text-sm text-gray-400">
                    تم الطباعة: {nowDMYTime()}
                </div>
            </div>
        </div>

        {/* Project Statistics Dashboard */}
        {(view === 'projects' || view === 'projects_summary') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 print:grid-cols-4 print:gap-2 print:mb-4 break-inside-avoid">
                {/* Total Projects */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 print:p-2 print:border-gray-400 print:shadow-none">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600 [print-color-adjust:exact]">
                        <LayoutDashboard className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium print:text-[10px] print:text-black">إجمالي المشاريع</p>
                        <p className="text-2xl font-bold text-gray-900 print:text-sm print:text-black">{projectStats.totalProjects}</p>
                    </div>
                </div>

                {/* Active Projects */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 print:p-2 print:border-gray-400 print:shadow-none">
                    <div className="p-3 bg-green-50 rounded-lg text-green-600 [print-color-adjust:exact]">
                        <Activity className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium print:text-[10px] print:text-black">مشاريع جارية</p>
                        <p className="text-2xl font-bold text-gray-900 print:text-sm print:text-black">{projectStats.activeProjects}</p>
                    </div>
                </div>

                {/* Stopped Projects */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 print:p-2 print:border-gray-400 print:shadow-none">
                    <div className="p-3 bg-orange-50 rounded-lg text-orange-600 [print-color-adjust:exact]">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium print:text-[10px] print:text-black">مشاريع متوقفة</p>
                        <p className="text-2xl font-bold text-gray-900 print:text-sm print:text-black">{projectStats.stoppedProjects}</p>
                    </div>
                </div>

                {/* Workers in Projects */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 print:p-2 print:border-gray-400 print:shadow-none">
                    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600 [print-color-adjust:exact]">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium print:text-[10px] print:text-black">العمال بالمشاريع</p>
                        <p className="text-2xl font-bold text-gray-900 print:text-sm print:text-black">{projectStats.workersInProjects}</p>
                    </div>
                </div>
            </div>
        )}

        {view === 'projects_summary' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">اسم المشروع</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">المسؤول عن المشروع</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">الحالة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">ملاحظات</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">عدد العمال</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {state.sites.map((site, idx) => {
                                const engineer = state.workers.find(w => w.id === site.engineerId);
                                const workerCount = state.workers.filter(w => w.assignedSiteId === site.id).length;
                                
                                let statusColor = 'bg-green-100 text-green-700 border-green-200';
                                let statusText = 'جاري العمل';
                                if (site.status === 'completed') {
                                    statusColor = 'bg-blue-100 text-blue-700 border-blue-200';
                                    statusText = 'منتهي';
                                } else if (site.status === 'stopped') {
                                    statusColor = 'bg-red-100 text-red-700 border-red-200';
                                    statusText = 'متوقف';
                                }

                                return (
                                    <tr key={site.id} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                <td className="px-5 py-4 font-bold text-gray-900 text-base group-hover:text-blue-700 hover:underline transition-colors print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{site.name}</td>
                                        <td className="px-5 py-4 text-gray-700 font-medium text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{engineer ? engineer.name : <span className="text-gray-400">بدون</span>}</td>
                                        <td className="px-5 py-4 print:py-1.5 print:px-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor} print:border-gray-300 print:bg-white print:text-black print:px-2 print:py-0.5`}>
                                                {statusText}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{site.statusNote || '-'}</td>
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs">{workerCount}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-gray-300 print:border-gray-800 font-bold">
                            <tr>
                                <td colSpan={4} className="px-5 py-4 text-gray-900 text-left pl-10 print:py-2 print:px-2 print:text-sm">الإجمالي الكلي للعمال في المشاريع:</td>
                                <td className="px-5 py-4 text-blue-700 text-lg print:text-black print:py-2 print:px-2 print:text-sm">
                                    {state.sites.reduce((acc, site) => acc + state.workers.filter(w => w.assignedSiteId === site.id).length, 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        )}

        {view === 'vehicles' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-purple-50 print:bg-white print:border-b-2 print:border-purple-800">
                    <h2 className="text-xl font-bold text-purple-700 flex items-center gap-2 print:text-black">
                        <Car className="w-6 h-6" />
                        تقرير المركبات
                    </h2>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold border border-purple-200 print:border-purple-800 print:bg-white print:text-purple-800">
                        العدد: {(state.vehicles || []).length}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">رقم اللوحة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">النوع</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">الموديل</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">سنة الصنع</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">عدد الصيانات</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">عدد المخالفات</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">تاريخ انتهاء الاستمارة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {(state.vehicles || []).map((vehicle, idx) => {
                                const regDays = daysRemaining(vehicle.registrationExpiry);
                                const regColor = regDays === undefined ? 'text-gray-600' : regDays < 0 ? 'text-red-600' : regDays < 30 ? 'text-orange-600' : 'text-green-600';
                                const hasViolations = (vehicle.violations?.length || 0) > 0;
                                
                                return (
                                    <tr key={vehicle.id} className={`hover:bg-purple-50/20 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30 print:bg-gray-50/50'}`}>
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base group-hover:text-purple-700 transition-colors print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1.5 bg-gray-100 rounded text-gray-600 print:hidden"><Car className="w-4 h-4"/></span>
                                                {vehicle.plateNumber}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-gray-700 font-medium text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{vehicle.type}</td>
                                        <td className="px-5 py-4 text-gray-700 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{vehicle.model}</td>
                                        <td className="px-5 py-4 text-gray-700 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200 font-mono">{vehicle.year}</td>
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs border-b border-gray-50 print:border-gray-200">{vehicle.maintenanceHistory?.length || 0}</td>
                                        <td className="px-5 py-4 font-bold text-base print:py-1.5 print:px-2 print:text-xs border-b border-gray-50 print:border-gray-200">
                                            <span className={hasViolations ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded-full' : 'text-gray-400'}>
                                                {vehicle.violations?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">
                                            <span className={`font-bold ${regColor}`}>
                                                {toDMY(vehicle.registrationExpiry || '')}
                                            </span>
                                            {vehicle.registrationExpiry && (
                                                <div className={`text-xs mt-0.5 ${regColor} print:hidden`}>
                                                    {labelFor(regDays, true)}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {(state.vehicles || []).length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-16 text-center text-gray-500">
                                        <Car className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                                        <p className="text-lg font-medium">لا توجد مركبات مسجلة في النظام</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold print:bg-white print:table-footer-group">
                            {(() => {
                                const drivers = state.workers.filter(w => w.skill === 'Driver' || w.skill === 'سائق');
                                let grandTotalSites = 0;
                                let grandTotalTransported = 0;
                                drivers.forEach(d => {
                                    const assignedSites = state.sites.filter(s => s.assignedDrivers?.some(ad => ad.driverId === d.id) || s.driverId === d.id);
                                    grandTotalSites += assignedSites.length;
                                    assignedSites.forEach(s => {
                                        const ad = s.assignedDrivers?.find(x => x.driverId === d.id);
                                        const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
                                        grandTotalTransported += Number(count);
                                    });
                                });
                                return (
                                    <tr>
                                        <td colSpan={2} style={{ borderTop: '3px solid black' }} className="px-5 py-4 border-t-2 border-gray-400 print:!border-black print:!border-t-[3px]"></td>
                                        <td style={{ borderTop: '3px solid black' }} className="px-5 py-4 text-left text-gray-800 font-black border-t-2 border-gray-400 print:!border-black print:!border-t-[3px] print:text-black print:py-3 print:px-2 print:text-sm print:text-left whitespace-nowrap">الإجمالي الكلي:</td>
                                        <td style={{ borderTop: '3px solid black' }} className="px-5 py-4 text-center text-indigo-800 font-black text-xl border-t-2 border-gray-400 print:!border-black print:!border-t-[3px] print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{grandTotalSites}</td>
                                        <td style={{ borderTop: '3px solid black' }} className="px-5 py-4 text-center text-indigo-800 font-black text-xl border-t-2 border-gray-400 print:!border-black print:!border-t-[3px] print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{grandTotalTransported}</td>
                                        <td style={{ borderTop: '3px solid black' }} className="px-5 py-4 border-t-2 border-gray-400 print:!border-black print:!border-t-[3px]"></td>
                                    </tr>
                                );
                            })()}
                        </tfoot>
                    </table>
                </div>
            </div>
        )}

        {view === 'violations' && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm print:hidden">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">بحث عن مخالفات</label>
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    value={violationSearch}
                                    onChange={(e) => setViolationSearch(e.target.value)}
                                    placeholder={violationSearchType === 'plate' ? "أدخل رقم اللوحة..." : "أدخل اسم السائق..."}
                                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="vSearchType"
                                    checked={violationSearchType === 'plate'}
                                    onChange={() => setViolationSearchType('plate')}
                                    className="text-red-600 focus:ring-red-500"
                                />
                                <span className="text-sm font-medium text-gray-700">بحث برقم اللوحة</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="vSearchType"
                                    checked={violationSearchType === 'driver'}
                                    onChange={() => setViolationSearchType('driver')}
                                    className="text-red-600 focus:ring-red-500"
                                />
                                <span className="text-sm font-medium text-gray-700">بحث اسم السائق</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 print:space-y-8">
                    {violationSearchType === 'plate' ? (
                        (state.vehicles || [])
                            .filter(v => !violationSearch || v.plateNumber.includes(violationSearch))
                            .filter(v => (v.violations?.length || 0) > 0)
                            .map(vehicle => (
                                <div key={vehicle.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800 break-inside-avoid">
                                    <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between print:bg-white print:border-b-2 print:border-gray-800">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white rounded-lg border border-red-100 print:hidden">
                                                <Car className="w-6 h-6 text-red-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 print:text-black">{vehicle.plateNumber}</h3>
                                                <p className="text-sm text-gray-500 print:text-gray-700">{vehicle.type} - {vehicle.model} ({vehicle.year})</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-red-800 print:text-black bg-white px-3 py-1 rounded-lg border border-red-200 shadow-sm print:border-gray-400 print:shadow-none">
                                                إجمالي الغرامات: <span className="text-red-600 print:text-black mx-1">{vehicle.violations.reduce((acc, v) => acc + (v.cost || 0), 0).toLocaleString()}</span> ريال
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right border-collapse">
                                            <thead className="bg-gray-100 text-gray-900 border-b-2 border-gray-300 print:bg-gray-200 print:text-black print:border-black">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400 last:border-l-0">#</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">رقم المخالفة</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">التاريخ</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">نوع المخالفة</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">السائق</th>
                                                    <th className="px-4 py-3 font-bold print:px-2 print:py-1 text-xs">التكلفة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {(vehicle.violations || []).map((v, vIdx) => (
                                                    <tr key={v.id || vIdx} className="hover:bg-red-50/40 transition-colors even:bg-gray-50 print:even:bg-gray-100 print:hover:bg-transparent">
                                                        <td className="px-4 py-3 text-gray-600 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px] font-mono last:border-l-0 bg-gray-50/50">{vIdx + 1}</td>
                                                        <td className="px-4 py-3 font-mono text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px]">{v.violationNumber || '-'}</td>
                                                        <td className="px-4 py-3 text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px] font-mono" dir="ltr">{v.date}</td>
                                                        <td className="px-4 py-3 text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px] font-bold">{v.type}</td>
                                                        <td className="px-4 py-3 text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px]">{v.driverName || '-'}</td>
                                                        <td className="px-4 py-3 font-bold text-red-700 print:text-black print:px-2 print:py-1 print:text-[10px]">{v.cost?.toLocaleString()} ريال</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                    ) : (
                        (() => {
                            const driverMap = new Map();
                            (state.vehicles || []).forEach(v => {
                                (v.violations || []).forEach(vio => {
                                    const dName = vio.driverName || 'غير معروف';
                                    if (!violationSearch || dName.includes(violationSearch)) {
                                        if (!driverMap.has(dName)) driverMap.set(dName, []);
                                        driverMap.get(dName).push({ ...vio, vehiclePlate: v.plateNumber, vehicleType: v.type });
                                    }
                                });
                            });
                            
                            if (driverMap.size === 0) return <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">لا توجد مخالفات لهذا السائق</div>;

                            return Array.from(driverMap.entries()).map(([driverName, violations]) => (
                                <div key={driverName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800 break-inside-avoid">
                                    <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between print:bg-white print:border-b-2 print:border-gray-800">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white rounded-lg border border-red-100 print:hidden">
                                                <Users className="w-6 h-6 text-red-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 print:text-black">السائق: {driverName}</h3>
                                                <p className="text-sm text-gray-500 print:text-gray-700">عدد المخالفات: {violations.length}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-red-800 print:text-black bg-white px-3 py-1 rounded-lg border border-red-200 shadow-sm print:border-gray-400 print:shadow-none">
                                                إجمالي الغرامات: <span className="text-red-600 print:text-black mx-1">{violations.reduce((acc: any, v: any) => acc + (v.cost || 0), 0).toLocaleString()}</span> ريال
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-right border-collapse">
                                            <thead className="bg-gray-100 text-gray-900 border-b-2 border-gray-300 print:bg-gray-200 print:text-black print:border-black">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400 last:border-l-0">#</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">المركبة</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">رقم المخالفة</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">التاريخ</th>
                                                    <th className="px-4 py-3 font-bold border-l border-gray-300 print:px-2 print:py-1 text-xs print:border-gray-400">نوع المخالفة</th>
                                                    <th className="px-4 py-3 font-bold print:px-2 print:py-1 text-xs">التكلفة</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {violations.map((v: any, vIdx: number) => (
                                                    <tr key={v.id || vIdx} className="hover:bg-red-50/40 transition-colors even:bg-gray-50 print:even:bg-gray-100 print:hover:bg-transparent">
                                                        <td className="px-4 py-3 text-gray-600 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px] font-mono last:border-l-0 bg-gray-50/50">{vIdx + 1}</td>
                                                        <td className="px-4 py-3 font-bold text-gray-900 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px]">
                                                            <div className="flex flex-col">
                                                                <span>{v.vehiclePlate}</span>
                                                                <span className="text-xs text-gray-500 font-normal">{v.vehicleType}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px]">{v.violationNumber || '-'}</td>
                                                        <td className="px-4 py-3 text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px] font-mono" dir="ltr">{v.date}</td>
                                                        <td className="px-4 py-3 text-gray-800 border-l border-gray-200 print:border-gray-300 print:px-2 print:py-1 print:text-[10px] font-bold">{v.type}</td>
                                                        <td className="px-4 py-3 font-bold text-red-700 print:text-black print:px-2 print:py-1 print:text-[10px]">{v.cost?.toLocaleString()} ريال</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ));
                        })()
                    )}
                </div>
            </div>
        )}

        {view === 'projects' ? (
            <div className="space-y-8 print:space-y-8">
                {data.map(({ site, workers, counts, driver, engineer }, idx) => (
                <section key={site.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:overflow-visible print:shadow-none print:border-0 print:m-0 print:p-0 print:w-full print:h-auto print:block" style={{ pageBreakAfter: 'always' }}>
                    
                    {/* Header Section */}
                    <div className="bg-gray-900 text-white p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 print:bg-white print:text-black print:border-b-2 print:border-gray-800 print:p-4 print:mb-2 break-inside-avoid">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-3 print:mb-2">
                                <h2 className="text-2xl font-bold text-white print:text-black print:text-xl">{site.name}</h2>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold border print:border-2 print:text-xs print:px-2 print:py-0.5 ${
                                    site.status === 'completed' ? 'bg-blue-900 text-blue-100 border-blue-700 print:text-blue-800 print:bg-white print:border-blue-800' :
                                    site.status === 'stopped' ? 'bg-red-900 text-red-100 border-red-700 print:text-red-800 print:bg-white print:border-red-800' :
                                    'bg-green-900 text-green-100 border-green-700 print:text-green-800 print:bg-white print:border-green-800'
                                }`}>
                                    {site.status === 'completed' ? 'منتهي' :
                                     site.status === 'stopped' ? 'متوقف' :
                                     'جاري العمل'}
                                </span>
                            </div>
                            <p className="text-base text-gray-300 font-medium mb-4 print:text-gray-700 print:text-xs print:mb-1 flex items-center gap-2">
                                <span className="print:hidden">📍</span>
                                {site.location}
                            </p>
                            
                            {site.status === 'stopped' && site.statusNote && (
                            <div className="mt-2 text-sm text-red-200 bg-red-900/30 px-3 py-2 rounded border border-red-900/50 inline-block print:bg-red-50 print:text-red-800 print:border-red-200 print:text-xs print:py-1">
                                <span className="font-bold ml-1">سبب التوقف:</span>
                                {site.statusNote}
                            </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 min-w-[300px] print:min-w-0 print:grid print:grid-cols-3 print:gap-4 print:items-center print:w-full print:mt-2">
                            {/* Manager Block - Blue Theme */}
                            <div className="flex items-center justify-between bg-gray-800/50 px-4 py-3 rounded-lg border border-gray-700 print:bg-blue-50 print:border print:border-blue-200 print:p-2 print:block print:text-center print:shadow-sm">
                                <span className="text-gray-400 text-sm font-medium print:text-blue-800 print:text-xs print:block print:mb-1 print:font-bold">المسؤول</span>
                                <span className="font-bold text-white text-lg print:text-blue-950 print:text-xs block">
                                    {engineer ? (
                                        <>
                                            <span className="block">{engineer.name}</span>
                                            {engineer.englishName && <span className="block text-gray-300 text-sm font-normal mt-0.5 print:text-[10px] print:text-blue-900">{engineer.englishName}</span>}
                                        </>
                                    ) : 'بدون'}
                                </span>
                            </div>
                            {/* Driver Block - Orange Theme */}
                            <div className="flex items-center justify-between bg-gray-800/50 px-4 py-3 rounded-lg border border-gray-700 print:bg-orange-50 print:border print:border-orange-200 print:p-2 print:block print:text-center print:shadow-sm">
                                <span className="text-gray-400 text-sm font-medium print:text-orange-800 print:text-xs print:block print:mb-1 print:font-bold">السائق</span>
                                <span className="font-bold text-white text-base print:text-orange-950 print:text-xs block">
                                    {driver ? (
                                        <>
                                            <span className="block">{driver.name}</span>
                                            {driver.englishName && <span className="block text-gray-300 text-sm font-normal mt-0.5 print:text-[10px] print:text-orange-900">{driver.englishName}</span>}
                                            {(driver.driverCarType || driver.driverCarPlate) && <span className="text-gray-400 text-xs mt-1 print:text-orange-800 print:text-[10px] block">{driver.driverCarType ? `(${driver.driverCarType})` : ''} {driver.driverCarPlate ? `[${driver.driverCarPlate}]` : ''}</span>}
                                        </>
                                    ) : 'بدون'}
                                </span>
                            </div>
                            {/* Worker Count Block - Green Theme */}
                            <div className="flex items-center justify-between bg-gray-800/50 px-4 py-3 rounded-lg border border-gray-700 print:bg-green-50 print:border print:border-green-200 print:p-2 print:block print:text-center print:shadow-sm">
                                <span className="text-gray-400 text-sm font-medium print:text-green-800 print:text-xs print:block print:mb-1 print:font-bold">عدد العمال</span>
                                <span className="font-bold text-white text-xl print:text-green-950 print:text-lg">{workers.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 print:p-2 print:flex-1">
                        <div className="mb-6 print:mb-2 break-inside-avoid">
                            <h3 className="text-base font-bold text-gray-800 mb-3 print:text-black border-b pb-2 print:text-xs print:mb-1">توزيع المهن:</h3>
                            <div className="flex flex-wrap gap-2 print:gap-1">
                                {state.skills.filter(sk => (counts[sk.name] || 0) > 0).map(sk => (
                                <span key={sk.id} className={`text-sm font-bold px-3 py-1.5 rounded-lg border flex items-center gap-2 print:border-gray-300 print:bg-white print:text-black print:text-[10px] print:px-1.5 print:py-0.5 ${sk.color}`}>
                                    <span className="w-2.5 h-2.5 rounded-full bg-current opacity-75 print:border print:border-black print:w-1.5 print:h-1.5"></span>
                                    {sk.label}: {counts[sk.name]}
                                </span>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-hidden print:overflow-visible rounded-lg border border-gray-200 print:border-gray-300">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-gray-100 print:bg-gray-100">
                                    <tr>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الكود</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الاسم</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">المهنة</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">رقم الإقامة</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الجوال</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">انتهاء الإقامة</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {workers.map((w, wIdx) => {
                                    const iqDays = daysRemaining(w.iqamaExpiry);
                                    const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                    return (
                                    <tr key={w.id} className={`hover:bg-blue-50/50 print:hover:bg-transparent break-inside-avoid ${wIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50/50'}`}>
                                        <td className="px-5 py-4 font-mono text-gray-500 text-sm font-bold print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">{w.code || '-'}</td>
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">
                                            <Link href={`/workers?search=${encodeURIComponent(w.name)}`} className="hover:text-blue-600 hover:underline block">
                                                {w.name}
                                            </Link>
                                            {w.englishName && <span className="block text-black text-sm font-normal mt-0.5 print:text-[9px] print:text-black">{w.englishName}</span>}
                                        </td>
                                        <td className="px-5 py-4 print:py-1 print:px-1">
                                            <span className="bg-white border border-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm font-bold shadow-sm print:shadow-none print:border-gray-300 print:text-[10px] print:px-1 print:py-0 print:whitespace-nowrap">{skLabel}</span>
                                        </td>
                                        <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1 print:px-1 print:text-[10px]">{w.iqamaNumber}</td>
                                        <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1 print:px-1 print:text-[10px]" dir="ltr">{w.phone}</td>
                                        <td className="px-5 py-4 print:py-1 print:px-1">
                                            <span className={`px-3 py-1 rounded-md text-sm font-bold border ${statusClasses(iqDays)} print:border-gray-300 print:bg-white print:text-black print:text-[10px] print:px-1 print:py-0 print:whitespace-nowrap`}>
                                                {labelFor(iqDays, !!w.iqamaExpiry)} <span className="font-mono font-normal text-xs ml-1 print:text-[9px]">({w.iqamaExpiry})</span>
                                            </span>
                                        </td>
                                    </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
                ))}

                {/* Waiting List Removed */}

                {/* Rest List Section */}
                {realLeaveData.length > 0 && (
                <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:overflow-visible print:shadow-none print:border-0 print:m-0 print:p-0 print:w-full print:h-auto print:block" style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}>
                    <div className="bg-gray-600 text-white p-6 flex items-center justify-between gap-6 print:bg-white print:text-black print:border-b-2 print:border-gray-600 print:p-4 print:mb-2">
                        <div className="flex items-center gap-4">
                             <h2 className="text-2xl font-bold text-white print:text-black print:text-xl">قائمة الاستراحة</h2>
                             <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-700 text-gray-100 border border-gray-500 print:text-gray-800 print:bg-white print:border-gray-800">
                                العدد: {realLeaveData.length}
                             </span>
                        </div>
                    </div>
                    <div className="p-6 print:p-2">
                         <div className="overflow-hidden print:overflow-visible rounded-lg border border-gray-200 print:border-gray-300">
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-gray-100 print:bg-gray-100">
                                    <tr>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الكود</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الاسم</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">المهنة</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">نوع الإجازة</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">تاريخ العودة</th>
                                        <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الجوال</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {realLeaveData.map((w, wIdx) => {
                                    const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                    const currentLeave = w.leaveHistory?.find(l => {
                                        const today = new Date().toISOString().slice(0, 10);
                                        return l.startDate <= today && l.endDate >= today;
                                    });
                                    
                                    return (
                                    <tr key={w.id} className={`hover:bg-gray-50/50 print:hover:bg-transparent ${wIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50/50'}`}>
                                        <td className="px-5 py-4 font-mono text-gray-500 text-sm font-bold print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">{w.code || '-'}</td>
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">
                                            <Link href={`/workers?search=${encodeURIComponent(w.name)}`} className="hover:text-gray-600 hover:underline block">
                                                {w.name}
                                            </Link>
                                            {w.englishName && <span className="block text-black text-sm font-normal mt-0.5 print:text-[9px] print:text-black">{w.englishName}</span>}
                                        </td>
                                        <td className="px-5 py-4 print:py-1 print:px-1">
                                            <span className="bg-white border border-gray-200 text-gray-800 px-3 py-1 rounded-md text-sm font-bold shadow-sm print:shadow-none print:border-gray-300 print:text-[10px] print:px-1 print:py-0 print:whitespace-nowrap">{skLabel}</span>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-medium text-gray-700 print:py-1 print:px-1 print:text-[10px]">{currentLeave ? currentLeave.type : 'راحة'}</td>
                                        <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1 print:px-1 print:text-[10px]">{currentLeave ? currentLeave.endDate : '-'}</td>
                                        <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1 print:px-1 print:text-[10px]" dir="ltr">{w.phone}</td>
                                    </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                         </div>
                    </div>
                </section>
                )}
                {data.length === 0 && (
                    <div className="text-center py-20 text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-300">
                        <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-xl font-bold text-gray-600">لا يوجد مشاريع موزعة حالياً</p>
                    </div>
                )}
            </div>
        ) : view === 'drivers' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50 print:bg-white print:border-b-2 print:border-indigo-800">
                    <h2 className="text-xl font-bold text-indigo-700 flex items-center gap-2 print:text-black">
                        <Truck className="w-6 h-6" />
                        تقرير السائقين والمواقع
                    </h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold border border-indigo-200 print:border-indigo-800 print:bg-white print:text-indigo-800">
                        العدد: {state.workers.filter(w => w.skill === 'Driver' || w.skill === 'سائق').length}
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">اسم السائق</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">رقم الجوال</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">بيانات السيارة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 text-center border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs print:text-center">عدد المواقع</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 text-center border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs print:text-center">إجمالي المنقولين</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">تفاصيل المواقع</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {state.workers.filter(w => w.skill === 'Driver' || w.skill === 'سائق').map((d, idx) => {
                                const assignedSites = state.sites.filter(s => s.assignedDrivers?.some(ad => ad.driverId === d.id) || s.driverId === d.id);
                                let totalTransported = 0;
                                const sitesDetails = assignedSites.map(s => {
                                    const ad = s.assignedDrivers?.find(x => x.driverId === d.id);
                                    const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
                                    totalTransported += Number(count);
                                    return { name: s.name, count };
                                });

                                return (
                                    <tr key={d.id} className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50/50'}`}>
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{d.name}</td>
                                        <td className="px-5 py-4 font-mono text-gray-700 text-base font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal" dir="ltr">{d.phone}</td>
                                        <td className="px-5 py-4 text-sm text-gray-600 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                            <div>{d.driverCarType}</div>
                                            <div className="font-mono text-xs">{d.driverCarPlate}</div>
                                            {d.driverCapacity ? <div className="text-xs text-gray-400">سعة: {d.driverCapacity}</div> : null}
                                        </td>
                                        <td className="px-5 py-4 font-bold text-center text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{assignedSites.length}</td>
                                        <td className="px-5 py-4 font-bold text-center text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{totalTransported}</td>
                                        <td className="px-5 py-4 text-sm text-gray-700 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                            <div className="flex flex-col gap-1">
                                                {sitesDetails.map((site, i) => (
                                                    <div key={i} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded">
                                                        <span>{site.name}</span>
                                                        <span className="font-bold bg-white px-1 rounded border text-xs">{site.count}</span>
                                                    </div>
                                                ))}
                                                {sitesDetails.length === 0 && <span className="text-gray-400 italic">لا يوجد مواقع</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold print:bg-white print:table-footer-group">
                            {(() => {
                                const drivers = state.workers.filter(w => w.skill === 'Driver' || w.skill === 'سائق');
                                let grandTotalSites = 0;
                                let grandTotalTransported = 0;
                                drivers.forEach(d => {
                                    const assignedSites = state.sites.filter(s => s.assignedDrivers?.some(ad => ad.driverId === d.id) || s.driverId === d.id);
                                    grandTotalSites += assignedSites.length;
                                    assignedSites.forEach(s => {
                                        const ad = s.assignedDrivers?.find(x => x.driverId === d.id);
                                        const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
                                        grandTotalTransported += Number(count);
                                    });
                                });
                                return (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-4 text-left text-gray-800 font-black border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm">الإجمالي الكلي:</td>
                                        <td className="px-5 py-4 text-center text-indigo-800 font-black text-xl border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{grandTotalSites}</td>
                                        <td className="px-5 py-4 text-center text-indigo-800 font-black text-xl border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{grandTotalTransported}</td>
                                        <td className="px-5 py-4 border-t-2 border-gray-400 print:border-t-[3px] print:border-black"></td>
                                    </tr>
                                );
                            })()}
                        </tfoot>
                    </table>
                </div>
            </div>
        ) : view === 'absence' ? (
            <div className="space-y-6">
                {/* Absence Stats Dashboard */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:p-4 print:border-gray-800 break-inside-avoid">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-rose-50 rounded-2xl text-rose-600 print:bg-white print:border print:border-rose-200">
                                <UserX className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 print:text-black mb-1">تقرير الغياب</h2>
                                <p className="text-gray-500 print:text-gray-700 text-sm font-medium">
                                    {showHistory ? 'سجل الغياب التاريخي' : 'قائمة العمال الغائبين حالياً'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-8 print:gap-12">
                            <div className="text-center">
                                <p className="text-sm text-gray-400 font-bold mb-1 print:text-gray-600">التاريخ</p>
                                <p className="text-xl font-bold text-gray-900 font-mono print:text-black">{toDMY(selectedDate)}</p>
                            </div>
                            <div className="w-px h-12 bg-gray-200 print:bg-gray-400"></div>
                            <div className="text-center">
                                <p className="text-sm text-gray-400 font-bold mb-1 print:text-gray-600">عدد الغياب</p>
                                <p className="text-3xl font-black text-rose-600 print:text-black">
                                    {showHistory ? filteredHistoryRows.length : state.workers.filter(w => w.availabilityStatus === 'absent').length}
                                </p>
                                {showHistory && <p className="text-xs text-gray-400 mt-1">يوم غياب</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Controls */}
                <div className="flex flex-wrap items-center gap-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 print:hidden">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                checked={showHistory} 
                                onChange={(e) => setShowHistory(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                        </div>
                        <span className="font-bold text-gray-700">عرض سجل الغياب (بحث بالتاريخ)</span>
                    </label>

                    <div className={`flex items-center gap-3 animate-fade-in bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 transition-opacity ${showHistory ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-medium text-sm">بحث:</span>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    value={absenceSearch}
                                    onChange={(e) => setAbsenceSearch(e.target.value)}
                                    placeholder="الاسم، الكود، الإقامة..."
                                    className="border border-gray-300 rounded-lg pr-9 pl-3 py-1.5 text-sm focus:outline-none focus:border-rose-500 bg-white w-48"
                                />
                            </div>
                        </div>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-medium text-sm">من:</span>
                            <input 
                                type="date" 
                                value={searchStart}
                                onChange={(e) => setSearchStart(e.target.value)}
                                disabled={!showHistory}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-rose-500 bg-white disabled:bg-gray-100"
                            />
                        </div>
                        <div className="w-4 h-px bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-medium text-sm">إلى:</span>
                            <input 
                                type="date" 
                                value={searchEnd}
                                onChange={(e) => setSearchEnd(e.target.value)}
                                disabled={!showHistory}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-rose-500 bg-white disabled:bg-gray-100"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs w-16 text-center">#</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">الكود</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">اسم العامل</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">المهنة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">رقم الجوال</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">تاريخ الغياب</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">سبب الغياب</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">سُجل بواسطة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">المشروع المرتبط</th>
                                {user?.role === 'admin' && <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 last:rounded-tl-lg print:hidden">إجراءات</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {showHistory ? (
                                filteredHistoryRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-8 text-gray-500 italic">لا توجد سجلات غياب في الفترة المحددة</td>
                                    </tr>
                                ) : (
                                    filteredHistoryRows.map(({ w, h }, idx) => {
                                        const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                        const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
                                        
                                        return (
                                            <tr key={`${w.id}-${h.date}-${idx}`} className="hover:bg-rose-50/20 transition-colors">
                                                <td className="px-5 py-4 font-mono font-bold text-gray-500 text-sm text-center border-l border-gray-100 print:border-gray-300 print:py-1.5 print:px-2 print:text-xs">{idx + 1}</td>
                                            <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{w.code || '-'}</td>
                                                <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{w.name}</td>
                                                <td className="px-5 py-4 text-sm text-gray-700 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{skLabel}</span>
                                                </td>
                                                <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal" dir="ltr">{w.phone}</td>
                                                <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal" dir="ltr">{new Date(h.date).toLocaleDateString('en-GB')}</td>
                                                <td className="px-5 py-4 text-sm text-gray-600 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{h.reason || '-'}</td>
                                                <td className="px-5 py-4 text-sm text-gray-900 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{h.recordedBy || '-'}</td>
                                                <td className="px-5 py-4 text-sm font-bold text-gray-900 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{assignedSite ? assignedSite.name : 'غير موزع'}</td>
                                                {user?.role === 'admin' && (
                                                    <td className="px-5 py-4 text-sm print:hidden">
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingAbsence({
                                                                        workerId: w.id,
                                                                        oldDate: h.date,
                                                                        newDate: h.date,
                                                                        reason: h.reason || ''
                                                                    });
                                                                }}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
                                                                title="تعديل"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteHistoryItem(w.id, h.date)}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200"
                                                                title="حذف"
                                                            >
                                                                <UserX className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )
                            ) : (
                                state.workers.filter(w => {
                                    const isAbsent = w.availabilityStatus === 'absent';
                                    const isHighlighted = !highlightId || w.id === highlightId;
                                    
                                    let matchesSearch = true;
                                    if (absenceSearch) {
                                        const query = absenceSearch.toLowerCase();
                                        matchesSearch = (w.name && w.name.toLowerCase().includes(query)) ||
                                                        (w.code && w.code.toLowerCase().includes(query)) ||
                                                        (w.iqamaNumber && w.iqamaNumber.includes(query));
                                    }

                                    return isAbsent && isHighlighted && matchesSearch;
                                }).map((w, idx) => {
                                    const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                    const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
                                    const absenceReason = w.absenceHistory && w.absenceHistory.length > 0 ? w.absenceHistory[w.absenceHistory.length - 1].reason || '-' : '-';
                                    const lastHistory = w.absenceHistory && w.absenceHistory.length > 0 ? w.absenceHistory[w.absenceHistory.length - 1] : null;
                                    const absenceDate = lastHistory ? new Date(lastHistory.date).toLocaleDateString('en-GB') : (w.absentSince ? new Date(w.absentSince).toLocaleDateString('en-GB') : '-');

                                    return (
                                        <tr key={w.id} className={`hover:bg-rose-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50/50'}`}>
                                            <td className="px-5 py-4 font-mono font-bold text-gray-500 text-sm text-center border-l border-gray-100 print:border-gray-300 print:py-1.5 print:px-2 print:text-xs">{idx + 1}</td>
                                            <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{w.code || '-'}</td>
                                            <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{w.name}</td>
                                            <td className="px-5 py-4 text-sm text-gray-700 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{skLabel}</span>
                                            </td>
                                            <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal" dir="ltr">{w.phone}</td>
                                            <td className="px-5 py-4 font-mono text-gray-700 text-sm font-medium print:py-1.5 print:px-2 print:text-xs print:whitespace-normal" dir="ltr">{absenceDate}</td>
                                            <td className="px-5 py-4 text-sm text-gray-600 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{absenceReason}</td>
                                            <td className="px-5 py-4 text-sm text-gray-900 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{lastHistory?.recordedBy || '-'}</td>
                                            <td className="px-5 py-4 text-sm font-bold text-gray-900 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{assignedSite ? assignedSite.name : 'غير موزع'}</td>
                                            {user?.role === 'admin' && (
                                                <td className="px-5 py-4 text-sm print:hidden">
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                const historyDate = w.absenceHistory && w.absenceHistory.length > 0 ? w.absenceHistory[w.absenceHistory.length - 1].date : '';
                                                                const defaultDate = w.absentSince ? w.absentSince.split('T')[0] : '';
                                                                const dateToUse = historyDate || defaultDate;
                                                                
                                                                setEditingAbsence({
                                                                    workerId: w.id,
                                                                    oldDate: dateToUse,
                                                                    newDate: dateToUse,
                                                                    reason: w.absenceHistory && w.absenceHistory.length > 0 ? w.absenceHistory[w.absenceHistory.length - 1].reason || '' : ''
                                                                });
                                                            }}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
                                                            title="تعديل"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteAbsence(w.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200"
                                                            title="حذف"
                                                        >
                                                            <UserX className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                            {!showHistory && state.workers.filter(w => w.availabilityStatus === 'absent').length === 0 && (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-gray-500 italic">لا يوجد غياب مسجل حالياً</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        ) : view === 'salaries' ? (
            <SalaryReport workers={state.workers} />
        ) : view === 'all' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                    }
                `}} />
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-blue-50 print:bg-white print:border-b-2 print:border-blue-800">
                    <h2 className="text-xl font-bold text-blue-700 flex items-center gap-2 print:text-black">
                        <Users className="w-6 h-6" />
                        قاعدة بيانات العمال الشاملة
                    </h2>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold border border-blue-200 print:border-blue-800 print:bg-white print:text-blue-800">
                        العدد: {state.workers.length}
                    </span>
                </div>
                
                {/* Creative Stats Dashboard */}
                {state.workers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50/50 print:hidden border-b border-gray-100">
                    {/* Total Workers */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full transition-transform duration-500 group-hover:scale-125"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">إجمالي القوة العاملة</p>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{state.workers.length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center transform transition-transform group-hover:rotate-6">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <span className="flex w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            <span className="text-xs font-medium text-blue-600">قاعدة البيانات الكاملة</span>
                        </div>
                    </div>

                    {/* On Site (Active) */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full transition-transform duration-500 group-hover:scale-125"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">على رأس العمل</p>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{state.workers.filter(w => w.assignedSiteId && w.availabilityStatus !== 'absent').length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center transform transition-transform group-hover:rotate-6">
                                <UserCheck className="w-6 h-6" />
                            </div>
                        </div>
                         <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                                style={{ width: `${state.workers.length ? (state.workers.filter(w => w.assignedSiteId && w.availabilityStatus !== 'absent').length / state.workers.length) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-400 text-left font-mono">
                            {state.workers.length ? Math.round((state.workers.filter(w => w.assignedSiteId && w.availabilityStatus !== 'absent').length / state.workers.length) * 100) : 0}% نسبة التشغيل
                        </div>
                    </div>

                    {/* Available */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full transition-transform duration-500 group-hover:scale-125"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">جاهز للعمل</p>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{state.workers.filter(w => !w.assignedSiteId && w.availabilityStatus !== 'absent').length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl shadow-lg shadow-amber-200 flex items-center justify-center transform transition-transform group-hover:rotate-6">
                                <Coffee className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                             <div className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">انتظار التوزيع</div>
                        </div>
                    </div>

                    {/* Absent */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-50 rounded-full transition-transform duration-500 group-hover:scale-125"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">غياب / إجازة</p>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{state.workers.filter(w => w.availabilityStatus === 'absent').length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-xl shadow-lg shadow-rose-200 flex items-center justify-center transform transition-transform group-hover:rotate-6">
                                <UserX className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-rose-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            غير متاح حالياً
                        </div>
                    </div>
                </div>
                )}
                {state.workers.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <p>لا يوجد عمال في النظام</p>
                    </div>
                ) : (
                    <>
                            <div className="overflow-x-auto print:hidden max-h-[800px] overflow-y-auto relative">
                                <table className="w-full text-right border-separate border-spacing-0 text-sm">
                                    <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0 z-20 shadow-sm print:static">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap sticky right-0 z-30 bg-gray-100 shadow-[ -1px_0_4px_rgba(0,0,0,0.1)] print:static print:shadow-none">الموظف</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">الاسم (EN)</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">الجوال</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">المهنة</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">الموقع الحالي</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">الجنسية</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">الديانة</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">تاريخ التعيين</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">مدة العمل</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">رقم الإقامة</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">حالة الإقامة</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">انتهاء الإقامة</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">حالة التأمين</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">انتهاء التأمين</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">اسم البنك</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">رقم الحساب</th>
                                            <th className="px-4 py-3 border-b border-gray-300 whitespace-nowrap">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {state.workers.map((w, idx) => {
                                            const iqDays = daysRemaining(w.iqamaExpiry);
                                            const insDays = daysRemaining(w.insuranceExpiry);
                                            const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                            const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
                                            
                                            const getStatusColor = (days: number | undefined) => {
                                                if (days === undefined) return 'text-gray-600';
                                                if (days < 0) return 'text-red-600 font-bold';
                                                if (days < 30) return 'text-orange-600 font-bold';
                                                return 'text-green-600 font-bold';
                                            };

                                            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                                            return (
                                                <tr key={w.id} className={`hover:bg-blue-50/50 transition-colors ${rowBg} print:bg-transparent`}>
                                                    <td className={`px-4 py-2.5 border-b border-gray-200 whitespace-nowrap sticky right-0 z-10 ${rowBg} shadow-[ -1px_0_4px_rgba(0,0,0,0.05)] print:static print:shadow-none font-bold text-gray-900 print:px-1 print:py-0.5`}>
                                                        {idx + 1}
                                                    </td>
                                                    <td className={`px-4 py-2.5 border-b border-gray-200 whitespace-nowrap sticky right-[3rem] z-10 ${rowBg} print:static font-bold text-gray-900 print:px-1 print:py-0.5`}>
                                                        <Link href={`/workers?search=${encodeURIComponent(w.name)}`} className="hover:text-blue-600 hover:underline">
                                                            {w.name}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-black font-bold font-mono text-xs print:px-1 print:py-0.5" dir="ltr">{w.englishName || '-'}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5" dir="ltr">{w.phone}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 print:px-1 print:py-0.5">{skLabel}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 print:px-1 print:py-0.5">
                                                        {assignedSite ? (
                                                            <span className="text-green-700 font-medium">{assignedSite.name}</span>
                                                        ) : (
                                                            <span className="text-red-700 font-medium">غير موزع (غياب)</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 print:px-1 print:py-0.5">{w.nationality || '-'}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 print:px-1 print:py-0.5">{w.religion || '-'}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 font-mono print:px-1 print:py-0.5">{w.hireDate || '-'}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-blue-700 font-bold font-mono print:px-1 print:py-0.5">
                                                        {(() => { const d = calculateDaysWorked(w.hireDate); return d === undefined ? '-' : d; })()}
                                                    </td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5">{w.iqamaNumber}</td>
                                                    <td className={`px-4 py-2.5 border-b border-gray-200 whitespace-nowrap ${getStatusColor(iqDays)} print:px-1 print:py-0.5`}>
                                                        {labelFor(iqDays, !!w.iqamaExpiry)}
                                                    </td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5" dir="ltr">{w.iqamaExpiry}</td>
                                                    <td className={`px-4 py-2.5 border-b border-gray-200 whitespace-nowrap ${getStatusColor(insDays)} print:px-1 print:py-0.5`}>
                                                        {labelFor(insDays, !!w.insuranceExpiry)}
                                                    </td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5" dir="ltr">{w.insuranceExpiry}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 print:px-1 print:py-0.5">{w.bankName || '-'}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5" dir="ltr">{w.bankAccount || '-'}</td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap text-gray-700 font-medium print:px-1 print:py-0.5">
                                                        {assignedSite ? 'موزع' : (w.availabilityStatus === 'absent' ? 'غياب' : 'استراحة')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Print View Layout (Cards) */}
                            <div className="hidden print:grid grid-cols-2 gap-4 p-1">
                                {state.workers.map((w, idx) => {
                                    const iqDays = daysRemaining(w.iqamaExpiry);
                                    const insDays = daysRemaining(w.insuranceExpiry);
                                    const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                    const assignedSite = state.sites.find(s => s.id === w.assignedSiteId);
                                    
                                    const getStatusColor = (days: number | undefined) => {
                                        if (days === undefined) return 'text-gray-600 font-bold';
                                        if (days < 0) return 'text-red-600 font-bold';
                                        if (days < 30) return 'text-orange-600 font-bold';
                                        return 'text-green-600 font-bold';
                                    };

                                    const daysWorked = calculateDaysWorked(w.hireDate);

                                    return (
                                        <div key={w.id} className="border border-gray-300 rounded-lg p-3 bg-white break-inside-avoid shadow-sm text-[10px]">
                                            <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-100">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-black">{w.code || '-'}</span>
                                                        <span className="font-bold text-sm text-gray-900">{idx + 1}. {w.name}</span>
                                                    </div>
                                                    <div className="text-black font-bold font-mono mt-0.5">{w.englishName || '-'}</div>
                                                </div>
                                                <div className="text-left">
                                                    <div className={'font-bold ' + (assignedSite ? 'text-green-700' : (w.availabilityStatus === 'absent' ? 'text-red-700' : 'text-orange-700'))}>
                                                        {assignedSite ? assignedSite.name : (w.availabilityStatus === 'absent' ? 'غياب' : 'استراحة')}
                                                    </div>
                                                    <div className="text-gray-500 mt-0.5">{skLabel}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">الجوال:</span>
                                                    <span className="font-mono" dir="ltr">{w.phone}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">الجنسية:</span>
                                                    <span>{w.nationality || '-'}</span>
                                                </div>
                                                
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">تاريخ التعيين:</span>
                                                    <span className="font-mono">{w.hireDate || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">مدة العمل:</span>
                                                    <span className="text-blue-700 font-bold font-mono">{daysWorked === undefined ? '-' : daysWorked}</span>
                                                </div>

                                                <div className="col-span-2 border-t border-gray-100 my-1"></div>

                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">رقم الإقامة:</span>
                                                    <span className="font-mono">{w.iqamaNumber}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">انتهاء الإقامة:</span>
                                                    <span className={'font-mono ' + getStatusColor(iqDays)}>{w.iqamaExpiry}</span>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">حالة التأمين:</span>
                                                    <span className={getStatusColor(insDays)}>{labelFor(insDays, !!w.insuranceExpiry)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">انتهاء التأمين:</span>
                                                    <span className="font-mono">{w.insuranceExpiry}</span>
                                                </div>

                                                <div className="col-span-2 border-t border-gray-100 my-1"></div>

                                                <div className="col-span-2 flex justify-between">
                                                    <span className="text-gray-500">البنك:</span>
                                                    <span>{w.bankName || '-'} <span className="font-mono mx-1">{w.bankAccount || ''}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                    </>
                )}
            </div>
        ) : null}

        {/* Edit Absence Modal */}
        {editingAbsence && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-lg text-gray-800">تعديل بيانات الغياب</h3>
                        <button onClick={() => setEditingAbsence(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                            <UserX className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الغياب</label>
                            <input
                                type="date"
                                value={editingAbsence.newDate}
                                onChange={(e) => setEditingAbsence({ ...editingAbsence, newDate: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">سبب الغياب</label>
                            <input
                                type="text"
                                value={editingAbsence.reason}
                                onChange={(e) => setEditingAbsence({ ...editingAbsence, reason: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                placeholder="سبب الغياب..."
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                        <button onClick={() => setEditingAbsence(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">إلغاء</button>
                        <button onClick={handleSaveAbsence} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium shadow-sm transition-colors">حفظ التغييرات</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 pt-24 flex justify-center"><div className="text-xl font-medium text-gray-400">جاري التحميل...</div></div>}>
      <ReportsContent />
    </Suspense>
  );
}
