'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, SalaryRecord, Worker } from '@/types';
import { initialAppState, initialUsers, initialDocumentCategories } from '@/lib/data';
import { logActivity } from '@/lib/activity';

const AppStateContext = createContext<{
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateWorkerStatus: (workerId: string, status: 'available' | 'absent' | 'rest' | 'waiting') => void;
  // markWorkerAbsent removed as it is not implemented
  recordAbsence: (workerId: string, date: string, reason?: string, recordedBy?: string) => void;
  cancelAbsence: (workerId: string) => void;
  deleteAbsence: (workerId: string, date: string) => void;
  updateAbsence: (workerId: string, oldDate: string, newDate: string, reason?: string) => void;
  recordLeave: (workerId: string, leave: { startDate: string; endDate: string; type: 'annual' | 'sick' | 'emergency' | 'other'; notes?: string }) => void;
  deleteLeave: (workerId: string, startDate: string, endDate: string) => void;
  updateLeave: (workerId: string, oldStartDate: string, newLeave: { startDate: string; endDate: string; type: 'annual' | 'sick' | 'emergency' | 'other'; notes?: string }) => void;
  updateSalaryData: (workerId: string, data: Partial<SalaryRecord>) => void;
} | undefined>(undefined);

function ensureUniqueWorkerCodes(state: AppState): AppState {
  const workers = state.workers || [];

  let base =
    typeof state.lastWorkerCode === 'number' && !isNaN(state.lastWorkerCode)
      ? state.lastWorkerCode
      : 0;

  if (!base) {
    for (const w of workers) {
      if (!w.code) continue;
      const n = parseInt(String(w.code).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > base) base = n;
    }
  }

  const used = new Set<string>();

  const updatedWorkers = workers.map((w) => {
    let code = w.code;

    if (code && !used.has(code)) {
      used.add(code);
      const n = parseInt(String(code).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > base) base = n;
      return w;
    }

    let nextNum = base;
    let newCode: string;
    do {
      nextNum += 1;
      newCode = 'EM' + nextNum.toString().padStart(4, '0');
    } while (used.has(newCode));

    base = nextNum;
    used.add(newCode);

    return { ...w, code: newCode };
  });

  return { ...state, workers: updatedWorkers, lastWorkerCode: base };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialAppState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Attempt to fetch from Backend API (Source of Truth)
        const response = await fetch('/api/sync');
        if (response.ok) {
          const payload = await response.json();
          if (payload && payload.data) {
             let merged: AppState = { ...initialAppState, ...payload.data };
             if (!merged.users || merged.users.length === 0) merged.users = initialUsers;
             if (!merged.documentCategories || merged.documentCategories.length === 0) {
               merged.documentCategories = initialDocumentCategories;
             }
             
             if (merged.workers) {
                merged.workers = merged.workers.map((w: any) => {
                  if (w.absenceHistory && w.absenceHistory.length > 0) {
                    const uniqueHistory: any[] = [];
                    const seenDates = new Set();
                    for (const entry of w.absenceHistory) {
                      if (!seenDates.has(entry.date)) {
                        seenDates.add(entry.date);
                        uniqueHistory.push(entry);
                      }
                    }
                    return { ...w, absenceHistory: uniqueHistory };
                  }
                  return w;
                });
             }

             merged = ensureUniqueWorkerCodes(merged);

             setState(merged);
             setIsLoaded(true);
             console.log('State loaded from Backend API');
             return;
          }
        }
      } catch (e) {
        console.error('Failed to load from API, falling back to LocalStorage', e);
      }

      // 2. Fallback to LocalStorage (Offline support)
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('labour-app-state-v4');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.workers) {
              let merged: AppState = { ...initialAppState, ...parsed };
              if (!merged.users || merged.users.length === 0) merged.users = initialUsers;
              if (!merged.documentCategories || merged.documentCategories.length === 0) {
                merged.documentCategories = initialDocumentCategories;
              }
              merged = ensureUniqueWorkerCodes(merged);
              setState(merged);
            }
          }
        } catch (error) {
          console.error('Error loading state from localStorage:', error);
        }
      }
      setIsLoaded(true);
    };

    loadData();
  }, []);

  useEffect(() => {
    // Prevent saving if data hasn't loaded yet to avoid overwriting DB with empty state
    if (!isLoaded) return;

    const tid = setTimeout(async () => {
      try {
        // Save to Backend API
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        }).catch(() => {});

        try {
          localStorage.setItem('labour-app-state-v4', JSON.stringify(state));
        } catch {}
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
    }, 4000); // Debounce 4s لتقليل الضغط وتحسين الأداء
    return () => clearTimeout(tid);
  }, [state, isLoaded]);

  const updateWorkerStatus = (workerId: string, status: 'available' | 'absent' | 'rest' | 'waiting') => {
    setState(prev => ({
      ...prev,
      workers: prev.workers.map(w => {
        if (w.id === workerId) {
            const updates: Partial<typeof w> = { availabilityStatus: status };
            // Waiting logic
            if ((status === 'waiting' || status === 'available') && w.availabilityStatus !== 'waiting' && w.availabilityStatus !== 'available') {
                updates.waitingSince = new Date().toISOString();
            }
            if (status !== 'waiting' && status !== 'available') {
                updates.waitingSince = undefined;
            }
            
            // Absent logic
            if (status === 'absent' && w.availabilityStatus !== 'absent') {
                updates.absentSince = new Date().toISOString();
            }
            if (status !== 'absent') {
                updates.absentSince = undefined;
            }
            return { ...w, ...updates };
        }
        return w;
      })
    }));
    logActivity('update_worker_status');
  };

  const recordAbsence = (workerId: string, date: string, reason?: string, recordedBy?: string) => {
    setState(prev => {
      const updatedWorkers: Worker[] = prev.workers.map((w): Worker => {
        if (w.id === workerId) {
          const history = Array.isArray(w.absenceHistory) ? [...w.absenceHistory] : [];
          if (!history.some(h => h.date === date)) {
            history.push({ date, reason, recordedBy });
          }

          const newAbsentSince =
            w.availabilityStatus === 'absent' && w.absentSince
              ? w.absentSince
              : new Date().toISOString();

          return {
            ...w,
            availabilityStatus: 'absent',
            absenceHistory: history,
            waitingSince: undefined,
            absentSince: newAbsentSince,
          };
        }
        return w;
      });

      const next: AppState = {
        ...prev,
        workers: updatedWorkers,
      };

      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {});
      } catch {}

      return next;
    });
    logActivity('record_absence');
  };

  const cancelAbsence = (workerId: string) => {
    setState(prev => ({
      ...prev,
      workers: prev.workers.map(w => {
        if (w.id === workerId) {
          // Remove the last absence entry
          const newHistory = Array.isArray(w.absenceHistory) ? [...w.absenceHistory] : [];
          if (newHistory.length > 0) {
              newHistory.pop();
          }
          
          // Determine previous status (if site assigned -> available/active, else -> waiting)
          // Note: If they have an assigned site, they should be 'available' (working).
          const newStatus = w.assignedSiteId ? 'available' : 'waiting';
          
          return { 
              ...w, 
              availabilityStatus: newStatus, 
              absenceHistory: newHistory, 
              absentSince: undefined,
              // If reverting to waiting, set waitingSince to now
              waitingSince: !w.assignedSiteId ? new Date().toISOString() : undefined
          };
        }
        return w;
      })
    }));
    logActivity('cancel_absence');
  };

  const deleteAbsence = (workerId: string, date: string) => {
    setState(prev => ({
      ...prev,
      workers: prev.workers.map(w => {
        if (w.id === workerId && w.absenceHistory) {
          const newHistory = w.absenceHistory.filter(h => h.date !== date);
          return { ...w, absenceHistory: newHistory };
        }
        return w;
      })
    }));
    logActivity('delete_absence');
  };

  const updateAbsence = (workerId: string, oldDate: string, newDate: string, reason?: string) => {
    setState(prev => ({
      ...prev,
      workers: prev.workers.map(w => {
        if (w.id === workerId) {
          const history = Array.isArray(w.absenceHistory) ? w.absenceHistory : [];
          let updated = false;

          const newHistory = history.map(h => {
              // Flexible matching for date (handles exact match or YYYY-MM-DD substring)
              if (h.date === oldDate || (h.date && oldDate && (h.date.startsWith(oldDate) || oldDate.startsWith(h.date)))) {
                  updated = true;
                  return { ...h, date: newDate, reason: reason !== undefined ? reason : h.reason };
              }
              return h;
          });

          // If no history entry matched but worker is absent, ensure we have a history entry
          if (!updated && w.availabilityStatus === 'absent') {
             newHistory.push({ date: newDate, reason: reason || '' });
          }
          
          // Also update absentSince to ensure consistency across the system
          // We set it to the new date (start of day)
          const newAbsentSince = new Date(newDate).toISOString();

          return { 
              ...w, 
              absenceHistory: newHistory, 
              absentSince: newAbsentSince 
          };
        }
        return w;
      })
    }));
    logActivity('update_absence');
  };

  const recordLeave = (workerId: string, leave: { startDate: string; endDate: string; type: 'annual' | 'sick' | 'emergency' | 'other'; notes?: string }) => {
    setState(prev => {
      const targetWorker = prev.workers.find(w => w.id === workerId);
      const oldSiteId = targetWorker?.assignedSiteId;

      const updatedWorkers: Worker[] = prev.workers.map((w): Worker => {
        if (w.id === workerId) {
          const history = Array.isArray(w.leaveHistory) ? [...w.leaveHistory] : [];
          history.push(leave);

          return {
            ...w,
            availabilityStatus: 'rest',
            leaveHistory: history,
            waitingSince: undefined,
            assignedSiteId: undefined,
          };
        }
        return w;
      });

      const updatedSites = oldSiteId
        ? prev.sites.map(s =>
            s.id === oldSiteId
              ? { ...s, assignedWorkerIds: s.assignedWorkerIds.filter(id => id !== workerId) }
              : s
          )
        : prev.sites;

      const next: AppState = {
        ...prev,
        workers: updatedWorkers,
        sites: updatedSites,
      };

      try {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {});
      } catch {}

      return next;
    });
    logActivity('record_leave');
  };

  const deleteLeave = (workerId: string, startDate: string, endDate: string) => {
    setState(prev => ({
        ...prev,
        workers: prev.workers.map(w => {
            if (w.id === workerId && w.leaveHistory) {
                const index = w.leaveHistory.findIndex(l => l.startDate === startDate && l.endDate === endDate);
                if (index !== -1) {
                    const newHistory = [...w.leaveHistory];
                    newHistory.splice(index, 1);
                    return { ...w, leaveHistory: newHistory };
                }
            }
            return w;
        })
    }));
    logActivity('delete_leave');
  };

  const updateLeave = (workerId: string, oldStartDate: string, newLeave: { startDate: string; endDate: string; type: 'annual' | 'sick' | 'emergency' | 'other'; notes?: string }) => {
    setState(prev => ({
        ...prev,
        workers: prev.workers.map(w => {
            if (w.id === workerId && w.leaveHistory) {
                const newHistory = w.leaveHistory.map(l => {
                    if (l.startDate === oldStartDate) {
                        return newLeave;
                    }
                    return l;
                });
                return { ...w, leaveHistory: newHistory };
            }
            return w;
        })
    }));
    logActivity('update_leave');
  };

  const updateSalaryData = (workerId: string, data: Partial<SalaryRecord>) => {
    setState(prev => ({
      ...prev,
      salaryData: {
        ...(prev.salaryData || {}),
        [workerId]: {
          ...(prev.salaryData?.[workerId] || {
            basicSalary: 0,
            advance: 0,
            advanceRepayment: 0,
            absenceDays: 0,
            absenceValue: 0,
            violationValue: 0,
            violationRepayment: 0,
            incentives: 0
          }),
          ...data
        }
      }
    }));
  };

  return (
    <AppStateContext.Provider value={{ state, setState, updateWorkerStatus, recordAbsence, cancelAbsence, deleteAbsence, updateAbsence, recordLeave, deleteLeave, updateLeave, updateSalaryData }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
