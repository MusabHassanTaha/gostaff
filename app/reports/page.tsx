'use client';
import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { Vehicle, ViolationRecord } from '@/types';
import { daysRemaining, statusClasses, labelFor, calculateDaysWorked } from '@/lib/date';
import { utils, writeFile } from 'xlsx';
import { Search, Calendar, Download, Printer, Users, UserCheck, UserX, FileText, LayoutDashboard, Truck, Car, AlertTriangle, Coffee, Pencil, Activity, ShieldCheck, Wrench, X, Filter, User } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';

function ReportsContent() {
  const { user } = useAuth();
  const { state: globalState, setState, cancelAbsence, updateAbsence, deleteAbsence } = useAppState();
  
  const isEngineer = user?.role === 'engineer';
   const isAccountant = user?.role === 'accountant';

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
  const initialView = (searchParams.get('view') as any) || 'projects';
  const [view, setView] = useState<'projects' | 'leave' | 'all' | 'projects_summary' | 'drivers' | 'vehicles' | 'vehicle_movement' | 'violations' | 'maintenance' | 'absence' | 'salaries' | 'iqama_status' | 'insurance_status'>(initialView);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Violation Search State (Transferred from Vehicles)
  const [violationSearchQuery, setViolationSearchQuery] = useState('');
  const [violationSearchDriver, setViolationSearchDriver] = useState('');
  const [violationSearchVehicle, setViolationSearchVehicle] = useState('');
  const [violationSearchStartDate, setViolationSearchStartDate] = useState('');
  const [violationSearchEndDate, setViolationSearchEndDate] = useState('');

  // Project Report Date Filter
  const [projectSearchStartDate, setProjectSearchStartDate] = useState('');
  const [projectSearchEndDate, setProjectSearchEndDate] = useState('');

  // Vehicle Movement Date Filter
  const [vehicleMovementStartDate, setVehicleMovementStartDate] = useState('');
  const [vehicleMovementEndDate, setVehicleMovementEndDate] = useState('');

  // Driver Report Date Filter
  const [driverSearchStartDate, setDriverSearchStartDate] = useState('');
  const [driverSearchEndDate, setDriverSearchEndDate] = useState('');

  // Vehicle Report Date Filter
  const [vehicleSearchStartDate, setVehicleSearchStartDate] = useState('');
  const [vehicleSearchEndDate, setVehicleSearchEndDate] = useState('');

  // Worker Search State
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');

  // Server-side Report Data
  const [reportData, setReportData] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);



  const violationSearchResults = useMemo(() => {
    const query = violationSearchQuery.toLowerCase();
    const results: { vehicle: any; violation: any }[] = [];

    // Use server data if available
    const sourceVehicles = (view === 'violations' && reportData?.vehicles) ? reportData.vehicles : (state.vehicles || []);

    sourceVehicles.forEach((vehicle: any) => {
      // If vehicle filter is active and doesn't match, skip this vehicle entirely
      if (violationSearchVehicle && vehicle.id !== violationSearchVehicle) return;

      vehicle.violations.forEach((violation: any) => {
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
  }, [state.vehicles, violationSearchQuery, violationSearchDriver, violationSearchVehicle, violationSearchStartDate, violationSearchEndDate, reportData, view]);


  // Date Filters for Maintenance Report
  const [maintenanceStartDate, setMaintenanceStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [maintenanceEndDate, setMaintenanceEndDate] = useState(() => new Date().toISOString().slice(0, 10));

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

  const filteredWorkers = useMemo(() => {
    // Use server data if available and relevant to current view
    const source = (reportData?.workers && (view === 'projects' || view === 'leave' || view === 'drivers' || view === 'violations')) ? reportData.workers : state.workers;

    const query = workerSearchQuery.toLowerCase();
    if (!query) return source;
    
    return source.filter((w: any) => 
      (w.name && w.name.toLowerCase().includes(query)) ||
      (w.englishName && w.englishName.toLowerCase().includes(query)) ||
      (w.nationality && w.nationality.toLowerCase().includes(query)) ||
      (w.code && w.code.toLowerCase().includes(query)) ||
      (w.iqamaNumber && w.iqamaNumber.includes(query)) ||
      (w.phone && w.phone.includes(query))
    );
  }, [state.workers, workerSearchQuery, reportData, view]);

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

  useEffect(() => {
    if (isAccountant && view !== 'absence' && view !== 'violations') {
      setView('absence');
    }
  }, [isAccountant, view]);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [iqamaStatusFilter, setIqamaStatusFilter] = useState<'all' | 'valid' | 'soon' | 'expired'>('all');
  const [insuranceStatusFilter, setInsuranceStatusFilter] = useState<'all' | 'valid' | 'soon' | 'expired'>('all');
  const iqamaFiltered = useMemo(() => {
    const arr = state.workers.filter(w => w.status !== 'pending' && w.iqamaExpiry);
    if (iqamaStatusFilter === 'all') return arr;
    return arr.filter(w => {
      const d = daysRemaining(w.iqamaExpiry);
      const cls = d === 0 ? 'expired' : (d !== undefined && d <= 10 ? 'soon' : (d !== undefined ? 'valid' : 'none'));
      return cls === iqamaStatusFilter;
    });
  }, [state.workers, iqamaStatusFilter]);

  const filteredDrivers = useMemo(() => {
    // If server data available for drivers, use it
    if (view === 'drivers' && reportData?.workers) {
        return reportData.workers;
    }

    return state.workers
        .filter(w => w.skill === 'Driver' || w.skill === 'سائق')
        .filter(d => {
            if (!driverSearchStartDate && !driverSearchEndDate) return true;
            
            const vehicle = state.vehicles?.find(v => v.plateNumber === d.driverCarPlate);
            if (!vehicle) return false;

            const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
            const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
            if (driverSearchEndDate) end.setHours(23, 59, 59, 999);

            const hasMaintenance = vehicle.maintenanceHistory?.some(m => {
                const mDate = new Date(m.date);
                return mDate >= start && mDate <= end;
            });

            const hasViolations = vehicle.violations?.some(v => {
                const vDate = new Date(v.date);
                return vDate >= start && vDate <= end;
            });

            return hasMaintenance || hasViolations;
        });
  }, [state.workers, state.vehicles, driverSearchStartDate, driverSearchEndDate, reportData, view]);

  const insuranceFiltered = useMemo(() => {
    const arr = state.workers.filter(w => w.status !== 'pending' && w.insuranceExpiry);
    if (insuranceStatusFilter === 'all') return arr;
    return arr.filter(w => {
      const d = daysRemaining(w.insuranceExpiry);
      const cls = d === 0 ? 'expired' : (d !== undefined && d <= 10 ? 'soon' : (d !== undefined ? 'valid' : 'none'));
      return cls === insuranceStatusFilter;
    });
  }, [state.workers, insuranceStatusFilter]);

  // Violations Report State removed


  const [editingAbsence, setEditingAbsence] = useState<{ workerId: string; oldDate: string; newDate: string; reason: string } | null>(null);

  const handleDeleteAbsence = (workerId: string) => {
      if (isAccountant) return;
      if (confirm('هل أنت متأكد من حذف هذا الغياب؟ سيتم إعادة العامل إلى حالته السابقة.')) {
          cancelAbsence(workerId);
      }
  };

  const handleDeleteHistoryItem = (workerId: string, date: string) => {
      if (isAccountant) return;
      if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
          deleteAbsence(workerId, date);
      }
  };

  const handleSaveAbsence = () => {
      if (isAccountant) return;
      if (!editingAbsence) return;
      updateAbsence(editingAbsence.workerId, editingAbsence.oldDate, editingAbsence.newDate, editingAbsence.reason);
      setEditingAbsence(null);
  };

  useEffect(() => {
    const reportName = view === 'projects' ? 'تقرير_توزيع_المشاريع'
      : view === 'leave' ? 'تقرير_الإجازات'
      : view === 'projects_summary' ? 'تقرير_المشاريع_المبسط'
      : view === 'drivers' ? 'تقرير_السائقين'
      : view === 'vehicles' ? 'تقرير_المركبات'
      : view === 'vehicle_movement' ? 'تقرير_حركة_المركبات'
      : view === 'violations' ? 'تقرير_المخالفات_المرورية'
      : view === 'maintenance' ? 'تقرير_الصيانة'
      : view === 'absence' ? 'تقرير_الغياب'
      : view === 'iqama_status' ? 'تقرير_الإقامة'
      : view === 'insurance_status' ? 'تقرير_التأمين'
      : 'قاعدة_بيانات_العمال_الكل';
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
    let activeWorkers = state.workers.filter(w => w.status !== 'pending');
    
    // Base list of valid workers (for engineer/driver lookup independent of date filter)
    const allActiveWorkers = [...activeWorkers];

    // Apply Date Range Filter for Projects View (Filtering by Hire Date)
    // Removed filtering by hireDate as it hides current workers when a date range is selected.
    // The report should show current assignments, and date range should only affect event history (like absence).
    if (view === 'projects' && (projectSearchStartDate || projectSearchEndDate)) {
         // No filtering by hireDate
    }

    return state.sites.map(site => {
      const workers = activeWorkers.filter(w => w.assignedSiteId === site.id);
      const counts: Record<string, number> = {};
      state.skills.forEach(sk => { counts[sk.name] = 0; });
      workers.forEach(w => { counts[w.skill] = (counts[w.skill] || 0) + 1; });
      const driver = allActiveWorkers.find(w => w.id === site.driverId);
      const engineer = allActiveWorkers.find(w => w.id === site.engineerId);
      return { site, workers, counts, driver, engineer };
    });
  }, [state.sites, state.workers, state.skills, view, projectSearchStartDate, projectSearchEndDate]);

  const realLeaveData = useMemo(() => {
    const activeWorkers = state.workers.filter(w => w.status !== 'pending');
    return activeWorkers.filter(w => !w.assignedSiteId && w.availabilityStatus === 'rest');
  }, [state.workers]);

  // Iqama & Insurance Stats (for printing and screen)
  const iqInsStats = useMemo(() => {
    const stats = {
      iqama: { valid: 0, soon: 0, expired: 0, unregistered: 0 },
      insurance: { valid: 0, soon: 0, expired: 0, unregistered: 0 },
      total: 0
    };
    const activeWorkers = filteredWorkers.filter((w: any) => w.status !== 'pending');
    stats.total = activeWorkers.length;
    activeWorkers.forEach((w: any) => {
      // Iqama
      if (!w.iqamaExpiry) {
        stats.iqama.unregistered++;
      } else {
        const d = daysRemaining(w.iqamaExpiry);
        if (d !== undefined && d <= 0) stats.iqama.expired++;
        else if (d !== undefined && d <= 30) stats.iqama.soon++;
        else stats.iqama.valid++;
      }
      // Insurance
      if (!w.insuranceExpiry) {
        stats.insurance.unregistered++;
      } else {
        const d = daysRemaining(w.insuranceExpiry);
        if (d !== undefined && d <= 0) stats.insurance.expired++;
        else if (d !== undefined && d <= 30) stats.insurance.soon++;
        else stats.insurance.valid++;
      }
    });
    return stats;
  }, [filteredWorkers]);

  const stats = useMemo(() => {
    const activeWorkers = filteredWorkers.filter((w: any) => w.status !== 'pending');
    const total = activeWorkers.length;
    const assigned = activeWorkers.filter((w: any) => w.assignedSiteId).length;
    const leave = activeWorkers.filter((w: any) => !w.assignedSiteId && w.availabilityStatus === 'rest').length;
    return { total, assigned, leave };
  }, [filteredWorkers]);

  const projectStats = useMemo(() => {
    const totalProjects = state.sites.length;
    const stoppedProjects = state.sites.filter(s => s.status === 'stopped').length;
    const completedProjects = state.sites.filter(s => s.status === 'completed').length;
    // Active is everything else (undefined/null/active)
    const activeProjects = totalProjects - stoppedProjects - completedProjects;
    
    // Count workers in these projects (only for displayed projects)
    const siteIds = new Set(state.sites.map(s => s.id));
    
    // Apply Date Range Filter to stats if active
    let relevantWorkers = (view === 'projects' && reportData?.workers) ? reportData.workers : state.workers.filter(w => w.status !== 'pending');

    // Date filter removed for projects view as it was incorrectly filtering by hireDate
    // The user wants to see current project status regardless of hire date.
    if (view === 'projects' && !reportData) {
        // No additional filtering needed for projects view
    }

    const workersInProjects = relevantWorkers.filter((w: any) => w.assignedSiteId && siteIds.has(w.assignedSiteId)).length;

    return { totalProjects, activeProjects, stoppedProjects, completedProjects, workersInProjects };
  }, [state.sites, state.workers, view, projectSearchStartDate, projectSearchEndDate, reportData]);

  // waitingData removed


  // History Logic
    const [showHistory, setShowHistory] = useState(true);
    const [absenceSearch, setAbsenceSearch] = useState('');
    const [searchStart, setSearchStart] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    });
    const [searchEnd, setSearchEnd] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => {
        const fetchReport = async () => {
            setIsLoadingReport(true);
            try {
                const params = new URLSearchParams();
                params.set('view', view);
                
                if (view === 'projects') {
                    if (projectSearchStartDate) params.set('startDate', projectSearchStartDate);
                    if (projectSearchEndDate) params.set('endDate', projectSearchEndDate);
                } else if (view === 'leave') {
                    if (searchStart) params.set('startDate', searchStart);
                    if (searchEnd) params.set('endDate', searchEnd);
                } else if (view === 'drivers') {
                    if (driverSearchStartDate) params.set('startDate', driverSearchStartDate);
                    if (driverSearchEndDate) params.set('endDate', driverSearchEndDate);
                } else if (view === 'violations') {
                        if (violationSearchStartDate) params.set('startDate', violationSearchStartDate);
                        if (violationSearchEndDate) params.set('endDate', violationSearchEndDate);
                } else if (view === 'maintenance') {
                        if (maintenanceStartDate) params.set('startDate', maintenanceStartDate);
                        if (maintenanceEndDate) params.set('endDate', maintenanceEndDate);
                } else if (view === 'vehicles') {
                        if (vehicleSearchStartDate) params.set('startDate', vehicleSearchStartDate);
                        if (vehicleSearchEndDate) params.set('endDate', vehicleSearchEndDate);
                }
                
                const res = await fetch(`/api/reports?${params.toString()}`);
                const json = await res.json();
                if (json.success) {
                    setReportData(json.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingReport(false);
            }
        };
        
        const timer = setTimeout(fetchReport, 300);
        return () => clearTimeout(timer);
    }, [view, projectSearchStartDate, projectSearchEndDate, searchStart, searchEnd, driverSearchStartDate, driverSearchEndDate, violationSearchStartDate, violationSearchEndDate, maintenanceStartDate, maintenanceEndDate, vehicleSearchStartDate, vehicleSearchEndDate]);

    const filteredHistoryRows = useMemo(() => {
        if (!showHistory) return [];
        const rows: { w: any, h: any }[] = [];
        
        // Use server data if available
        const sourceWorkers = (view === 'leave' && reportData?.workers) ? reportData.workers : state.workers;
        
        sourceWorkers.forEach((w: any) => {
            if (w.absenceHistory && w.absenceHistory.length > 0) {
                 // Pre-filter by search query to optimize
                 if (absenceSearch) {
                    const query = absenceSearch.toLowerCase();
                    const match = (w.name && w.name.toLowerCase().includes(query)) ||
                                (w.code && w.code.toLowerCase().includes(query)) ||
                                (w.iqamaNumber && w.iqamaNumber.includes(query));
                    if (!match) return;
                }
                w.absenceHistory.forEach((h: any) => {
                    if (h.date >= searchStart && h.date <= searchEnd) {
                        rows.push({ w, h });
                    }
                });
            }
        });
        return rows.sort((a, b) => new Date(b.h.date).getTime() - new Date(a.h.date).getTime());
    }, [state.workers, showHistory, searchStart, searchEnd, absenceSearch, reportData, view]);

  const handleExportExcel = () => {
    const wb = utils.book_new();

    let fileName = `Labour_Report_${selectedDate}.xlsx`;
    if (view === 'projects') {
        const dateSuffix = (projectSearchStartDate || projectSearchEndDate) 
            ? `${projectSearchStartDate || 'البداية'}_الى_${projectSearchEndDate || 'النهاية'}`
            : selectedDate;
        fileName = `تقرير_توزيع_المشاريع_${dateSuffix}.xlsx`;
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
    } else if (view === 'violations') {
        fileName = `تقرير_المخالفات_${violationSearchStartDate || 'الكل'}_الى_${violationSearchEndDate || 'الكل'}.xlsx`;
        const violationsRows = violationSearchResults.map(item => ({
             'رقم اللوحة': item.vehicle.plateNumber,
             'نوع المركبة': item.vehicle.type,
             'تاريخ المخالفة': item.violation.date,
             'وقت المخالفة': item.violation.time,
             'نوع المخالفة': item.violation.type,
             'رقم المخالفة': item.violation.violationNumber || '',
             'المدينة': item.violation.city,
             'القيمة': item.violation.cost,
             'اسم السائق': item.violation.driverName || '',
             'الوصف': item.violation.description || ''
        }));
        
        // Add Summary Row
        if (violationsRows.length > 0) {
            const totalCost = violationsRows.reduce((sum, row) => sum + (Number(row['القيمة']) || 0), 0);
            violationsRows.push({} as any); // Spacer
            violationsRows.push({
                'رقم اللوحة': 'الإجمالي:',
                'القيمة': totalCost
            } as any);
        }

        const wsViolations = utils.json_to_sheet(violationsRows);
        wsViolations['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];
        utils.book_append_sheet(wb, wsViolations, "المخالفات");
        writeFile(wb, fileName);
        return;
    } else if (view === 'maintenance') {
        fileName = `تقرير_الصيانة_${maintenanceStartDate}_الى_${maintenanceEndDate}.xlsx`;
        const maintenanceRows: any[] = [];
        (state.vehicles || []).forEach(v => {
            if (v.maintenanceHistory && v.maintenanceHistory.length > 0) {
                v.maintenanceHistory.forEach(m => {
                    if (m.date >= maintenanceStartDate && m.date <= maintenanceEndDate) {
                        maintenanceRows.push({
                            'رقم اللوحة': v.plateNumber,
                            'نوع المركبة': v.type,
                            'تاريخ الصيانة': m.date,
                            'نوع الصيانة': m.type === 'oil_change' ? 'تغيير زيت' : (m.type === 'repair' ? 'إصلاح' : 'أخرى'),
                            'التكلفة': m.cost,
                            'ملاحظات': m.notes || ''
                        });
                    }
                });
            }
        });

        // Add Summary Row
        if (maintenanceRows.length > 0) {
            const totalCost = maintenanceRows.reduce((sum, row) => sum + (Number(row['التكلفة']) || 0), 0);
            maintenanceRows.push({}); // Spacer
            maintenanceRows.push({
                'رقم اللوحة': 'الإجمالي:',
                'التكلفة': totalCost
            });
        }

        const wsMaintenance = utils.json_to_sheet(maintenanceRows);
        wsMaintenance['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }];
        utils.book_append_sheet(wb, wsMaintenance, "الصيانة");
        writeFile(wb, fileName);
        return;
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
      const drivers = filteredDrivers;
      // Use server data if available, otherwise fall back to state
      const sourceVehicles = (view === 'drivers' && reportData?.vehicles) ? reportData.vehicles : state.vehicles;

      const driverRows: any[] = drivers.map((d: any) => {
         const assignedSites = state.sites.filter(s => s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id);
         let totalTransported = 0;
         const sitesDetails = assignedSites.map(s => {
             const ad = s.assignedDrivers?.find((x: any) => x.driverId === d.id);
             const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
             totalTransported += Number(count);
             return `${s.name} (${count})`;
         }).join('، ');

         // Get Maintenance Details
         const vehicle = sourceVehicles?.find((v: any) => v.plateNumber === d.driverCarPlate);
         const maintenanceInRange = vehicle?.maintenanceHistory?.filter((m: any) => {
            if (!driverSearchStartDate && !driverSearchEndDate) return true;
            const mDate = new Date(m.date);
            const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
            const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
            if (driverSearchEndDate) end.setHours(23, 59, 59, 999);
            return mDate >= start && mDate <= end;
         }) || [];

         const maintenanceStr = maintenanceInRange.map((m: any) => 
            `${m.type === 'oil_change' ? 'تغيير زيت' : (m.type === 'repair' ? 'إصلاح' : 'أخرى')} (${m.date}) - ${m.cost} ريال`
         ).join('\n');

         // Get Violations Details
         const violationsInRange = vehicle?.violations?.filter((v: any) => {
            if (!driverSearchStartDate && !driverSearchEndDate) return true;
            const vDate = new Date(v.date);
            const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
            const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
            if (driverSearchEndDate) end.setHours(23, 59, 59, 999);
            return vDate >= start && vDate <= end;
         }) || [];

         const violationsStr = violationsInRange.map((v: any) => 
            `${v.type} (${v.date}) - ${v.cost || 0} ريال`
         ).join('\n');

         return {
             'اسم السائق': d.englishName ? `${d.name} - ${d.englishName}` : d.name,
             'رقم الجوال': d.phone,
             'نوع السيارة': d.driverCarType || '',
             'رقم اللوحة': d.driverCarPlate || '',
             'السعة': d.driverCapacity || '',
             'عدد المواقع': assignedSites.length,
             'إجمالي المنقولين': totalTransported,
             'تفاصيل المواقع': sitesDetails,
             'صيانة السيارة': maintenanceStr,
             'المخالفات': violationsStr,
             'تكلفة الصيانة': maintenanceInRange.reduce((acc: number, m: any) => acc + (Number(m.cost) || 0), 0),
             'تكلفة المخالفات': violationsInRange.reduce((acc: number, v: any) => acc + (Number(v.cost) || 0), 0)
         };
      });

      // Calculate Totals for Excel
      const totalSites = driverRows.reduce((sum, row) => sum + (Number(row['عدد المواقع']) || 0), 0);
      const totalTransportedAll = driverRows.reduce((sum, row) => sum + (Number(row['إجمالي المنقولين']) || 0), 0);
      
      const totalMaintenanceCost = driverRows.reduce((sum, row) => sum + (Number(row['تكلفة الصيانة']) || 0), 0);
      const totalViolationsCost = driverRows.reduce((sum, row) => sum + (Number(row['تكلفة المخالفات']) || 0), 0);

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
          'تفاصيل المواقع': '',
          'صيانة السيارة': `${totalMaintenanceCost} ريال`,
          'المخالفات': `${totalViolationsCost} ريال`
      });

      // Remove temp columns
      driverRows.forEach(row => {
          delete row['تكلفة الصيانة'];
          delete row['تكلفة المخالفات'];
      });

      const wsDrivers = utils.json_to_sheet(driverRows);
      wsDrivers['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 50 }, { wch: 40 }, { wch: 40 }];
      utils.book_append_sheet(wb, wsDrivers, "السائقين");
      writeFile(wb, fileName);
      return;
    }

    if (view === 'iqama_status') {
      fileName = `تقرير_الإقامة_${selectedDate}.xlsx`;
      const activeWorkers = state.workers.filter(w => w.status !== 'pending' && w.iqamaExpiry);
      const classify = (d?: number) => d === 0 ? 'expired' : (d !== undefined && d <= 10 ? 'soon' : (d !== undefined ? 'valid' : 'none'));
      const rows = activeWorkers.map(w => {
        const iqDays = daysRemaining(w.iqamaExpiry);
        return {
          code: w.code || '',
          nameAr: w.name,
          nameEn: w.englishName || '',
          iqamaNumber: w.iqamaNumber || '',
          iqamaExpiry: w.iqamaExpiry || '',
          iqDays: iqDays === undefined ? '' : iqDays,
          iqStatus: labelFor(iqDays, !!w.iqamaExpiry),
          _iqClass: classify(iqDays),
        };
      });
      const sheets = [
        { name: 'إقامات سارية', filter: (r: any) => r._iqClass === 'valid', cols: [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }], pick: (r: any) => ({ 'الكود': r.code, 'الاسم العربي': r.nameAr, 'الاسم الإنجليزي': r.nameEn, 'رقم الإقامة': r.iqamaNumber, 'انتهاء الإقامة': r.iqamaExpiry, 'الأيام المتبقية': r.iqDays, 'الحالة': r.iqStatus }) },
        { name: 'إقامات قرب الانتهاء', filter: (r: any) => r._iqClass === 'soon', cols: [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }], pick: (r: any) => ({ 'الكود': r.code, 'الاسم العربي': r.nameAr, 'الاسم الإنجليزي': r.nameEn, 'رقم الإقامة': r.iqamaNumber, 'انتهاء الإقامة': r.iqamaExpiry, 'الأيام المتبقية': r.iqDays, 'الحالة': r.iqStatus }) },
        { name: 'إقامات منتهية', filter: (r: any) => r._iqClass === 'expired', cols: [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }], pick: (r: any) => ({ 'الكود': r.code, 'الاسم العربي': r.nameAr, 'الاسم الإنجليزي': r.nameEn, 'رقم الإقامة': r.iqamaNumber, 'انتهاء الإقامة': r.iqamaExpiry, 'الأيام المتبقية': r.iqDays, 'الحالة': r.iqStatus }) },
      ];
      sheets.forEach(s => {
        const data = (rows as any[]).filter(s.filter).map(s.pick);
        const ws = utils.json_to_sheet(data);
        (ws as any)['!cols'] = s.cols;
        utils.book_append_sheet(wb, ws, s.name);
      });
      writeFile(wb, fileName);
      return;
    }
    if (view === 'insurance_status') {
      fileName = `تقرير_التأمين_${selectedDate}.xlsx`;
      const activeWorkers = state.workers.filter(w => w.status !== 'pending' && w.insuranceExpiry);
      const classify = (d?: number) => d === 0 ? 'expired' : (d !== undefined && d <= 10 ? 'soon' : (d !== undefined ? 'valid' : 'none'));
      const rows = activeWorkers.map(w => {
        const insDays = daysRemaining(w.insuranceExpiry);
        return {
          code: w.code || '',
          nameAr: w.name,
          nameEn: w.englishName || '',
          insuranceExpiry: w.insuranceExpiry || '',
          insDays: insDays === undefined ? '' : insDays,
          insStatus: labelFor(insDays, !!w.insuranceExpiry),
          _insClass: classify(insDays),
        };
      });
      const sheets = [
        { name: 'تأمين ساري', filter: (r: any) => r._insClass === 'valid', cols: [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }], pick: (r: any) => ({ 'الكود': r.code, 'الاسم العربي': r.nameAr, 'الاسم الإنجليزي': r.nameEn, 'انتهاء التأمين': r.insuranceExpiry, 'الأيام المتبقية': r.insDays, 'الحالة': r.insStatus }) },
        { name: 'تأمين قرب الانتهاء', filter: (r: any) => r._insClass === 'soon', cols: [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }], pick: (r: any) => ({ 'الكود': r.code, 'الاسم العربي': r.nameAr, 'الاسم الإنجليزي': r.nameEn, 'انتهاء التأمين': r.insuranceExpiry, 'الأيام المتبقية': r.insDays, 'الحالة': r.insStatus }) },
        { name: 'تأمين منتهي', filter: (r: any) => r._insClass === 'expired', cols: [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 14 }], pick: (r: any) => ({ 'الكود': r.code, 'الاسم العربي': r.nameAr, 'الاسم الإنجليزي': r.nameEn, 'انتهاء التأمين': r.insuranceExpiry, 'الأيام المتبقية': r.insDays, 'الحالة': r.insStatus }) },
      ];
      sheets.forEach(s => {
        const data = (rows as any[]).filter(s.filter).map(s.pick);
        const ws = utils.json_to_sheet(data);
        (ws as any)['!cols'] = s.cols;
        utils.book_append_sheet(wb, ws, s.name);
      });
      writeFile(wb, fileName);
      return;
    }

    if (view === 'vehicle_movement') {
        fileName = `تقرير_حركة_المركبات_${vehicleMovementStartDate ? vehicleMovementStartDate : 'البداية'}_إلى_${vehicleMovementEndDate ? vehicleMovementEndDate : 'النهاية'}.xlsx`;
        const vehicleMovementRows = (state.vehicles || []).map(v => {
            const driver = state.workers.find(w => w.driverCarPlate === v.plateNumber);
            let tripCount = 0;
            if (driver) {
                const assignedSites = state.sites.filter(s => 
                    s.driverId === driver.id || 
                    s.assignedDrivers?.some((ad: any) => ad.driverId === driver.id)
                );
                
                assignedSites.forEach(s => {
                     // Current trip count logic
                     tripCount += 1; 
                });
            }
            
            // Filter maintenance by date range
            const filteredMaintenance = (v.maintenanceHistory || []).filter(m => {
                if (vehicleMovementStartDate && m.date < vehicleMovementStartDate) return false;
                if (vehicleMovementEndDate && m.date > vehicleMovementEndDate) return false;
                return true;
            });

            const lastMaintenance = filteredMaintenance.length > 0 
                ? filteredMaintenance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                : null;
                
            return {
                'رقم المركبة': v.plateNumber,
                'السائق': driver ? (driver.englishName ? `${driver.name} - ${driver.englishName}` : driver.name) : 'غير معين',
                'عدد الرحلات (المواقع الحالية)': tripCount,
                'الصيانة (في الفترة)': lastMaintenance ? `${lastMaintenance.date} (${lastMaintenance.type === 'oil_change' ? 'تغيير زيت' : 'إصلاح'})` : 'لا يوجد',
                'الملاحظات': lastMaintenance ? (lastMaintenance.notes || '-') : '-'
            };
        });
        
        const wsVehicleMovement = utils.json_to_sheet(vehicleMovementRows);
        wsVehicleMovement['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 30 }];
        utils.book_append_sheet(wb, wsVehicleMovement, "حركة المركبات");
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

    // تقرير الرواتب تمت إزالته

    if (view === 'projects_summary') {
      fileName = `تقرير_المشاريع_المبسط_${projectSearchStartDate ? projectSearchStartDate : 'البداية'}_إلى_${projectSearchEndDate ? projectSearchEndDate : 'النهاية'}.xlsx`;
      const summaryRows = state.sites.map(site => {
        
        let siteWorkers = state.workers.filter(w => w.assignedSiteId === site.id && w.status !== 'pending');
        // Removed hireDate filtering as it hides current workers.
        // We only want to filter absence history by date range, not worker inclusion.
        
        const workerCount = siteWorkers.length;
        
        let absenceCount = 0;
        siteWorkers.forEach(w => {
            if (w.absenceHistory) {
                w.absenceHistory.forEach(h => {
                    if (projectSearchStartDate && h.date < projectSearchStartDate) return;
                    if (projectSearchEndDate && h.date > projectSearchEndDate) return;
                    absenceCount++;
                });
            }
        });
        
        const absenceStatus = absenceCount > 0 ? 'يوجد غياب' : 'لا يوجد';
        
        const expiredInsuranceCount = siteWorkers.filter(w => {
             if (!w.insuranceExpiry) return false;
             return new Date(w.insuranceExpiry) < new Date();
        }).length;
        const insuranceStatus = expiredInsuranceCount > 0 ? `يوجد ${expiredInsuranceCount} منتهي` : 'ساري';
        
        return {
          'اسم المشروع': site.name,
          'عدد العمال': workerCount,
          'عدد الغياب': absenceCount,
          'حالة الغياب': absenceStatus,
          'حالة التأمين': insuranceStatus
        };
      });
      const wsSummary = utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
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
                    'اسم العامل': w.englishName ? `${w.name} - ${w.englishName}` : w.name,
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
                    'اسم العامل': w.englishName ? `${w.name} - ${w.englishName}` : w.name,
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
          'الاسم': w.englishName ? `${w.name} - ${w.englishName}` : w.name,
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
      const workerNames = state.workers
        .filter(w => w.assignedSiteId === site.id)
        .map(w => (w.englishName ? `${w.name} - ${w.englishName}` : w.name))
        .join(', ');
      
      let statusText = 'جاري العمل';
      if (site.status === 'completed') statusText = 'منتهي';
      else if (site.status === 'stopped') statusText = 'متوقف';

      return {
        'المشروع': site.name,
        'الحالة': statusText,
        'المسؤول': engineer ? (engineer.englishName ? `${engineer.name} - ${engineer.englishName}` : engineer.name) : '',
        'السائق': driver ? (driver.englishName ? `${driver.name} - ${driver.englishName}` : driver.name) : '',
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
          'الاسم': w.englishName ? `${w.name} - ${w.englishName}` : w.name,
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

  // Project filter for 'projects' view
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const projectOptions = useMemo(() => state.sites.map(s => ({ value: s.id, label: s.name })), [state.sites]);

  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-24 print:pt-0 print:pb-0 print:bg-white animate-fade-in font-cairo">
      <div className="max-w-[1920px] mx-auto px-4 md:px-10 print:max-w-none print:px-2">
        <div className="flex flex-col gap-6 print:hidden mb-8">
            <div className="text-center">
                 <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {view === 'projects' ? 'صفحة التقارير' : view === 'projects_summary' ? 'تقرير المشاريع المبسط' : view === 'drivers' ? 'تقرير السائقين' : view === 'vehicles' ? 'تقرير المركبات' : view === 'vehicle_movement' ? 'تقرير حركة المركبات' : 'قاعدة بيانات العمال الشاملة'}
                 </h1>
                 <p className="text-gray-500">استخراج التقارير وتصديرها</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/" className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 text-gray-700 font-bold transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5">
                    <LayoutDashboard className="w-5 h-5" />
                    لوحة التوزيع
                </Link>
                
                {(view !== 'violations' && view !== 'maintenance' && view !== 'projects') && (
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
                )}

                {/* Project Date Range Filter */}
                {(view === 'projects' || view === 'projects_summary') && (
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-1">
                             <span className="text-xs font-bold text-gray-500 whitespace-nowrap">
                                {view === 'projects' ? 'تاريخ:' : 'من تاريخ:'}
                             </span>
                             <input 
                                type="date" 
                                value={projectSearchStartDate}
                                onChange={(e) => setProjectSearchStartDate(e.target.value)}
                                className="text-sm outline-none bg-transparent text-gray-900 font-bold cursor-pointer w-[110px]"
                             />
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-gray-500 whitespace-nowrap">إلى:</span>
                             <input 
                                type="date" 
                                value={projectSearchEndDate}
                                onChange={(e) => setProjectSearchEndDate(e.target.value)}
                                className="text-sm outline-none bg-transparent text-gray-900 font-bold cursor-pointer w-[110px]"
                             />
                        </div>
                        {(projectSearchStartDate || projectSearchEndDate) && (
                            <button 
                                onClick={() => { setProjectSearchStartDate(''); setProjectSearchEndDate(''); }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-full transition-colors mr-1"
                                title="مسح الفلتر"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Violations Filters Moved to Main Content Area */}
                {view === 'violations' && null}
                
                {/* Vehicle Movement Filters */}
                {view === 'vehicle_movement' && (
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-1">
                             <span className="text-xs font-bold text-gray-500 whitespace-nowrap">من:</span>
                             <input 
                                type="date" 
                                value={vehicleMovementStartDate}
                                onChange={(e) => setVehicleMovementStartDate(e.target.value)}
                                className="text-sm outline-none bg-transparent text-gray-900 font-bold cursor-pointer w-[110px]"
                             />
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-gray-500 whitespace-nowrap">إلى:</span>
                             <input 
                                type="date" 
                                value={vehicleMovementEndDate}
                                onChange={(e) => setVehicleMovementEndDate(e.target.value)}
                                className="text-sm outline-none bg-transparent text-gray-900 font-bold cursor-pointer w-[110px]"
                             />
                        </div>
                        {(vehicleMovementStartDate || vehicleMovementEndDate) && (
                            <button 
                                onClick={() => { setVehicleMovementStartDate(''); setVehicleMovementEndDate(''); }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-full transition-colors mr-1"
                                title="مسح الفلتر"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

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
                    { id: 'vehicle_movement', label: 'حركة المركبات', icon: Truck, activeClass: 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-100', inactiveClass: 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700' },
                    { id: 'violations', label: 'المخالفات المرورية', icon: AlertTriangle, activeClass: 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-100', inactiveClass: 'text-gray-600 hover:bg-red-50 hover:text-red-700' },
                    { id: 'iqama_status', label: 'حالة الإقامة', icon: ShieldCheck, activeClass: 'bg-teal-600 text-white shadow-lg shadow-teal-200 ring-2 ring-teal-100', inactiveClass: 'text-gray-600 hover:bg-teal-50 hover:text-teal-700' },
                    { id: 'insurance_status', label: 'حالة التأمين', icon: ShieldCheck, activeClass: 'bg-cyan-600 text-white shadow-lg shadow-cyan-200 ring-2 ring-cyan-100', inactiveClass: 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-700' },
                    { id: 'all', label: 'الكل (قاعدة البيانات)', icon: Users, activeClass: 'bg-slate-800 text-white shadow-lg shadow-slate-200 ring-2 ring-slate-100', inactiveClass: 'text-gray-600 hover:bg-slate-50 hover:text-slate-800' },
                ].filter(tab => {
                    if (user?.role === 'engineer' && (tab.id === 'vehicles' || tab.id === 'violations' || tab.id === 'maintenance' || tab.id === 'projects_summary' || tab.id === 'drivers' || tab.id === 'all')) {
                        return false;
                    }
                    if (user?.role === 'accountant' && tab.id !== 'absence' && tab.id !== 'violations') {
                        return false;
                    }
                    return true;
                }).map((tab) => {
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

        {/* Project Search (Projects View Only) */}
        {view === 'projects' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 print:hidden flex items-center gap-4">
             <div className="flex items-center gap-3 w-full md:w-[380px]">
               <div className="text-sm font-bold text-gray-600 whitespace-nowrap">بحث بالمشروع</div>
               <SearchableSelect
                 className="w-full"
                 placeholder="اختر المشروع للطباعة (الكل)"
                 options={projectOptions}
                 value={selectedProjectId}
                 onChange={(val) => setSelectedProjectId(val)}
                 clearable
               />
             </div>
             {selectedProjectId && (
               <button
                 onClick={() => window.print()}
                 className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-sm"
               >
                 طباعة هذا المشروع
               </button>
             )}
          </div>
        )}

        {/* Print Header */}
        {(view === 'projects' || view === 'projects_summary') && (
        <div className="hidden print:block mb-6 border-b pb-4">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        {view === 'projects' ? 'تقرير توزيع المشاريع' : 'تقرير المشاريع المبسط'}
                    </h1>
                    <div className="text-base text-gray-600 font-medium">
                        {view === 'projects' && (projectSearchStartDate || projectSearchEndDate) 
                            ? `الفترة: ${toDMY(projectSearchStartDate) || 'البداية'} - ${toDMY(projectSearchEndDate) || 'النهاية'}`
                            : `تاريخ التقرير: ${toDMY(selectedDate)}`
                        }
                    </div>
                </div>
                <div className="text-left text-sm text-gray-400">
                    تم الطباعة: {nowDMYTime()}
                </div>
            </div>
        </div>
        )}

        {/* Vehicle Movement Print Header */}
        {view === 'vehicle_movement' && (
        <div className="hidden print:block mb-6 border-b pb-4">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold mb-2">تقرير حركة المركبات</h1>
                    <div className="text-base text-gray-600 font-medium">
                        {(vehicleMovementStartDate || vehicleMovementEndDate) 
                            ? `الفترة: ${toDMY(vehicleMovementStartDate) || 'البداية'} - ${toDMY(vehicleMovementEndDate) || 'النهاية'}`
                            : `تاريخ التقرير: ${toDMY(selectedDate)}`
                        }
                    </div>
                </div>
                <div className="text-left text-sm text-gray-400">
                    تم الطباعة: {nowDMYTime()}
                </div>
            </div>
        </div>
        )}

        {/* Project Statistics Dashboard */}
        {view === 'projects' && (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 break-inside-avoid ${view === 'projects' ? 'print:hidden' : 'print:grid print:grid-cols-4 print:gap-2 print:mb-4'}`}>
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
                    <table className="w-full table-auto md:table-fixed text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">اسم المشروع</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">عدد العمال</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">عدد الغياب</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">حالة الغياب</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">حالة التأمين</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {state.sites.map((site, idx) => {
                                
                                let siteWorkers = state.workers.filter(w => w.assignedSiteId === site.id && w.status !== 'pending');
                                // Removed hireDate filtering to show all current workers regardless of hire date
                                
                                const workerCount = siteWorkers.length;
                                
                                let absenceCount = 0;
                                siteWorkers.forEach(w => {
                                    if (w.absenceHistory) {
                                        w.absenceHistory.forEach(h => {
                                            if (projectSearchStartDate && h.date < projectSearchStartDate) return;
                                            if (projectSearchEndDate && h.date > projectSearchEndDate) return;
                                            absenceCount++;
                                        });
                                    }
                                });
                                
                                const absenceStatus = absenceCount > 0 ? 'يوجد غياب' : 'لا يوجد';
                                
                                const expiredInsuranceCount = siteWorkers.filter(w => {
                                    if (!w.insuranceExpiry) return false;
                                    return new Date(w.insuranceExpiry) < new Date();
                                }).length;
                                const insuranceStatus = expiredInsuranceCount > 0 ? `يوجد ${expiredInsuranceCount} منتهي` : 'ساري';

                                return (
                                    <tr key={site.id} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-gray-900 text-sm md:text-base group-hover:text-blue-700 hover:underline transition-colors print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{site.name}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-gray-900 text-sm md:text-base print:py-1.5 print:px-2 print:text-xs">{workerCount}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-red-600 text-sm md:text-base print:py-1.5 print:px-2 print:text-xs">{absenceCount}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 text-gray-700 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{absenceStatus}</td>
                                        <td className={`px-2 md:px-5 py-2 md:py-4 font-bold text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal ${expiredInsuranceCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{insuranceStatus}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2 border-gray-300 print:border-gray-800 font-bold">
                            <tr>
                                <td className="px-2 md:px-5 py-3 md:py-4 text-gray-900 text-left pl-6 md:pl-10 print:py-2 print:px-2 print:text-sm">الإجمالي الكلي:</td>
                                <td className="px-2 md:px-5 py-3 md:py-4 text-blue-700 text-base md:text-lg print:text-black print:py-2 print:px-2 print:text-sm">
                                    {state.sites.reduce((acc, site) => {
                                        let siteWorkers = state.workers.filter(w => w.assignedSiteId === site.id && w.status !== 'pending');
                                        // Removed hireDate filtering for total count
                                        return acc + siteWorkers.length;
                                    }, 0)}
                                </td>
                                <td className="px-2 md:px-5 py-3 md:py-4 text-red-700 text-base md:text-lg print:text-black print:py-2 print:px-2 print:text-sm">
                                    {state.sites.reduce((acc, site) => {
                                        let siteWorkers = state.workers.filter(w => w.assignedSiteId === site.id && w.status !== 'pending');
                                        // Removed hireDate filtering for absence count aggregation
                                        
                                        let abs = 0;
                                        siteWorkers.forEach(w => {
                                            if (w.absenceHistory) {
                                                w.absenceHistory.forEach(h => {
                                                    if (projectSearchStartDate && h.date < projectSearchStartDate) return;
                                                    if (projectSearchEndDate && h.date > projectSearchEndDate) return;
                                                    abs++;
                                                });
                                            }
                                        });
                                        return acc + abs;
                                    }, 0)}
                                </td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        )}

        {view === 'vehicle_movement' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full table-auto md:table-fixed text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">رقم المركبة</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">السائق</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">عدد الرحلات</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">آخر صيانة</th>
                                <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">الملاحظات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {(state.vehicles || []).map((v, idx) => {
                                const driver = state.workers.find(w => w.driverCarPlate === v.plateNumber);
                                const assignedSites = driver ? state.sites.filter(s => 
                                    s.driverId === driver.id || 
                                    s.assignedDrivers?.some((ad: any) => ad.driverId === driver.id)
                                ) : [];
                                const tripCount = assignedSites.length;

                                const lastMaintenance = v.maintenanceHistory && v.maintenanceHistory.length > 0 
                                    ? v.maintenanceHistory
                                        .filter(m => {
                                            if (vehicleMovementStartDate && m.date < vehicleMovementStartDate) return false;
                                            if (vehicleMovementEndDate && m.date > vehicleMovementEndDate) return false;
                                            return true;
                                        })
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                                    : null;

                                return (
                                    <tr key={v.id} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-gray-900 text-sm md:text-base border-b border-gray-100 print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{v.plateNumber}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 text-gray-700 font-medium text-sm md:text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                            {driver ? (driver.englishName ? `${driver.name} - ${driver.englishName}` : driver.name) : <span className="text-gray-400">غير معين</span>}
                                        </td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-blue-600 text-sm md:text-base print:py-1.5 print:px-2 print:text-xs print:text-black">{tripCount}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 text-gray-700 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                            {lastMaintenance ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{lastMaintenance.date}</span>
                                                    <span className="text-xs text-gray-500">{lastMaintenance.type === 'oil_change' ? 'تغيير زيت' : 'إصلاح'}</span>
                                                </div>
                                            ) : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 text-gray-600 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                            {lastMaintenance?.notes || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
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

                {/* Date Filter for Vehicle Report */}
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-6 print:hidden">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">من تاريخ:</span>
                        <input 
                            type="date" 
                            value={vehicleSearchStartDate} 
                            onChange={(e) => setVehicleSearchStartDate(e.target.value)} 
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 bg-white shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">إلى تاريخ:</span>
                        <input 
                            type="date" 
                            value={vehicleSearchEndDate} 
                            onChange={(e) => setVehicleSearchEndDate(e.target.value)} 
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500 bg-white shadow-sm"
                        />
                    </div>
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
                                
                                // Calculate filtered counts
                                const maintenanceCount = (vehicle.maintenanceHistory || []).filter(m => {
                                    if (!vehicleSearchStartDate && !vehicleSearchEndDate) return true;
                                    const mDate = new Date(m.date);
                                    const start = vehicleSearchStartDate ? new Date(vehicleSearchStartDate) : new Date(0);
                                    const end = vehicleSearchEndDate ? new Date(vehicleSearchEndDate) : new Date(8640000000000000);
                                    if (vehicleSearchEndDate) end.setHours(23, 59, 59, 999);
                                    return mDate >= start && mDate <= end;
                                }).length;

                                const violationsCount = (vehicle.violations || []).filter(v => {
                                    if (!vehicleSearchStartDate && !vehicleSearchEndDate) return true;
                                    const vDate = new Date(v.date);
                                    const start = vehicleSearchStartDate ? new Date(vehicleSearchStartDate) : new Date(0);
                                    const end = vehicleSearchEndDate ? new Date(vehicleSearchEndDate) : new Date(8640000000000000);
                                    if (vehicleSearchEndDate) end.setHours(23, 59, 59, 999);
                                    return vDate >= start && vDate <= end;
                                }).length;

                                const hasViolations = violationsCount > 0;
                                
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
                                        <td className="px-5 py-4 font-bold text-gray-900 text-base print:py-1.5 print:px-2 print:text-xs border-b border-gray-50 print:border-gray-200">{maintenanceCount}</td>
                                        <td className="px-5 py-4 font-bold text-base print:py-1.5 print:px-2 print:text-xs border-b border-gray-50 print:border-gray-200">
                                            <span className={hasViolations ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded-full' : 'text-gray-400'}>
                                                {violationsCount}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">
                                            <span className={`font-bold print:whitespace-nowrap ${regColor}`}>
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
                                    const assignedSites = state.sites.filter(s => s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id);
                                    grandTotalSites += assignedSites.length;
                                    assignedSites.forEach(s => {
                                        const ad = s.assignedDrivers?.find((x: any) => x.driverId === d.id);
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full flex flex-col overflow-visible animate-in fade-in zoom-in-95 print:block print:w-full print:h-auto print:max-h-none print:max-w-none print:shadow-none print:border-none print:bg-white print:animate-none">
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl print:hidden">
                <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2 font-cairo">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  بحث المخالفات المرورية
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
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 print:hidden py-12">
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
                                          <div className="text-xs text-gray-500 font-bold hidden md:block print:block print:text-[10px] print:text-gray-500 print:uppercase font-bold print:break-words print:whitespace-normal print:leading-tight print:text-right w-full" dir="ltr">
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
        )}

        {view === 'maintenance' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-yellow-50 print:bg-white print:border-b-2 print:border-yellow-800">
                    <h2 className="text-xl font-bold text-yellow-700 flex items-center gap-2 print:text-black">
                        <Wrench className="w-6 h-6" />
                        تقرير الصيانة
                    </h2>
                    <div className="text-sm text-yellow-700 font-bold print:text-black">
                        الفترة: {toDMY(maintenanceStartDate)} - {toDMY(maintenanceEndDate)}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-separate border-spacing-0">
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">رقم اللوحة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">نوع المركبة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">تاريخ الصيانة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">نوع الصيانة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs">التكلفة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {(() => {
                                let totalCost = 0;
                                let count = 0;
                                const rows = (state.vehicles || []).flatMap(v => 
                                    (v.maintenanceHistory || []).filter(m => m.date >= maintenanceStartDate && m.date <= maintenanceEndDate).map(m => ({ v, m }))
                                );

                                if (rows.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-16 text-center text-gray-500">
                                                <Wrench className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                                                <p className="text-lg font-medium">لا توجد سجلات صيانة في هذه الفترة</p>
                                            </td>
                                        </tr>
                                    );
                                }

                                return rows.map(({ v, m }, idx) => {
                                    totalCost += Number(m.cost) || 0;
                                    count++;
                                    const mType = m.type === 'oil_change' ? 'تغيير زيت' : (m.type === 'repair' ? 'إصلاح' : 'أخرى');
                                    return (
                                        <tr key={m.id} className={`hover:bg-yellow-50/20 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30 print:bg-gray-50/50'}`}>
                                            <td className="px-5 py-4 font-bold text-gray-900 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{v.plateNumber}</td>
                                            <td className="px-5 py-4 text-gray-700 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{v.type}</td>
                                            <td className="px-5 py-4 text-gray-900 font-bold text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200" dir="ltr">{m.date}</td>
                                            <td className="px-5 py-4 text-yellow-700 font-bold text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{mType}</td>
                                            <td className="px-5 py-4 text-yellow-700 font-bold text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{m.cost}</td>
                                            <td className="px-5 py-4 text-gray-600 text-sm print:py-1.5 print:px-2 print:text-xs print:whitespace-normal border-b border-gray-50 print:border-gray-200">{m.notes || '-'}</td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold print:bg-white print:table-footer-group">
                             {(() => {
                                let totalCost = 0;
                                let count = 0;
                                (state.vehicles || []).forEach(v => {
                                    (v.maintenanceHistory || []).forEach(m => {
                                        if (m.date >= maintenanceStartDate && m.date <= maintenanceEndDate) {
                                            totalCost += Number(m.cost) || 0;
                                            count++;
                                        }
                                    });
                                });

                                return (
                                    <tr>
                                        <td colSpan={4} style={{ borderTop: '3px solid black' }} className="px-5 py-4 text-left text-gray-800 font-black border-t-2 border-gray-400 print:!border-black print:!border-t-[3px] print:text-black print:py-3 print:px-2 print:text-sm print:text-left whitespace-nowrap">الإجمالي ({count} عملية صيانة):</td>
                                        <td style={{ borderTop: '3px solid black' }} className="px-5 py-4 text-center text-yellow-800 font-black text-xl border-t-2 border-gray-400 print:!border-black print:!border-t-[3px] print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{totalCost}</td>
                                        <td style={{ borderTop: '3px solid black' }} className="px-5 py-4 border-t-2 border-gray-400 print:!border-black print:!border-t-[3px]"></td>
                                    </tr>
                                );
                            })()}
                        </tfoot>
                    </table>
                </div>
            </div>
        )}



        {view === 'projects' ? (
            <div className="space-y-8 print:space-y-8">
                {(selectedProjectId ? data.filter(d => d.site.id === selectedProjectId) : data).map(({ site, workers, counts, driver, engineer }, idx) => (
                <section key={site.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:overflow-visible print:shadow-none print:border-0 print:m-0 print:p-0 print:w-full print:h-auto print:block" style={{ pageBreakAfter: 'always' }}>
                    
                    {/* Header Section */}
                    <div className="bg-gray-900 text-white p-4 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6 print:bg-white print:text-black print:border-b-2 print:border-gray-800 print:p-4 print:mb-2 break-inside-avoid">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3 print:mb-2">
                                <div className="flex items-center gap-3">
                                    {site.code && <span className="text-base md:text-lg font-bold text-gray-400 bg-gray-800/50 px-2.5 md:px-3 py-0.5 md:py-1 rounded-lg border border-gray-700 print:bg-gray-100 print:text-black print:border-gray-300 print:text-base">{site.code}</span>}
                                    <h2 className="text-xl md:text-2xl font-bold text-white print:text-black print:text-xl">{site.name}</h2>
                                </div>
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
                            <p className="text-sm md:text-base text-gray-300 font-medium mb-3 md:mb-4 print:text-gray-700 print:text-xs print:mb-1 flex items-center gap-2">
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

                        <div className="flex flex-col gap-2 md:gap-3 min-w-0 md:min-w-[300px] print:min-w-0 print:grid print:grid-cols-3 print:gap-4 print:items-center print:w-full print:mt-2">
                            <div className="flex items-center justify-between bg-gray-800/50 px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-700 print:bg-blue-50 print:border print:border-blue-200 print:p-2 print:block print:text-center print:shadow-sm">
                                <span className="text-gray-400 text-sm font-medium print:text-blue-800 print:text-xs print:block print:mb-1 print:font-bold">المسؤول</span>
                                <span className="font-bold text-white text-base md:text-lg print:text-blue-950 print:text-xs block">
                                    {engineer ? (
                                        <>
                                            <span className="block">{engineer.name}</span>
                                            {engineer.englishName && <span className="block text-black text-xs md:text-sm font-normal mt-0.5 print:text-[10px] print:text-blue-900">{engineer.englishName}</span>}
                                        </>
                                    ) : 'بدون'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between bg-gray-800/50 px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-700 print:bg-orange-50 print:border print:border-orange-200 print:p-2 print:block print:text-center print:shadow-sm">
                                <span className="text-gray-400 text-sm font-medium print:text-orange-800 print:text-xs print:block print:mb-1 print:font-bold">السائقين</span>
                                <span className="font-bold text-white text-sm md:text-base print:text-orange-950 print:text-xs block">
                                    {(() => {
                                        const driversToDisplay = site.assignedDrivers && site.assignedDrivers.length > 0
                                            ? site.assignedDrivers
                                            : (site.driverId ? [{ driverId: site.driverId, count: site.driverTransportCount || 0 }] : []);

                                        if (!driversToDisplay || driversToDisplay.length === 0) {
                                            return 'بدون';
                                        }

                                        return (
                                            <>
                                                {driversToDisplay.length > 1 && (
                                                    <span className="block text-xs md:text-sm font-semibold text-gray-200 mb-1 print:text-orange-900 print:text-[10px]">
                                                        عدد السائقين: {driversToDisplay.length}
                                                    </span>
                                                )}
                                                {driversToDisplay.map((ad: { driverId: string; count?: number }, idx: number) => {
                                                    const d = state.workers.find(w => w.id === ad.driverId);
                                                    if (!d) return null;

                                                    let line = d.name;
                                                    if (d.englishName) line += ` (${d.englishName})`;
                                                    if (d.driverCarType) line += ` - ${d.driverCarType}`;
                                                    if (d.driverCarPlate) line += ` - ${d.driverCarPlate}`;
                                                    if (ad.count) {
                                                        line += ` - ينقل: ${ad.count}`;
                                                    } else if (typeof d.driverCapacity === 'number') {
                                                        line += ` - سعة: ${d.driverCapacity}`;
                                                    }

                                                    return (
                                                        <span
                                                            key={`${ad.driverId}-${idx}`}
                                                            className="block text-xs md:text-sm font-normal text-gray-100 print:text-orange-900 print:text-[10px]"
                                                        >
                                                            {line}
                                                        </span>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between bg-gray-800/50 px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-700 print:bg-green-50 print:border print:border-green-200 print:p-2 print:block print:text-center print:shadow-sm">
                                <span className="text-gray-400 text-sm font-medium print:text-green-800 print:text-xs print:block print:mb-1 print:font-bold">عدد العمال</span>
                                <span className="font-bold text-white text-lg md:text-xl print:text-green-950 print:text-lg">{workers.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 print:p-2 print:flex-1">
                        <div className="mb-6 print:mb-2 break-inside-avoid">
                            <h3 className="text-sm md:text-base font-bold text-gray-800 mb-2 md:mb-3 print:text-black border-b pb-2 print:text-xs print:mb-1">توزيع المهن:</h3>
                            <div className="flex flex-wrap gap-1.5 md:gap-2 print:gap-1">
                                {state.skills.filter(sk => (counts[sk.name] || 0) > 0).map(sk => (
                                <span key={sk.id} className={`text-xs md:text-sm font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border flex items-center gap-1.5 md:gap-2 print:border-gray-300 print:bg-white print:text-black print:text-[10px] print:px-1.5 print:py-0.5 ${sk.color}`}>
                                    <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-current opacity-75 print:border print:border-black print:w-1.5 print:h-1.5"></span>
                                    {sk.label}: {counts[sk.name]}
                                </span>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto md:overflow-hidden print:overflow-visible rounded-lg border border-gray-200 print:border-gray-300">
                            <table className="w-full table-auto md:table-fixed text-right border-collapse">
                                <thead className="bg-gray-100 print:bg-gray-100">
                                    <tr>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الكود</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الاسم</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">المهنة</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal hidden md:table-cell">رقم الإقامة</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal hidden md:table-cell">الجوال</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">انتهاء الإقامة</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {workers.map((w, wIdx) => {
                                    const iqDays = daysRemaining(w.iqamaExpiry);
                                    const skLabel = state.skills.find(s => s.name === w.skill)?.label || w.skill;
                                    return (
                                    <tr key={w.id} className={`hover:bg-blue-50/50 print:hover:bg-transparent break-inside-avoid ${wIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50/50'}`}>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-mono text-gray-500 text-xs md:text-sm font-bold print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">{w.code || '-'}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-gray-900 text-sm md:text-base print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">
                                            <Link href={`/workers?search=${encodeURIComponent(w.name)}`} className="hover:text-blue-600 hover:underline block">
                                                {w.name}
                                            </Link>
                                            {w.englishName && <span className="block text-black text-xs md:text-sm font-normal mt-0.5 print:text-[9px] print:text-black">{w.englishName}</span>}
                                        </td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 print:py-1 print:px-1">
                                            <span className="bg-white border border-gray-200 text-gray-800 px-2.5 md:px-3 py-0.5 md:py-1 rounded-md text-xs md:text-sm font-bold shadow-sm print:shadow-none print:border-gray-300 print:text-[10px] print:px-1 print:py-0 print:whitespace-nowrap">{skLabel}</span>
                                        </td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium print:py-1 print:px-1 print:text-[10px] hidden md:table-cell">{w.iqamaNumber}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium print:py-1 print:px-1 print:text-[10px] hidden md:table-cell" dir="ltr">{w.phone}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 print:py-1 print:px-1">
                                            <span className={`px-2.5 md:px-3 py-0.5 md:py-1 rounded-md text-xs md:text-sm font-bold border ${statusClasses(iqDays)} print:border-gray-300 print:bg-white print:text-black print:text-[10px] print:px-1 print:py-0 print:whitespace-nowrap`}>
                                                {labelFor(iqDays, !!w.iqamaExpiry)} <span className="font-mono font-normal text-[10px] md:text-xs ml-1 print:text-[9px]">({w.iqamaExpiry})</span>
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
                {!selectedProjectId && realLeaveData.length > 0 && (
                <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:overflow-visible print:shadow-none print:border-0 print:m-0 print:p-0 print:w-full print:h-auto print:block" style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}>
                    <div className="bg-gray-600 text-white p-6 flex items-center justify-between gap-6 print:bg-white print:text-black print:border-b-2 print:border-gray-600 print:p-4 print:mb-2">
                        <div className="flex items-center gap-4">
                             <h2 className="text-2xl font-bold text-white print:text-black print:text-xl">قائمة الاستراحة</h2>
                             <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-700 text-gray-100 border border-gray-500 print:text-gray-800 print:bg-white print:border-gray-800">
                                العدد: {realLeaveData.length}
                             </span>
                        </div>
                    </div>
                    <div className="p-4 md:p-6 print:p-2">
                         <div className="overflow-x-auto md:overflow-hidden print:overflow-visible rounded-lg border border-gray-200 print:border-gray-300">
                            <table className="w-full table-auto md:table-fixed text-right border-collapse">
                                <thead className="bg-gray-100 print:bg-gray-100">
                                    <tr>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الكود</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">الاسم</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">المهنة</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">نوع الإجازة</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">تاريخ العودة</th>
                                        <th className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 print:py-1 print:px-1 print:text-[10px] print:whitespace-normal hidden md:table-cell">الجوال</th>
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
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-mono text-gray-500 text-xs md:text-sm font-bold print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">{w.code || '-'}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-bold text-gray-900 text-sm md:text-base print:py-1 print:px-1 print:text-[10px] print:whitespace-normal">
                                            <Link href={`/workers?search=${encodeURIComponent(w.name)}`} className="hover:text-gray-600 hover:underline block">
                                                {w.name}
                                            </Link>
                                            {w.englishName && <span className="block text-black text-xs md:text-sm font-normal mt-0.5 print:text-[9px] print:text-black">{w.englishName}</span>}
                                        </td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 print:py-1 print:px-1">
                                            <span className="bg-white border border-gray-200 text-gray-800 px-2.5 md:px-3 py-0.5 md:py-1 rounded-md text-xs md:text-sm font-bold shadow-sm print:shadow-none print:border-gray-300 print:text-[10px] print:px-1 print:py-0 print:whitespace-nowrap">{skLabel}</span>
                                        </td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 text-xs md:text-sm font-medium text-gray-700 print:py-1 print:px-1 print:text-[10px]">{currentLeave ? currentLeave.type : 'راحة'}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium print:py-1 print:px-1 print:text-[10px]">{currentLeave ? currentLeave.endDate : '-'}</td>
                                        <td className="px-2 md:px-5 py-2 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium print:py-1 print:px-1 print:text-[10px] hidden md:table-cell" dir="ltr">{w.phone}</td>
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

                {/* Date Filter for Driver Report */}
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-6 print:hidden">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">من تاريخ:</span>
                        <input 
                            type="date" 
                            value={driverSearchStartDate} 
                            onChange={(e) => setDriverSearchStartDate(e.target.value)} 
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 bg-white shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">إلى تاريخ:</span>
                        <input 
                            type="date" 
                            value={driverSearchEndDate} 
                            onChange={(e) => setDriverSearchEndDate(e.target.value)} 
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 bg-white shadow-sm"
                        />
                    </div>
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
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 text-center border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs print:text-center">صيانة السيارة</th>
                                <th className="px-5 py-4 text-sm font-bold text-gray-800 text-center border-b border-gray-300 print:border-gray-400 print:whitespace-normal print:py-2 print:px-2 print:text-xs print:text-center">المخالفات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredDrivers
                                .map((d: any, idx: number) => {
                                const assignedSites = state.sites.filter(s => s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id);
                                let totalTransported = 0;
                                const sitesDetails = assignedSites.map(s => {
                                    const ad = s.assignedDrivers?.find((x: any) => x.driverId === d.id);
                                    const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
                                    totalTransported += Number(count);
                                    return { name: s.name, count };
                                });

                                // Get Maintenance Details for display
                                const sourceVehicles = (view === 'drivers' && reportData?.vehicles) ? reportData.vehicles : state.vehicles;
                                const vehicle = sourceVehicles?.find((v: any) => v.plateNumber === d.driverCarPlate);
                                
                                const maintenanceInRange = vehicle?.maintenanceHistory?.filter((m: any) => {
                                    if (!driverSearchStartDate && !driverSearchEndDate) return true;
                                    const mDate = new Date(m.date);
                                    const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
                                    const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
                                    if (driverSearchEndDate) end.setHours(23, 59, 59, 999);
                                    return mDate >= start && mDate <= end;
                                }) || [];

                                const violationsInRange = vehicle?.violations?.filter((v: any) => {
                                    if (!driverSearchStartDate && !driverSearchEndDate) return true;
                                    const vDate = new Date(v.date);
                                    const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
                                    const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
                                    if (driverSearchEndDate) end.setHours(23, 59, 59, 999);
                                    return vDate >= start && vDate <= end;
                                }) || [];

                                return (
                                    <tr key={d.id} className={`hover:bg-indigo-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50/50'}`}>
                                        <td className="px-5 py-4 text-base print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">{d.name}</span>
                                                {d.englishName && (
                                                    <span className="text-xs text-black font-bold mt-1 text-left block" dir="ltr">
                                                        {d.englishName}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
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
                                        <td className="px-5 py-4 text-center print:py-1.5 print:px-2 print:text-xs">
                                            {maintenanceInRange.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {maintenanceInRange.map((m: any, i: number) => (
                                                        <span key={i} className="inline-flex flex-col items-start px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100 print:bg-white print:border-black print:text-black">
                                                            <span className="font-bold">{m.type}</span>
                                                            <span className="font-mono text-[10px]">{m.date}</span>
                                                            {m.cost && <span className="text-[10px]">({m.cost} ريال)</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 print:bg-white print:border-gray-400 print:text-gray-400">
                                                    <X className="w-3 h-3 print:hidden" />
                                                    لا يوجد
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-center print:py-1.5 print:px-2 print:text-xs">
                                            {violationsInRange.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {violationsInRange.map((v: any, i: number) => (
                                                        <span key={i} className="inline-flex flex-col items-start px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100 print:bg-white print:border-black print:text-black">
                                                            <span className="font-bold">{v.type}</span>
                                                            <span className="font-mono text-[10px]">{v.date}</span>
                                                            {v.cost && <span className="text-[10px]">({v.cost} ريال)</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 print:bg-white print:border-gray-400 print:text-gray-400">
                                                    <X className="w-3 h-3 print:hidden" />
                                                    لا يوجد
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold print:bg-white print:table-footer-group">
                            {(() => {
                                const drivers = filteredDrivers;

                                let grandTotalSites = 0;
                                let grandTotalTransported = 0;
                                let grandTotalMaintenance = 0;
                                let grandTotalViolations = 0;

                                drivers.forEach((d: any) => {
                                    const assignedSites = state.sites.filter(s => s.assignedDrivers?.some((ad: any) => ad.driverId === d.id) || s.driverId === d.id);
                                    grandTotalSites += assignedSites.length;
                                    assignedSites.forEach(s => {
                                        const ad = s.assignedDrivers?.find((x: any) => x.driverId === d.id);
                                        const count = ad ? ad.count : (s.driverId === d.id ? s.driverTransportCount : 0) || 0;
                                        grandTotalTransported += Number(count);
                                    });

                                    // Calculate Maintenance and Violations for this driver in range
                                    const sourceVehicles = (view === 'drivers' && reportData?.vehicles) ? reportData.vehicles : state.vehicles;
                                    const vehicle = sourceVehicles?.find((v: any) => v.plateNumber === d.driverCarPlate);
                                    
                                    const maintenanceInRange = vehicle?.maintenanceHistory?.filter((m: any) => {
                                        if (!driverSearchStartDate && !driverSearchEndDate) return true;
                                        const mDate = new Date(m.date);
                                        const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
                                        const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
                                        if (driverSearchEndDate) end.setHours(23, 59, 59, 999);
                                        return mDate >= start && mDate <= end;
                                    }) || [];
                                    grandTotalMaintenance += maintenanceInRange.reduce((acc: number, m: any) => acc + (Number(m.cost) || 0), 0);
                                    
                                    const violationsInRange = vehicle?.violations?.filter((v: any) => {
                                        if (!driverSearchStartDate && !driverSearchEndDate) return true;
                                        const vDate = new Date(v.date);
                                        const start = driverSearchStartDate ? new Date(driverSearchStartDate) : new Date(0);
                                        const end = driverSearchEndDate ? new Date(driverSearchEndDate) : new Date(8640000000000000);
                                        if (driverSearchEndDate) end.setHours(23, 59, 59, 999);
                                        return vDate >= start && vDate <= end;
                                    }) || [];
                                    grandTotalViolations += violationsInRange.reduce((acc: number, v: any) => acc + (Number(v.cost) || 0), 0);
                                });
                                return (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-4 text-left text-gray-800 font-black border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm">الإجمالي الكلي:</td>
                                        <td className="px-5 py-4 text-center text-indigo-800 font-black text-xl border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{grandTotalSites}</td>
                                        <td className="px-5 py-4 text-center text-indigo-800 font-black text-xl border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm print:text-center">{grandTotalTransported}</td>
                                        <td className="px-5 py-4 border-t-2 border-gray-400 print:border-t-[3px] print:border-black"></td>
                                        <td className="px-5 py-4 text-center text-green-700 font-black text-lg border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm print:text-center" dir="ltr">{grandTotalMaintenance > 0 ? `${grandTotalMaintenance} ريال` : '-'}</td>
                                        <td className="px-5 py-4 text-center text-red-700 font-black text-lg border-t-2 border-gray-400 print:border-t-[3px] print:border-black print:text-black print:py-3 print:px-2 print:text-sm print:text-center" dir="ltr">{grandTotalViolations > 0 ? `${grandTotalViolations} ريال` : '-'}</td>
                                    </tr>
                                );
                            })()}
                        </tfoot>
                    </table>
                </div>
            </div>
        ) : view === 'absence' ? (
            <div className="space-y-6">
                <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                    }
                `}} />
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
                <div className="overflow-x-auto md:overflow-visible">
                    <table className="w-full table-auto md:table-fixed text-right border-separate border-spacing-0">
                        <colgroup>
                            <col style={{ width: '4%' }} />   {/* # */}
                            <col style={{ width: '7%' }} />   {/* الكود */}
                            <col style={{ width: '18%' }} />  {/* اسم العامل */}
                            <col style={{ width: '11%' }} />  {/* المهنة */}
                            <col style={{ width: '11%' }} />  {/* رقم الجوال */}
                            <col style={{ width: '10%' }} />  {/* تاريخ الغياب */}
                            <col style={{ width: '14%' }} />  {/* سبب الغياب */}
                            <col style={{ width: '9%' }} />   {/* سُجل بواسطة */}
                            <col style={{ width: '12%' }} />  {/* المشروع المرتبط */}
                            <col style={{ width: '4%' }} />   {/* إجراءات */}
                        </colgroup>
                        <thead className="bg-gray-100 print:bg-gray-100">
                            <tr>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg print:whitespace-normal print:py-2 print:px-2 print:text-xs w-16 text-center">#</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 first:rounded-tr-lg last:rounded-tl-lg whitespace-nowrap print:whitespace-nowrap print:py-2 print:px-2 print:text-xs">الكود</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 break-words print:whitespace-normal print:py-2 print:px-2 print:text-xs">اسم العامل</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 whitespace-nowrap print:whitespace-nowrap print:py-2 print:px-2 print:text-xs">المهنة</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 whitespace-nowrap print:whitespace-nowrap print:py-2 print:px-2 print:text-xs hidden md:table-cell">رقم الجوال</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 whitespace-nowrap print:whitespace-nowrap print:py-2 print:px-2 print:text-xs">تاريخ الغياب</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 break-words print:whitespace-normal print:py-2 print:px-2 print:text-xs">سبب الغياب</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 whitespace-nowrap print:whitespace-nowrap print:py-2 print:px-2 print:text-xs hidden md:table-cell">سُجل بواسطة</th>
                                <th className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 break-words print:whitespace-normal print:py-2 print:px-2 print:text-xs">المشروع المرتبط</th>
                                {user?.role === 'admin' && (
                                    <th className="px-2 md:px-4 md:pl-6 py-2 md:py-4 text-xs md:text-sm font-bold text-gray-800 border-b border-gray-300 print:border-gray-400 last:rounded-tl-lg print:hidden hidden md:table-cell text-center whitespace-nowrap min-w-[90px]">
                                        إجراءات
                                    </th>
                                )}
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
                                                <td className="px-2 py-2 md:px-5 md:py-4 font-mono font-bold text-gray-500 text-xs md:text-sm text-center border-l border-gray-100 print:border-gray-300 print:py-1.5 print:px-2 print:text-xs">{idx + 1}</td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap">{w.code || '-'}</td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 text-sm md:text-base break-words print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900">{w.name}</span>
                                                        {w.englishName && (
                                                            <span className="text-[11px] text-black font-semibold mt-0.5 text-left" dir="ltr">
                                                                {w.englishName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm text-gray-700 whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap">
                                                    <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{skLabel}</span>
                                                </td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap hidden md:table-cell" dir="ltr">{w.phone}</td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap" dir="ltr">{new Date(h.date).toLocaleDateString('en-GB')}</td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm text-gray-600 break-words print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{h.reason || '-'}</td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm text-gray-900 whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap hidden md:table-cell">{h.recordedBy || '-'}</td>
                                                <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-900 break-words print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{assignedSite ? assignedSite.name : 'غير موزع'}</td>
                                                {user?.role === 'admin' && (
                                                <td className="px-2 py-2 md:px-4 md:pl-6 md:py-3 text-xs md:text-sm print:hidden hidden md:table-cell whitespace-nowrap text-center align-middle">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingAbsence({
                                                                    workerId: w.id,
                                                                    oldDate: h.date,
                                                                    newDate: h.date,
                                                                    reason: h.reason || ''
                                                                });
                                                            }}
                                                            className="px-3 py-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 text-[11px] md:text-xs font-semibold"
                                                        >
                                                            تعديل
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteHistoryItem(w.id, h.date)}
                                                            className="px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-[11px] md:text-xs font-semibold"
                                                        >
                                                            حذف
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
                                        matchesSearch = !!((w.name && w.name.toLowerCase().includes(query)) ||
                                                        (w.code && w.code.toLowerCase().includes(query)) ||
                                                        (w.iqamaNumber && w.iqamaNumber.includes(query)));
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
                                            <td className="px-2 py-2 md:px-5 md:py-4 font-mono font-bold text-gray-500 text-xs md:text-sm text-center border-l border-gray-100 print:border-gray-300 print:py-1.5 print:px-2 print:text-xs">{idx + 1}</td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap">{w.code || '-'}</td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 text-sm md:text-base break-words print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{w.name}</span>
                                                    {w.englishName && (
                                                        <span className="text-[11px] text-black font-semibold mt-0.5 text-left" dir="ltr">
                                                            {w.englishName}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm text-gray-700 whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap">
                                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">{skLabel}</span>
                                            </td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap hidden md:table-cell" dir="ltr">{w.phone}</td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 font-mono text-gray-700 text-xs md:text-sm font-medium whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap" dir="ltr">{absenceDate}</td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm text-gray-600 break-words print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{absenceReason}</td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm text-gray-900 whitespace-nowrap print:py-1.5 print:px-2 print:text-xs print:whitespace-nowrap hidden md:table-cell">{lastHistory?.recordedBy || '-'}</td>
                                            <td className="px-2 py-2 md:px-5 md:py-4 text-xs md:text-sm font-bold text-gray-900 break-words print:py-1.5 print:px-2 print:text-xs print:whitespace-normal">{assignedSite ? assignedSite.name : 'غير موزع'}</td>
                                            {user?.role === 'admin' && (
                                                <td className="px-2 py-2 md:px-4 md:pl-6 md:py-3 text-xs md:text-sm print:hidden hidden md:table-cell whitespace-nowrap text-center align-middle">
                                                    <div className="flex flex-col items-center gap-1">
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
                                                            className="px-3 py-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 text-[11px] md:text-xs font-semibold"
                                                        >
                                                            تعديل
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteAbsence(w.id)}
                                                            className="px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-[11px] md:text-xs font-semibold"
                                                        >
                                                            حذف
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
        ) : view === 'iqama_status' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-teal-50 print:bg-white print:border-b-2 print:border-teal-800">
                    <h2 className="text-xl font-bold text-teal-700 flex items-center gap-2 print:text-black">
                        <ShieldCheck className="w-6 h-6" />
                        تقرير حالة الإقامة
                        <span className="hidden print:inline text-xs font-bold text-gray-700">
                            فلتر الإقامة: {iqamaStatusFilter === 'all' ? 'الكل' : iqamaStatusFilter === 'valid' ? 'ساري' : iqamaStatusFilter === 'soon' ? 'على وشك الانتهاء' : 'منتهي'}
                        </span>
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs md:text-sm font-bold border border-teal-200 print:border-teal-800 print:bg-white print:text-teal-800">العدد: {iqamaFiltered.length}</span>
                        <button onClick={() => window.print()} className="hidden print:hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm">
                            <Printer className="w-4 h-4" />
                            طباعة
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-8 print:p-3">
                    <div className="print:hidden flex flex-wrap items-center gap-4 mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-700">حالة الإقامة:</span>
                            <select value={iqamaStatusFilter} onChange={(e) => setIqamaStatusFilter(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-600 bg-white">
                                <option value="all">الكل</option>
                                <option value="valid">ساري</option>
                                <option value="soon">على وشك الانتهاء</option>
                                <option value="expired">منتهي</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3">الإقامات</h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-right border-separate border-spacing-0">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الكود</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الاسم العربي</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الاسم (EN)</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">رقم الإقامة</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">انتهاء الإقامة</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b print:hidden">الأيام المتبقية</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {iqamaFiltered.map((w, idx) => {
                                        const d = daysRemaining(w.iqamaExpiry);
                                        const status = labelFor(d, !!w.iqamaExpiry);
                                        const cls = d === 0 ? 'text-red-600 font-bold' : (d !== undefined && d <= 10 ? 'text-amber-600 font-bold' : 'text-green-700 font-bold');
                                        const cat = d === 0 ? 'expired' : (d !== undefined && d <= 10 ? 'soon' : 'valid');
                                        return (
                                            <tr key={w.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2.5 text-sm font-mono text-gray-600">{w.code || '-'}</td>
                                                <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{w.name}</td>
                                                <td className="px-4 py-2.5 text-sm font-bold text-black" dir="ltr">{w.englishName || '-'}</td>
                                                <td className="px-4 py-2.5 text-sm font-mono text-gray-700">{w.iqamaNumber || '-'}</td>
                                                <td className="px-4 py-2.5 text-sm font-mono print:whitespace-nowrap" dir="ltr">{w.iqamaExpiry}</td>
                                                <td className="px-4 py-2.5 text-sm font-mono print:whitespace-nowrap print:hidden" dir="ltr">{d === undefined ? '-' : d}</td>
                                                <td className={`px-4 py-2.5 text-sm ${cls}`}>
                                                    <span className="print:hidden">{status}</span>
                                                    <span className="hidden print:inline">{cat === 'expired' ? 'منتهية' : cat === 'soon' ? 'على وشك' : 'سارية'}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        ) : view === 'insurance_status' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:border-2 print:border-gray-800">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-cyan-50 print:bg-white print:border-b-2 print:border-cyan-800">
                    <h2 className="text-xl font-bold text-cyan-700 flex items-center gap-2 print:text-black">
                        <ShieldCheck className="w-6 h-6" />
                        تقرير حالة التأمين
                        <span className="hidden print:inline text-xs font-bold text-gray-700">
                            فلتر التأمين: {insuranceStatusFilter === 'all' ? 'الكل' : insuranceStatusFilter === 'valid' ? 'ساري' : insuranceStatusFilter === 'soon' ? 'على وشك الانتهاء' : 'منتهي'}
                        </span>
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs md:text-sm font-bold border border-cyan-200 print:border-cyan-800 print:bg-white print:text-cyan-800">العدد: {insuranceFiltered.length}</span>
                        <button onClick={() => window.print()} className="hidden print:hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm">
                            <Printer className="w-4 h-4" />
                            طباعة
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-8 print:p-3">
                    <div className="print:hidden flex flex-wrap items-center gap-4 mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-700">حالة التأمين:</span>
                            <select value={insuranceStatusFilter} onChange={(e) => setInsuranceStatusFilter(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-600 bg-white">
                                <option value="all">الكل</option>
                                <option value="valid">ساري</option>
                                <option value="soon">على وشك الانتهاء</option>
                                <option value="expired">منتهي</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-3">التأمين</h3>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-right border-separate border-spacing-0">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الكود</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الاسم العربي</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الاسم (EN)</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">انتهاء التأمين</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b print:hidden">الأيام المتبقية</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-700 border-b">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {insuranceFiltered.map((w, idx) => {
                                        const d = daysRemaining(w.insuranceExpiry);
                                        const status = labelFor(d, !!w.insuranceExpiry);
                                        const cls = d === 0 ? 'text-red-600 font-bold' : (d !== undefined && d <= 10 ? 'text-amber-600 font-bold' : 'text-green-700 font-bold');
                                        const cat = d === 0 ? 'expired' : (d !== undefined && d <= 10 ? 'soon' : 'valid');
                                        return (
                                            <tr key={w.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2.5 text-sm font-mono text-gray-600">{w.code || '-'}</td>
                                                <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{w.name}</td>
                                                <td className="px-4 py-2.5 text-sm font-bold text-black" dir="ltr">{w.englishName || '-'}</td>
                                                <td className="px-4 py-2.5 text-sm font-mono print:whitespace-nowrap" dir="ltr">{w.insuranceExpiry}</td>
                                                <td className="px-4 py-2.5 text-sm font-mono print:whitespace-nowrap print:hidden" dir="ltr">{d === undefined ? '-' : d}</td>
                                                <td className={`px-4 py-2.5 text-sm ${cls}`}>
                                                    <span className="print:hidden">{status}</span>
                                                    <span className="hidden print:inline">{cat === 'expired' ? 'منتهية' : cat === 'soon' ? 'على وشك' : 'سارية'}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
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
                        العدد: {filteredWorkers.length}
                    </span>
                </div>
                
                {/* Creative Stats Dashboard */}
                {filteredWorkers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50/50 print:hidden border-b border-gray-100">
                    {/* Total Workers */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full transition-transform duration-500 group-hover:scale-125"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">إجمالي القوة العاملة</p>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{filteredWorkers.length}</h3>
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
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{filteredWorkers.filter((w: any) => w.assignedSiteId && w.availabilityStatus !== 'absent').length}</h3>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center transform transition-transform group-hover:rotate-6">
                                <UserCheck className="w-6 h-6" />
                            </div>
                        </div>
                         <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                                style={{ width: `${filteredWorkers.length ? (filteredWorkers.filter((w: any) => w.assignedSiteId && w.availabilityStatus !== 'absent').length / filteredWorkers.length) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-400 text-left font-mono">
                            {filteredWorkers.length ? Math.round((filteredWorkers.filter((w: any) => w.assignedSiteId && w.availabilityStatus !== 'absent').length / filteredWorkers.length) * 100) : 0}% نسبة التشغيل
                        </div>
                    </div>

                    {/* Available */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full transition-transform duration-500 group-hover:scale-125"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">جاهز للعمل</p>
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{filteredWorkers.filter((w: any) => !w.assignedSiteId && w.availabilityStatus !== 'absent').length}</h3>
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
                                <h3 className="text-3xl font-black text-gray-800 tracking-tight">{filteredWorkers.filter((w: any) => w.availabilityStatus === 'absent').length}</h3>
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
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 print:hidden flex items-center gap-4">
                                <div className="relative flex-1 max-w-md">
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="بحث عن موظف (الاسم، الرقم الوظيفي، الإقامة، الجوال، الجنسية)..." 
                                        className="block w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={workerSearchQuery}
                                        onChange={(e) => setWorkerSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                {filteredWorkers.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <p>{state.workers.length === 0 ? 'لا يوجد عمال في النظام' : 'لا توجد نتائج للبحث'}</p>
                    </div>
                ) : (
                    <>
                            {/* Iqama & Insurance Summary (Screen + Print) */}
                            <div className="px-8 pt-6 print:px-4">
                              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm print:border-2 print:border-gray-800">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between print:bg-white print:border-b-2 print:border-gray-800">
                                  <h3 className="text-lg font-bold text-gray-800">إحصائية حالة الإقامة والتأمين</h3>
                                  <div className="text-xs text-gray-500 font-bold">الإجمالي: {iqInsStats.total}</div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 print:p-3">
                                  {/* Iqama */}
                                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 print:bg-white">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-sm font-bold text-gray-700">حالة الإقامة</div>
                                      <div className="text-[11px] text-gray-500 font-mono">{iqInsStats.iqama.valid + iqInsStats.iqama.soon + iqInsStats.iqama.expired + iqInsStats.iqama.unregistered}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-green-50 text-green-700 border-green-200 print:bg-white print:text-black print:border-gray-400">ساري: {iqInsStats.iqama.valid}</span>
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-yellow-50 text-yellow-700 border-yellow-200 print:bg-white print:text-black print:border-gray-400">قريب: {iqInsStats.iqama.soon}</span>
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-red-50 text-red-700 border-red-200 print:bg-white print:text-black print:border-gray-400">منتهي: {iqInsStats.iqama.expired}</span>
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-gray-100 text-gray-700 border-gray-200 print:bg-white print:text-black print:border-gray-400">غير مسجل: {iqInsStats.iqama.unregistered}</span>
                                    </div>
                                  </div>
                                  {/* Insurance */}
                                  <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 print:bg-white">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-sm font-bold text-gray-700">حالة التأمين</div>
                                      <div className="text-[11px] text-gray-500 font-mono">{iqInsStats.insurance.valid + iqInsStats.insurance.soon + iqInsStats.insurance.expired + iqInsStats.insurance.unregistered}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-green-50 text-green-700 border-green-200 print:bg-white print:text-black print:border-gray-400">ساري: {iqInsStats.insurance.valid}</span>
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-yellow-50 text-yellow-700 border-yellow-200 print:bg-white print:text-black print:border-gray-400">قريب: {iqInsStats.insurance.soon}</span>
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-red-50 text-red-700 border-red-200 print:bg-white print:text-black print:border-gray-400">منتهي: {iqInsStats.insurance.expired}</span>
                                      <span className="px-2.5 py-1 rounded-full border text-[11px] font-bold bg-gray-100 text-gray-700 border-gray-200 print:bg-white print:text-black print:border-gray-400">غير مسجل: {iqInsStats.insurance.unregistered}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

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
                                        {filteredWorkers.map((w: any, idx: number) => {
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
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5 print:whitespace-nowrap" dir="ltr">{w.iqamaExpiry}</td>
                                                    <td className={`px-4 py-2.5 border-b border-gray-200 whitespace-nowrap ${getStatusColor(insDays)} print:px-1 print:py-0.5`}>
                                                        {labelFor(insDays, !!w.insuranceExpiry)}
                                                    </td>
                                                    <td className="px-4 py-2.5 border-b border-gray-200 whitespace-nowrap font-mono text-gray-700 print:px-1 print:py-0.5 print:whitespace-nowrap" dir="ltr">{w.insuranceExpiry}</td>
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
                                {filteredWorkers.map((w: any, idx: number) => {
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
                                                    <span className={'font-mono print:whitespace-nowrap ' + getStatusColor(iqDays)}>{w.iqamaExpiry}</span>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">حالة التأمين:</span>
                                                    <span className={getStatusColor(insDays)}>{labelFor(insDays, !!w.insuranceExpiry)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">انتهاء التأمين:</span>
                                                    <span className="font-mono print:whitespace-nowrap">{w.insuranceExpiry}</span>
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
