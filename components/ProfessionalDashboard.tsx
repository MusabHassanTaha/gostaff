'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/state/AuthContext';
import { useAppState } from '@/components/state/AppStateContext';
import { Worker, SkillDefinition, Site, Notification } from '@/types';
import { 
  Users, 
  Briefcase, 
  Clock, 
  AlertCircle, 
  Search, 
  Calendar, 
  Filter, 
  ChevronRight, 
  ChevronLeft,
  Plane,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Printer,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Save,
  X,
  Wand2
} from 'lucide-react';

import { utils, writeFile } from 'xlsx';

// Helper to calculate days difference
const getDaysDiff = (dateStr: string) => {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
};

// Helper to calculate absence days in current month
const getMonthAbsenceCount = (worker: Worker) => {
    if (!worker.absenceHistory || worker.absenceHistory.length === 0) return 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return worker.absenceHistory.filter(h => {
        const d = new Date(h.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
};

// --- Sub-components ---

const StatCard = ({ title, value, icon: Icon, colorClass, subText }: any) => (
  <div className={`bg-white p-4 rounded-xl shadow-sm border-r-4 ${colorClass} flex items-center justify-between`}>
    <div>
      <p className="text-gray-500 text-xs font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
      {subText && <p className="text-xs text-gray-400 mt-1">{subText}</p>}
    </div>
    <div className={`p-3 rounded-full opacity-10 ${colorClass.replace('border-', 'bg-')}`}>
      <Icon className={`w-6 h-6 ${colorClass.replace('border-', 'text-')}`} />
    </div>
  </div>
);

const Badge = ({ status }: { status: string }) => {
  let classes = 'bg-gray-100 text-gray-800';
  let label = status;
  let Icon = null;

  if (status === 'waiting' || status === 'available') {
    classes = 'bg-blue-100 text-blue-800';
    label = 'انتظار';
    Icon = Clock;
  } else if (status === 'rest') {
    classes = 'bg-yellow-100 text-yellow-800';
    label = 'إجازة';
    Icon = Plane;
  } else if (status === 'absent') {
    classes = 'bg-red-100 text-red-800';
    label = 'غياب';
    Icon = XCircle;
  } else if (status === 'active') {
    classes = 'bg-green-100 text-green-800';
    label = 'نشط';
    Icon = Briefcase;
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${classes}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
};

// Helper for Circular Chart
const CircleChart = ({ value, total, color, label, subLabel }: { value: number, total: number, color: string, label: string, subLabel?: string }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (value / total) : 0;
  const dash = percentage * circumference;
  
  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Background Circle */}
          <svg width="100%" height="100%" className="transform -rotate-90 drop-shadow-md">
              <circle cx="64" cy="64" r={radius} stroke="#f3f4f6" strokeWidth="8" fill="none" />
              <circle 
                  cx="64" 
                  cy="64" 
                  r={radius} 
                  stroke={color} 
                  strokeWidth="8" 
                  fill="none" 
                  strokeDasharray={`${dash} ${circumference}`} 
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
              />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-800">{value}</span>
              <span className="text-xs text-gray-500">من {total}</span>
          </div>
      </div>
      <div className="mt-2 text-center">
          <div className="font-bold text-gray-700 text-sm">{label}</div>
          {subLabel && <div className="text-xs text-gray-500">{subLabel}</div>}
      </div>
    </div>
  );
};

// --- Main Component ---

function calculateRemainingLeaves(joiningDate: string | Date, totalLeavesTaken = 0) {
    const today = new Date();
    const start = new Date(joiningDate);
    
    // حساب الفرق بالسنوات بدقة
    const diffInMs = today.getTime() - start.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    const totalYears = diffInDays / 365.25;

    let totalEarned = 0;

    if (totalYears < 5) {
        // إذا كان الموظف يعمل منذ أقل من 5 سنوات
        totalEarned = totalYears * 21;
    } else {
        // أول 5 سنوات تُحسب على أساس 21 يوم، وما زاد عنها على أساس 30 يوم
        const firstFiveYears = 5 * 21;
        const remainingYears = totalYears - 5;
        totalEarned = firstFiveYears + (remainingYears * 30);
    }

    // الرصيد المتبقي = الإجمالي المكتسب - ما تم استهلاكه
    const balance = totalEarned - totalLeavesTaken;
    
    return Math.floor(balance); // إرجاع الرقم الصحيح للأيام
}

export default function ProfessionalDashboard() {
  const { state: globalState, setState, cancelAbsence, deleteAbsence, updateAbsence, deleteLeave, updateLeave } = useAppState();
  const { user } = useAuth();
  const router = useRouter();
  // Notifications moved to Dashboard.tsx header
  
  const state = useMemo(() => {
    if (user?.role === 'engineer') {
        const engineerWorker = globalState.workers.find(w => w.name === user.username && w.isEngineer);
        if (engineerWorker) {
            const visibleSites = globalState.sites.filter(s => s.engineerId === engineerWorker.id);
            const mySiteIds = new Set(visibleSites.map(s => s.id));
            const visibleWorkerIds = new Set(visibleSites.flatMap(s => s.assignedWorkerIds || []));
            const visibleWorkers = globalState.workers.filter(w => 
                (w.assignedSiteId && mySiteIds.has(w.assignedSiteId)) || 
                visibleWorkerIds.has(w.id) ||
                w.id === engineerWorker.id
            );
            return {
                ...globalState,
                sites: visibleSites,
                workers: visibleWorkers
            };
        } else {
             return { ...globalState, sites: [], workers: [] };
        }
    }
    return globalState;
  }, [globalState, user]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'waiting' | 'rest' | 'absent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSkillForStats, setSelectedSkillForStats] = useState<SkillDefinition | null>(null);
  const [selectedWorkerStatusForStats, setSelectedWorkerStatusForStats] = useState<'assigned' | 'waiting' | 'absent' | 'rest' | null>(null);
  const [selectedProjectStatusForStats, setSelectedProjectStatusForStats] = useState<'active' | 'stopped' | 'completed' | null>(null);

  // --- Local States for Logs ---
  const [absenceSearch, setAbsenceSearch] = useState('');
  const [absenceDateRange, setAbsenceDateRange] = useState({ start: '', end: '' });
  
  const [leaveSearch, setLeaveSearch] = useState('');
  const [leaveDateRange, setLeaveDateRange] = useState({ start: '', end: '' });

  // --- Editing State ---
  const [editingAbsence, setEditingAbsence] = useState<{ workerId: string, oldDate: string, newDate: string, reason: string } | null>(null);
  const [editingLeave, setEditingLeave] = useState<{ workerId: string, oldStartDate: string, startDate: string, endDate: string, type: 'annual' | 'sick' | 'emergency' | 'other', notes: string } | null>(null);

  // --- Advanced Statistics ---
  const stats = useMemo(() => {
    const totalWorkers = state.workers.length;
    
    // Workers Status
    const availableWorkers = state.workers.filter(w => !w.assignedSiteId).length;
    const assignedWorkers = totalWorkers - availableWorkers;
    
    const waitingCount = state.workers.filter(w => !w.assignedSiteId && (w.availabilityStatus === 'waiting' || w.availabilityStatus === 'available' || !w.availabilityStatus)).length;
    const absentCount = state.workers.filter(w => !w.assignedSiteId && w.availabilityStatus === 'absent').length;
    const restCount = state.workers.filter(w => !w.assignedSiteId && w.availabilityStatus === 'rest').length;
    
    // Projects Status
    const totalProjects = state.sites.length;
    const activeProjects = state.sites.filter(s => s.status === 'active' || (!s.status && (s.assignedWorkerIds || []).length > 0)).length;
    const stoppedProjects = state.sites.filter(s => s.status === 'stopped').length;
    const completedProjects = state.sites.filter(s => s.status === 'completed').length;

    // Skills Distribution
    const bySkill = state.skills.map(sk => ({
        ...sk,
        count: state.workers.filter(w => w.skill === sk.name).length
    })).filter(e => e.count > 0).sort((a, b) => b.count - a.count);

    return {
        workers: { total: totalWorkers, assigned: assignedWorkers, waiting: waitingCount, absent: absentCount, rest: restCount },
        projects: { total: totalProjects, active: activeProjects, stopped: stoppedProjects, completed: completedProjects },
        skills: bySkill
    };
  }, [state.workers, state.sites, state.skills]);


  // --- Filtered Data ---
  const filteredWorkers = useMemo(() => {
    return state.workers.filter(w => {
      // 1. Search Filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = w.name.toLowerCase().includes(q) || 
                        w.phone.includes(q) || 
                        (w.code && w.code.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Helper for Date Check
      const checkDate = (dateStr: string | undefined) => {
        if (!dateStr) return false;
        if (!dateRange.start && !dateRange.end) return true;
        
        const d = new Date(dateStr);
        d.setHours(0,0,0,0);
        
        if (dateRange.start) {
            const start = new Date(dateRange.start);
            start.setHours(0,0,0,0);
            if (d < start) return false;
        }
        if (dateRange.end) {
            const end = new Date(dateRange.end);
            end.setHours(23,59,59,999);
            const dEnd = new Date(dateStr); // Use full time for end comparison if needed, or just day
            dEnd.setHours(0,0,0,0);
            if (dEnd > end) return false;
        }
        return true;
      };

      // 2. Status & Date Logic (Strict Separation)
      if (filterStatus === 'absent') {
          if (w.availabilityStatus !== 'absent') return false;
          if (dateRange.start || dateRange.end) {
              return checkDate(w.absentSince);
          }
          return true;
      }

      if (filterStatus === 'waiting') {
          if (w.assignedSiteId) return false;
          if (w.availabilityStatus === 'absent' || w.availabilityStatus === 'rest') return false;
          if (w.availabilityStatus && w.availabilityStatus !== 'waiting' && w.availabilityStatus !== 'available') return false;
          
          if (dateRange.start || dateRange.end) {
              return checkDate(w.waitingSince);
          }
          return true;
      }

      if (filterStatus === 'rest') {
          if (w.availabilityStatus !== 'rest') return false;
          if (dateRange.start || dateRange.end) {
              const lastLeave = w.leaveHistory?.[w.leaveHistory.length - 1];
              return checkDate(lastLeave?.startDate);
          }
          return true;
      }

      // If Status is ALL, use dynamic date selection
      if (dateRange.start || dateRange.end) {
        let dateToCheck = w.waitingSince;
        if (w.availabilityStatus === 'absent') dateToCheck = w.absentSince;
        else if (w.availabilityStatus === 'rest') {
            dateToCheck = w.leaveHistory?.[w.leaveHistory.length - 1]?.startDate;
        }
        return checkDate(dateToCheck);
      }

      return true;
    });
  }, [state.workers, filterStatus, searchQuery, dateRange]);

  // --- Standby List (Right Sidebar) ---
  const standbyWorkers = useMemo(() => {
    return state.workers.filter(w => !w.assignedSiteId && (w.availabilityStatus === 'waiting' || w.availabilityStatus === 'available' || !w.availabilityStatus));
  }, [state.workers]);

  // --- Filtered Absence Logs (Local) ---
  const filteredAbsenceLogs = useMemo(() => {
    const absences: { workerName: string; workerId: string; date: string; dayName: string }[] = [];
    const now = new Date();
    
    // Check if filtering by date range
    const isDateFilterActive = absenceDateRange.start || absenceDateRange.end;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    state.workers.forEach(w => {
        // --- Filter Logic (Local) ---
        // 1. Search Query
        if (absenceSearch) {
            const q = absenceSearch.toLowerCase();
            const matches = w.name.toLowerCase().includes(q) || 
                            w.phone.includes(q) || 
                            (w.code && w.code.toLowerCase().includes(q));
            if (!matches) return;
        }

        if (w.absenceHistory) {
            w.absenceHistory.forEach(h => {
                const d = new Date(h.date);
                let include = false;

                if (isDateFilterActive) {
                    const dateTimestamp = d.getTime();
                    const startTimestamp = absenceDateRange.start ? new Date(absenceDateRange.start).setHours(0, 0, 0, 0) : -Infinity;
                    // Set end date to end of day to include the full day
                    const endTimestamp = absenceDateRange.end ? new Date(absenceDateRange.end).setHours(23, 59, 59, 999) : Infinity;
                    
                    if (dateTimestamp >= startTimestamp && dateTimestamp <= endTimestamp) {
                        include = true;
                    }
                } else {
                    // Default: Current Month
                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        include = true;
                    }
                }

                if (include) {
                    absences.push({
                        workerName: w.name,
                        workerId: w.id,
                        date: h.date,
                        dayName: d.toLocaleDateString('ar-EG', { weekday: 'long' })
                    });
                }
            });
        }
    });
    return absences.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.workers, absenceDateRange, absenceSearch]);

  // Group absences by worker for display
  const groupedAbsences = useMemo(() => {
    const groups: { [key: string]: { workerId: string; workerName: string; count: number; logs: typeof filteredAbsenceLogs } } = {};
    
    filteredAbsenceLogs.forEach(log => {
      if (!groups[log.workerId]) {
        groups[log.workerId] = {
          workerId: log.workerId,
          workerName: log.workerName,
          count: 0,
          logs: []
        };
      }
      groups[log.workerId].logs.push(log);
      groups[log.workerId].count++;
    });
    
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [filteredAbsenceLogs]);

  // --- Filtered Leave Logs (Local) ---
  const filteredLeaveLogs = useMemo(() => {
      const leaves: { 
          workerName: string; 
          workerId: string; 
          startDate: string; 
          endDate: string;
          type: string;
          duration: number; // Total duration of leave
          effectiveDuration: number; // Duration within filtered period
      }[] = [];

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const filterStart = leaveDateRange.start ? new Date(leaveDateRange.start) : new Date(currentYear, currentMonth, 1);
      filterStart.setHours(0,0,0,0);
      
      const filterEnd = leaveDateRange.end ? new Date(leaveDateRange.end) : new Date(currentYear, currentMonth + 1, 0);
      filterEnd.setHours(23,59,59,999);

      state.workers.forEach(w => {
           // 1. Search Query
           if (leaveSearch) {
              const q = leaveSearch.toLowerCase();
              const matches = w.name.toLowerCase().includes(q) || 
                              w.phone.includes(q) || 
                              (w.code && w.code.toLowerCase().includes(q));
              if (!matches) return;
          }

          if (w.leaveHistory) {
              w.leaveHistory.forEach(l => {
                  const start = new Date(l.startDate);
                  const end = new Date(l.endDate);
                  start.setHours(0,0,0,0);
                  end.setHours(23,59,59,999);

                  // Check overlap
                  // Overlap if (StartA <= EndB) and (EndA >= StartB)
                  if (start <= filterEnd && end >= filterStart) {
                      
                      // Calculate effective duration (intersection)
                      const effectiveStart = start < filterStart ? filterStart : start;
                      const effectiveEnd = end > filterEnd ? filterEnd : end;
                      
                      const diffTime = Math.abs(effectiveEnd.getTime() - effectiveStart.getTime());
                      const effectiveDuration = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                      const totalDiff = Math.abs(end.getTime() - start.getTime());
                      const totalDuration = Math.floor(totalDiff / (1000 * 60 * 60 * 24));

                      leaves.push({
                          workerName: w.name,
                          workerId: w.id,
                          startDate: l.startDate,
                          endDate: l.endDate,
                          type: l.type,
                          duration: totalDuration,
                          effectiveDuration: effectiveDuration > 0 ? effectiveDuration : 0
                      });
                  }
              });
          }
      });
      return leaves.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [state.workers, leaveDateRange, leaveSearch]);

  // Group leaves by worker
  const groupedLeaves = useMemo(() => {
    const groups: { [key: string]: { workerId: string; workerName: string; totalEffectiveDays: number; remainingLeaves: number; logs: typeof filteredLeaveLogs } } = {};
    
    filteredLeaveLogs.forEach(log => {
      if (!groups[log.workerId]) {
        // Find worker to calculate remaining leaves
        const worker = state.workers.find(w => w.id === log.workerId);
        let remaining = 0;
        if (worker && worker.hireDate) {
             // Calculate total leaves taken from history
             let totalTaken = 0;
             if (worker.leaveHistory) {
                 worker.leaveHistory.forEach(l => {
                     const s = new Date(l.startDate);
                     const e = new Date(l.endDate);
                     const diff = Math.abs(e.getTime() - s.getTime());
                     const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                     totalTaken += days;
                 });
             }
             remaining = calculateRemainingLeaves(worker.hireDate, totalTaken);
        }

        groups[log.workerId] = {
          workerId: log.workerId,
          workerName: log.workerName,
          totalEffectiveDays: 0,
          remainingLeaves: remaining,
          logs: []
        };
      }
      groups[log.workerId].logs.push(log);
      groups[log.workerId].totalEffectiveDays += log.effectiveDuration;
    });
    
    return Object.values(groups).sort((a, b) => b.totalEffectiveDays - a.totalEffectiveDays);
  }, [filteredLeaveLogs, state.workers]);

  // Helper to calculate total absence days for a worker within the filtered period
  const getWorkerPeriodAbsenceCount = (workerId: string) => {
    return filteredAbsenceLogs.filter(log => log.workerId === workerId).length;
  };

    // --- Absence Log Export Functions ---
    const handleExportAbsenceLogExcel = () => {
        // Prepare data with sequence number
        const data = filteredAbsenceLogs.map((log, index) => ({
            '#': index + 1,
            'التاريخ': new Date(log.date).toLocaleDateString('en-GB'),
            'اليوم': log.dayName,
            'اسم العامل': log.workerName
        }));

        // Create a new workbook
        const wb = utils.book_new();
        const ws = utils.json_to_sheet([], { origin: "A5" } as any); // Start data from row 5

        // Add Header Info
        const headerData = [
            [`الفترة: ${absenceDateRange.start || 'البداية'} إلى ${absenceDateRange.end || 'النهاية'}`],
            [`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`],
            [`إجمالي أيام الغياب: ${filteredAbsenceLogs.length}`]
        ];
        utils.sheet_add_aoa(ws, headerData, { origin: "A1" });

        // Add Data with Headers
        utils.sheet_add_json(ws, data, { origin: "A5" });

        utils.book_append_sheet(wb, ws, "سجل الغياب");
        writeFile(wb, `Absence_Log_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handlePrintAbsenceLog = () => {
         // Group absences by worker for the report
        const groups: { [key: string]: { workerId: string; workerName: string; count: number; logs: typeof filteredAbsenceLogs } } = {};
        filteredAbsenceLogs.forEach(log => {
            if (!groups[log.workerId]) {
                groups[log.workerId] = { workerId: log.workerId, workerName: log.workerName, count: 0, logs: [] };
            }
            groups[log.workerId].logs.push(log);
            groups[log.workerId].count++;
        });
        const sortedGroups = Object.values(groups).sort((a, b) => b.count - a.count);


        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html dir="rtl">
                    <head>
                        <title>سجل الغياب</title>
                        <link rel="preconnect" href="https://fonts.googleapis.com">
                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                        <style>
                            body { font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                            h1 { text-align: center; color: #333; margin-bottom: 15px; font-family: 'Cairo', sans-serif; font-weight: 700; font-size: 32px; }
                            .meta { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 14px; color: #555; }
                            .meta div { margin-bottom: 5px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 13px; }
                            th { bg-color: #f2f2f2; font-weight: bold; }
                            .worker-section { margin-bottom: 20px; page-break-inside: avoid; border: 1px solid #eee; padding: 10px; border-radius: 5px; }
                            .worker-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; background: #f9f9f9; padding: 5px; }
                        </style>
                    </head>
                    <body>
                        <h1>تقرير الغياب</h1>
                        <div class="meta">
                            <div>الفترة: ${absenceDateRange.start || 'البداية'} إلى ${absenceDateRange.end || 'النهاية'}</div>
                            <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</div>
                            <div>إجمالي عدد الأيام: ${filteredAbsenceLogs.length}</div>
                        </div>

                        ${sortedGroups.map(group => `
                            <div class="worker-section">
                                <div class="worker-header">
                                    <span>${group.workerName}</span>
                                    <span>عدد الأيام: ${group.count}</span>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>التاريخ</th>
                                            <th>اليوم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${group.logs.map((log, idx) => `
                                            <tr>
                                                <td>${idx + 1}</td>
                                                <td>${new Date(log.date).toLocaleDateString('ar-EG')}</td>
                                                <td>${log.dayName}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `).join('')}

                        <script>window.print();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    // --- Leave Log Export Functions ---
    const handleExportLeaveLogExcel = () => {
        // Prepare data
        const data = filteredLeaveLogs.map((log, index) => {
            const group = groupedLeaves.find(g => g.workerId === log.workerId);
            const remaining = group ? group.remainingLeaves : 0;
            return {
                '#': index + 1,
                'اسم العامل': log.workerName,
                'نوع الإجازة': log.type === 'annual' ? 'سنوية' : (log.type === 'sick' ? 'مرضية' : 'أخرى'),
                'تاريخ البداية': new Date(log.startDate).toLocaleDateString('ar-EG'),
                'تاريخ النهاية': new Date(log.endDate).toLocaleDateString('ar-EG'),
                'المدة (أيام)': log.duration,
                'المستهلك': log.effectiveDuration,
                'المتبقي': remaining
            };
        });

        const wb = utils.book_new();
        const ws = utils.json_to_sheet([], { origin: "A5" } as any);

        const headerData = [
            ["تقرير سجل الإجازات"],
            [`الفترة: ${leaveDateRange.start || 'البداية'} إلى ${leaveDateRange.end || 'النهاية'}`],
            [`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`],
            [`إجمالي أيام الإجازة في الفترة: ${groupedLeaves.reduce((acc, g) => acc + g.totalEffectiveDays, 0)}`]
        ];
        utils.sheet_add_aoa(ws, headerData, { origin: "A1" });
        utils.sheet_add_json(ws, data, { origin: "A5" });

        utils.book_append_sheet(wb, ws, "سجل الإجازات");
        writeFile(wb, `Leave_Log_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handlePrintLeaveLog = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html dir="rtl">
                    <head>
                        <title>تقرير سجل الإجازات</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
                            h1 { text-align: center; color: #333; margin-bottom: 10px; }
                            .meta { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 14px; color: #555; }
                            .meta div { margin-bottom: 5px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 13px; }
                            th { bg-color: #f2f2f2; font-weight: bold; }
                            .worker-section { margin-bottom: 20px; page-break-inside: avoid; border: 1px solid #eee; padding: 10px; border-radius: 5px; }
                            .worker-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; background: #f9f9f9; padding: 5px; }
                        </style>
                    </head>
                    <body>
                        <h1>تقرير سجل الإجازات</h1>
                        <div class="meta">
                            <div>الفترة: ${leaveDateRange.start || 'البداية'} إلى ${leaveDateRange.end || 'النهاية'}</div>
                            <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</div>
                            <div>إجمالي الأيام: ${groupedLeaves.reduce((acc, g) => acc + g.totalEffectiveDays, 0)}</div>
                        </div>

                        ${groupedLeaves.map(group => `
                            <div class="worker-section">
                                <div class="worker-header">
                                    <span>${group.workerName}</span>
                                    <span>
                                        <span>إجمالي في الفترة: ${group.totalEffectiveDays} يوم</span>
                                    </span>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>النوع</th>
                                            <th>من</th>
                                            <th>إلى</th>
                                            <th>المدة الكلية</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${group.logs.map((log, idx) => `
                                            <tr>
                                                <td>${idx + 1}</td>
                                                <td>${log.type === 'annual' ? 'سنوية' : (log.type === 'sick' ? 'مرضية' : 'أخرى')}</td>
                                                <td>${new Date(log.startDate).toLocaleDateString('ar-EG')}</td>
                                                <td>${new Date(log.endDate).toLocaleDateString('ar-EG')}</td>
                                                <td>${log.duration} يوم</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `).join('')}

                        <script>window.print();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    // --- Edit Handlers ---
    const handleSaveAbsence = () => {
        if (!editingAbsence) return;
        updateAbsence(editingAbsence.workerId, editingAbsence.oldDate, editingAbsence.newDate, editingAbsence.reason);
        setEditingAbsence(null);
    };

    const handleSaveLeave = () => {
        if (!editingLeave) return;
        updateLeave(editingLeave.workerId, editingLeave.oldStartDate, {
            startDate: editingLeave.startDate,
            endDate: editingLeave.endDate,
            type: editingLeave.type,
            notes: editingLeave.notes
        });
        setEditingLeave(null);
    };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50" dir="rtl">
      
      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        
        {/* Header & Stats */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">لوحة المعلومات</h1>
            
             {/* Notification Bell Moved to Dashboard Header */}
          </div>
           {/* New Professional Stats Dashboard */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
             
             {/* 1. Workers Stats */}
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">إحصائيات العمال</h3>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Users className="w-5 h-5" />
                    </div>
                </div>
                
                <div className="flex items-center justify-between">
                    <CircleChart 
                        value={stats.workers.assigned} 
                        total={stats.workers.total} 
                        color="#2563eb" 
                        label="تم التوزيع"
                        subLabel={`${Math.round((stats.workers.assigned / stats.workers.total) * 100 || 0)}%`}
                    />
                    
                    <div className="flex-1 mr-4 space-y-3">
                        <button 
                            onClick={() => setSelectedWorkerStatusForStats('assigned')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500"></span>موظف</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-blue-600">{stats.workers.assigned}</span>
                        </button>
                        <button 
                            onClick={() => setSelectedWorkerStatusForStats('waiting')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-yellow-600"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>انتظار</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-yellow-600">{stats.workers.waiting}</span>
                        </button>
                        <button 
                            onClick={() => setSelectedWorkerStatusForStats('absent')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-red-600"><span className="w-2 h-2 rounded-full bg-red-500"></span>غياب</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-red-600">{stats.workers.absent}</span>
                        </button>
                         <button 
                            onClick={() => setSelectedWorkerStatusForStats('rest')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span>إجازة</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-green-600">{stats.workers.rest}</span>
                        </button>
                    </div>
                </div>
             </div>

             {/* 2. Projects Stats */}
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">إحصائيات المشاريع</h3>
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                        <Briefcase className="w-5 h-5" />
                    </div>
                </div>
                
                <div className="flex items-center justify-between">
                    <CircleChart 
                        value={stats.projects.active} 
                        total={stats.projects.total} 
                        color="#f97316" 
                        label="نشطة"
                        subLabel={`${Math.round((stats.projects.active / stats.projects.total) * 100 || 0)}%`}
                    />
                    
                    <div className="flex-1 mr-4 space-y-3">
                        <button 
                            onClick={() => setSelectedProjectStatusForStats('active')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-orange-600"><span className="w-2 h-2 rounded-full bg-orange-500"></span>نشطة</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-orange-600">{stats.projects.active}</span>
                        </button>
                        <button 
                            onClick={() => setSelectedProjectStatusForStats('stopped')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-red-600"><span className="w-2 h-2 rounded-full bg-red-500"></span>متوقفة</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-red-600">{stats.projects.stopped}</span>
                        </button>
                        <button 
                            onClick={() => setSelectedProjectStatusForStats('completed')}
                            className="flex justify-between items-center text-sm w-full hover:bg-gray-50 p-1 rounded transition-colors group/btn"
                        >
                            <span className="text-gray-500 flex items-center gap-1 group-hover/btn:text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500"></span>مكتملة</span>
                            <span className="font-bold text-gray-800 group-hover/btn:text-blue-600">{stats.projects.completed}</span>
                        </button>
                    </div>
                </div>
             </div>

             {/* 3. Skills Stats */}
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">توزيع المهن</h3>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <Wand2 className="w-5 h-5" />
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto custom-scrollbar content-start">
                    {stats.skills.map((skill) => (
                        <button 
                            key={skill.id} 
                            onClick={() => setSelectedSkillForStats(skill)}
                            className={`text-xs px-2 py-1 rounded-full border ${skill.color} hover:brightness-95 transition-all cursor-pointer flex items-center gap-1 shadow-sm`}
                        >
                            <span className="font-bold">{skill.count}</span>
                            <span>{skill.label}</span>
                        </button>
                    ))}
                    {stats.skills.length === 0 && (
                        <div className="text-center text-gray-400 py-4 w-full">لا توجد بيانات</div>
                    )}
                </div>
             </div>

           </div>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative">
               <Filter className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
               <select 
                 className="pr-10 pl-4 py-2 border rounded-lg w-full md:w-48 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                 value={filterStatus}
                 onChange={(e) => setFilterStatus(e.target.value as any)}
               >
                 <option value="all">كل الحالات</option>
                 <option value="waiting">انتظار</option>
                 <option value="rest">إجازة</option>
                 <option value="absent">غياب</option>
               </select>
            </div>
          </div>

          <div className="relative w-full md:w-1/2">
            <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="بحث باسم العامل..." 
              className="pr-10 pl-10 py-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="مسح البحث"
              >
                  <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Detailed Record Table Removed */}

        {/* Visualizations Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Absence Log Visualization - With Local Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm h-[600px] flex flex-col">
                <div className="border-b pb-4 mb-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">سجل الغياب</span>
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {filteredAbsenceLogs.length} يوم
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <button 
                                onClick={handleExportAbsenceLogExcel}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors flex items-center gap-1 text-xs"
                                title="تصدير Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={handlePrintAbsenceLog}
                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors flex items-center gap-1 text-xs"
                                title="طباعة / PDF"
                            >
                                <Printer className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Local Filters */}
                    <div className="flex flex-col gap-2">
                         <div className="relative">
                            <Search className="absolute right-2 top-2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="بحث..." 
                                className="pr-8 pl-8 py-1.5 text-sm border rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={absenceSearch}
                                onChange={(e) => setAbsenceSearch(e.target.value)}
                            />
                            {absenceSearch && (
                                <button 
                                    onClick={() => setAbsenceSearch('')}
                                    className="absolute left-2 top-2 text-gray-400 hover:text-red-500"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                                value={absenceDateRange.start}
                                onChange={(e) => setAbsenceDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="date" 
                                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                                value={absenceDateRange.end}
                                onChange={(e) => setAbsenceDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                            {(absenceDateRange.start || absenceDateRange.end) && (
                                <button 
                                    onClick={() => setAbsenceDateRange({ start: '', end: '' })}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-1 space-y-3 custom-scrollbar">
                    {groupedAbsences.map((group) => (
                        <div key={group.workerId} className="bg-gray-50 border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
                                <Link href={`/workers?search=${encodeURIComponent(group.workerName)}`} className="font-bold text-gray-800 hover:text-blue-600 transition-colors text-sm">
                                    {group.workerName}
                                </Link>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                                    {group.count} أيام
                                </span>
                            </div>
                            <div className="space-y-1">
                                {group.logs.map((log, idx) => {
                                    const isEditing = editingAbsence && editingAbsence.workerId === group.workerId && editingAbsence.oldDate === log.date;
                                    return (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-white p-1.5 rounded border border-gray-100 group/item">
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 w-full">
                                                <input 
                                                    type="date" 
                                                    className="flex-1 border rounded px-1 py-0.5 text-xs"
                                                    value={editingAbsence.newDate}
                                                    onChange={(e) => setEditingAbsence(prev => prev ? {...prev, newDate: e.target.value} : null)}
                                                />
                                                <button onClick={handleSaveAbsence} className="text-green-600 hover:text-green-700 p-1">
                                                    <Save className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => setEditingAbsence(null)} className="text-gray-400 hover:text-gray-500 p-1">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-600 font-medium">{log.dayName}</span>
                                                    <span className="text-xs text-black font-bold mt-0.5 block">{new Date(log.date).toLocaleDateString('en-GB')}</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => setEditingAbsence({ workerId: group.workerId, oldDate: log.date, newDate: log.date, reason: '' })}
                                                        className="text-blue-500 hover:bg-blue-50 p-1 rounded"
                                                        title="تعديل"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm('هل أنت متأكد من حذف هذا الغياب؟')) {
                                                                deleteAbsence(group.workerId, log.date);
                                                            }
                                                        }}
                                                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )})}
                            </div>
                        </div>
                    ))}
                    {groupedAbsences.length === 0 && (
                        <div className="text-center text-gray-400 py-8 flex flex-col items-center gap-2 h-full justify-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                                <Users className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium">لا توجد غيابات مسجلة</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Leave Log Visualization - With Local Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm h-[600px] flex flex-col">
                 <div className="border-b pb-4 mb-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">سجل الإجازات</span>
                             <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {groupedLeaves.reduce((acc, g) => acc + g.totalEffectiveDays, 0)} يوم
                            </span>
                        </div>
                        <div className="flex gap-1">
                             <button 
                                onClick={handleExportLeaveLogExcel}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors flex items-center gap-1 text-xs"
                                title="تصدير Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={handlePrintLeaveLog}
                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors flex items-center gap-1 text-xs"
                                title="طباعة / PDF"
                            >
                                <Printer className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Local Filters */}
                    <div className="flex flex-col gap-2">
                         <div className="relative">
                            <Search className="absolute right-2 top-2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="بحث..." 
                                className="pr-8 pl-8 py-1.5 text-sm border rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={leaveSearch}
                                onChange={(e) => setLeaveSearch(e.target.value)}
                            />
                            {leaveSearch && (
                                <button 
                                    onClick={() => setLeaveSearch('')}
                                    className="absolute left-2 top-2 text-gray-400 hover:text-red-500"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                                value={leaveDateRange.start}
                                onChange={(e) => setLeaveDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="date" 
                                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none"
                                value={leaveDateRange.end}
                                onChange={(e) => setLeaveDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                            {(leaveDateRange.start || leaveDateRange.end) && (
                                <button 
                                    onClick={() => setLeaveDateRange({ start: '', end: '' })}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-1 space-y-3 custom-scrollbar">
                     {groupedLeaves.map(group => (
                        <div key={group.workerId} className="bg-gray-50 border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
                                <Link href={`/workers?search=${encodeURIComponent(group.workerName)}`} className="font-bold text-gray-800 hover:text-blue-600 transition-colors text-sm">
                                    {group.workerName}
                                </Link>
                                <div className="flex gap-1">
{/* Remaining removed */}
                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">
                                        {group.totalEffectiveDays} يوم
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                {group.logs.map((log, idx) => {
                                    const isEditing = editingLeave && editingLeave.workerId === group.workerId && editingLeave.oldStartDate === log.startDate;
                                    return (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-white p-1.5 rounded border border-gray-100 group/item">
                                        {isEditing ? (() => {
                                            // Live Calculator Logic
                                            let liveStats = { total: 0, consumed: 0, remaining: 0, currentDuration: 0 };
                                            const worker = state.workers.find(w => w.id === group.workerId);
                                            if (worker && worker.hireDate) {
                                                const totalBalance = calculateRemainingLeaves(worker.hireDate, 0);
                                                let otherConsumed = 0;
                                                if (worker.leaveHistory) {
                                                    worker.leaveHistory.forEach(l => {
                                                        if (l.startDate !== editingLeave.oldStartDate) {
                                                            const s = new Date(l.startDate);
                                                            const e = new Date(l.endDate);
                                                            const diff = Math.abs(e.getTime() - s.getTime());
                                                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                            otherConsumed += days;
                                                        }
                                                    });
                                                }
                                                let currentDuration = 0;
                                                if (editingLeave.startDate && editingLeave.endDate) {
                                                    const s = new Date(editingLeave.startDate);
                                                    const e = new Date(editingLeave.endDate);
                                                    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                                                        const diff = Math.abs(e.getTime() - s.getTime());
                                                        currentDuration = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                    }
                                                }
                                                liveStats = {
                                                    total: totalBalance,
                                                    consumed: otherConsumed + currentDuration,
                                                    remaining: totalBalance - (otherConsumed + currentDuration),
                                                    currentDuration
                                                };
                                            }

                                            return (
                                            <div className="flex flex-col gap-2 w-full p-2 bg-blue-50 rounded border border-blue-100 shadow-sm">
                                                {/* Live Stats Header */}
                                                <div className="flex justify-between items-center bg-white p-2 rounded border border-blue-100 mb-1">
{/* Labels removed */}
{/* Remaining removed */}
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] text-gray-500 mb-0.5">من</label>
                                                        <input 
                                                            type="date" 
                                                            className="w-full border rounded px-1 py-0.5 text-xs"
                                                            value={editingLeave.startDate}
                                                            onChange={(e) => setEditingLeave(prev => prev ? {...prev, startDate: e.target.value} : null)}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] text-gray-500 mb-0.5">إلى</label>
                                                        <input 
                                                            type="date" 
                                                            className="w-full border rounded px-1 py-0.5 text-xs"
                                                            value={editingLeave.endDate}
                                                            onChange={(e) => setEditingLeave(prev => prev ? {...prev, endDate: e.target.value} : null)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-center text-[10px] text-blue-600 font-medium">
                                                    مدة الإجازة: {liveStats.currentDuration} يوم
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <select 
                                                        className="flex-1 border rounded px-1 py-0.5 text-xs"
                                                        value={editingLeave.type}
                                                        onChange={(e) => setEditingLeave(prev => prev ? {...prev, type: e.target.value as any} : null)}
                                                    >
                                                        <option value="annual">سنوية</option>
                                                        <option value="sick">مرضية</option>
                                                        <option value="emergency">طارئة</option>
                                                        <option value="other">أخرى</option>
                                                    </select>
                                                    <button onClick={handleSaveLeave} className="text-green-600 hover:bg-green-50 p-1 rounded"><Save className="w-3 h-3" /></button>
                                                    <button onClick={() => setEditingLeave(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        )})() : (
                                            <>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-600 font-medium">{log.type === 'annual' ? 'سنوية' : (log.type === 'sick' ? 'مرضية' : 'أخرى')}</span>
                                                    <span className="text-xs text-black font-bold mt-0.5 block">
                                                        {new Date(log.startDate).toLocaleDateString('en-GB')} - {new Date(log.endDate).toLocaleDateString('en-GB')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-gray-600">{log.effectiveDuration} يوم</span>
                                                        {log.duration !== log.effectiveDuration && (
                                                            <span className="text-[10px] text-gray-400">(الكلي: {log.duration})</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => setEditingLeave({ 
                                                                workerId: group.workerId, 
                                                                oldStartDate: log.startDate, 
                                                                startDate: log.startDate, 
                                                                endDate: log.endDate, 
                                                                type: log.type as any, 
                                                                notes: log.notes || '' 
                                                            })}
                                                            className="text-blue-500 hover:bg-blue-50 p-1 rounded"
                                                            title="تعديل"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                                                                    deleteLeave(group.workerId, log.startDate, log.endDate);
                                                                }
                                                            }}
                                                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )})}
                            </div>
                        </div>
                     ))}
                     {groupedLeaves.length === 0 && (
                        <div className="text-center text-gray-400 py-8 flex flex-col items-center gap-2 h-full justify-center">
                             <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                                <Plane className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium">لا توجد إجازات في الفترة</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

      </div>

      {/* Standby Sidebar (Sticky Right) */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 shadow-lg md:h-screen sticky top-0 overflow-y-auto hidden md:block">
        <div className="p-4 bg-blue-50 border-b border-blue-100">
            <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                المتاحون للتوزيع
            </h2>
            <p className="text-xs text-blue-600 mt-1">العمال في الانتظار جاهزون للعمل</p>
        </div>
        <div className="divide-y divide-gray-100">
            {standbyWorkers.map(worker => {
                const daysInWaiting = getDaysDiff(worker.waitingSince || '');
                const isLongWaiting = daysInWaiting > 3;
                return (
                <div key={worker.id} className="p-4 hover:bg-gray-50 transition-colors group cursor-pointer relative">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm relative">
                            {worker.name.substring(0,2)}
                            {isLongWaiting && (
                                <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] border border-white animate-pulse" title="تجاوز 3 أيام في الانتظار">
                                    !
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                {worker.name}
                                {isLongWaiting && <AlertTriangle className="w-3 h-3 text-red-500" />}
                            </h4>
                            <p className="text-xs text-gray-500">{worker.skill}</p>
                            <div className="mt-2 flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isLongWaiting ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                    منذ {daysInWaiting} يوم
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )})}
            {standbyWorkers.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                    لا يوجد عمال في قائمة الانتظار
                </div>
            )}
        </div>
      </div>

        {/* Skill Workers Stats Modal */}
        {selectedSkillForStats && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h3 className="font-medium text-lg text-gray-800 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${selectedSkillForStats.color.split(' ')[0]}`}></span>
                  عمال مهنة: {selectedSkillForStats.label}
                </h3>
                <button onClick={() => setSelectedSkillForStats(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <div className="space-y-2">
                  {state.workers
                    .filter(w => w.skill === selectedSkillForStats.name)
                    .map(w => {
                      const site = state.sites.find(s => s.id === w.assignedSiteId);
                      return (
                        <div key={w.id} className="p-3 bg-gray-50 rounded border border-gray-100 flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-800">
                              {w.name} 
                              {w.code && <span className="text-gray-500 font-normal text-xs mx-1">({w.code})</span>}
                            </div>
                            <div className="text-xs text-gray-500">{w.phone || 'لا يوجد رقم'}</div>
                          </div>
                          <div className="text-xs px-2 py-1 rounded bg-white border">
                            {site ? site.name : 'غير معين'}
                          </div>
                        </div>
                      );
                    })}
                    {state.workers.filter(w => w.skill === selectedSkillForStats.name).length === 0 && (
                      <div className="text-center text-gray-500 py-4">لا يوجد عمال لهذه المهنة</div>
                    )}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setSelectedSkillForStats(null)} className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-medium">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Status Stats Modal */}
        {selectedProjectStatusForStats && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h3 className="font-medium text-lg text-gray-800 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                      selectedProjectStatusForStats === 'active' ? 'bg-orange-500' :
                      selectedProjectStatusForStats === 'stopped' ? 'bg-red-500' :
                      'bg-blue-500'
                  }`}></span>
                  {selectedProjectStatusForStats === 'active' ? 'المشاريع النشطة' :
                   selectedProjectStatusForStats === 'stopped' ? 'المشاريع المتوقفة' :
                   'المشاريع المكتملة'}
                </h3>
                <button onClick={() => setSelectedProjectStatusForStats(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <div className="space-y-2">
                  {state.sites
                    .filter(s => {
                        if (selectedProjectStatusForStats === 'active') return s.status === 'active' || (!s.status && (s.assignedWorkerIds || []).length > 0);
                        if (selectedProjectStatusForStats === 'stopped') return s.status === 'stopped';
                        if (selectedProjectStatusForStats === 'completed') return s.status === 'completed';
                        return false;
                    })
                    .map(s => (
                        <div key={s.id} className="p-3 bg-gray-50 rounded border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition-all">
                          <div>
                            <div className="font-medium text-gray-800">
                              {s.name}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>{s.location}</span>
                            </div>
                          </div>
                          <div className="text-xs px-2 py-1 rounded bg-white border flex flex-col items-end">
                            {selectedProjectStatusForStats === 'active' && (
                                <span className="text-orange-600 font-bold">{s.assignedWorkerIds?.length || 0} عامل</span>
                            )}
                            {s.statusNote && <span className="text-[10px] text-gray-400 max-w-[100px] truncate">{s.statusNote}</span>}
                          </div>
                        </div>
                    ))}
                    {state.sites.filter(s => {
                        if (selectedProjectStatusForStats === 'active') return s.status === 'active' || (!s.status && (s.assignedWorkerIds || []).length > 0);
                        if (selectedProjectStatusForStats === 'stopped') return s.status === 'stopped';
                        if (selectedProjectStatusForStats === 'completed') return s.status === 'completed';
                        return false;
                    }).length === 0 && (
                      <div className="text-center text-gray-500 py-4">لا توجد مشاريع في هذه القائمة</div>
                    )}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setSelectedProjectStatusForStats(null)} className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-medium">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Worker Status Stats Modal */}
        {selectedWorkerStatusForStats && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h3 className="font-medium text-lg text-gray-800 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                      selectedWorkerStatusForStats === 'assigned' ? 'bg-blue-500' :
                      selectedWorkerStatusForStats === 'waiting' ? 'bg-yellow-500' :
                      selectedWorkerStatusForStats === 'absent' ? 'bg-red-500' :
                      'bg-green-500'
                  }`}></span>
                  {selectedWorkerStatusForStats === 'assigned' ? 'العمال الموزعين' :
                   selectedWorkerStatusForStats === 'waiting' ? 'العمال في الانتظار' :
                   selectedWorkerStatusForStats === 'absent' ? 'العمال الغائبين' :
                   'العمال في إجازة'}
                </h3>
                <button onClick={() => setSelectedWorkerStatusForStats(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <div className="space-y-2">
                  {state.workers
                    .filter(w => {
                        if (selectedWorkerStatusForStats === 'assigned') return w.assignedSiteId;
                        if (selectedWorkerStatusForStats === 'waiting') return !w.assignedSiteId && (w.availabilityStatus === 'waiting' || w.availabilityStatus === 'available' || !w.availabilityStatus);
                        if (selectedWorkerStatusForStats === 'absent') return !w.assignedSiteId && w.availabilityStatus === 'absent';
                        if (selectedWorkerStatusForStats === 'rest') return !w.assignedSiteId && w.availabilityStatus === 'rest';
                        return false;
                    })
                    .map(w => {
                      const site = w.assignedSiteId ? state.sites.find(s => s.id === w.assignedSiteId) : null;
                      return (
                        <div key={w.id} className="p-3 bg-gray-50 rounded border border-gray-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition-all">
                          <div>
                            <div className="font-medium text-gray-800">
                              {w.name} 
                              {w.code && <span className="text-gray-500 font-normal text-xs mx-1">({w.code})</span>}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <span>{w.skill}</span>
                                {w.phone && <span dir="ltr">| {w.phone}</span>}
                            </div>
                          </div>
                          <div className="text-xs px-2 py-1 rounded bg-white border">
                            {selectedWorkerStatusForStats === 'assigned' && (site ? site.name : 'موقع غير معروف')}
                            {selectedWorkerStatusForStats === 'waiting' && `منذ ${getDaysDiff(w.waitingSince || '')} يوم`}
                            {selectedWorkerStatusForStats === 'absent' && `منذ ${getDaysDiff(w.absentSince || '')} يوم`}
                            {selectedWorkerStatusForStats === 'rest' && 'إجازة'}
                          </div>
                        </div>
                      );
                    })}
                    {state.workers.filter(w => {
                        if (selectedWorkerStatusForStats === 'assigned') return w.assignedSiteId;
                        if (selectedWorkerStatusForStats === 'waiting') return !w.assignedSiteId && (w.availabilityStatus === 'waiting' || w.availabilityStatus === 'available' || !w.availabilityStatus);
                        if (selectedWorkerStatusForStats === 'absent') return !w.assignedSiteId && w.availabilityStatus === 'absent';
                        if (selectedWorkerStatusForStats === 'rest') return !w.assignedSiteId && w.availabilityStatus === 'rest';
                        return false;
                    }).length === 0 && (
                      <div className="text-center text-gray-500 py-4">لا يوجد عمال في هذه القائمة</div>
                    )}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <button onClick={() => setSelectedWorkerStatusForStats(null)} className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-medium">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
