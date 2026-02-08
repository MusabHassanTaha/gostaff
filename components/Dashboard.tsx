'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, DragEndEvent, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, TouchSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import Image from 'next/image';
import { AppState, Worker, Site, Skill, SkillDefinition, Notification } from '@/types';
import { SiteCard } from './SiteCard';
import { SortableSite } from './SortableSite';
import { AvailableWorkers } from './AvailableWorkers';
import { WorkerCard, WorkerCardView } from './WorkerCard';
import { Wand2, Bell, QrCode, X, MapPin, Search, Briefcase, Smartphone, Save, Download, Plus, LayoutDashboard, Users, FileText, Truck, UserCircle, RefreshCw, Send, LogOut, Archive, PauseCircle, PlayCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from './state/AuthContext';
import { daysRemaining, labelFor, statusClasses } from '@/lib/date';
import { buildWhatsappLink } from '@/lib/whatsapp';
import { MobileAccess } from './MobileAccess';
import ProfessionalDashboard from './ProfessionalDashboard';



export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, setState } = useAppState();
  
  // Notification Logic
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = state.notifications?.filter(n => !n.isRead).length || 0;

  const handleNotificationClick = (notification: Notification) => {
      setState(prev => ({
          ...prev,
          notifications: prev.notifications.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      }));
      setShowNotifications(false);

      if (notification.type === 'new_worker') {
           router.push(`/workers?search=${notification.targetId}`);
      } else if (notification.type === 'absence_report') {
          router.push(`/reports?view=absence&search=${notification.targetId}`);
      }
  };

  const [projectStatusTab, setProjectStatusTab] = useState<'active' | 'stopped' | 'archived' | 'completed'>('active');
  
  // Scoped View Logic based on Assignments
  const scopedState = React.useMemo(() => {
    // Admin always sees everything
    if (user?.role === 'admin') {
        return { sites: state.sites, workers: state.workers };
    }

    // Engineer specific filtering
    if (user?.role === 'engineer') {
        const normalize = (s: string) => s ? s.toLowerCase().trim().replace(/[\s\-_.]+/g, ' ') : '';
        const uName = normalize(user?.username || '');
        const engineerWorker = state.workers.find(w => {
            if (!w.isEngineer) return false;
            const wName = normalize(w.name);
            return wName === uName || (uName.length > 3 && wName.includes(uName)) || (wName.length > 3 && uName.includes(wName));
        });

        if (engineerWorker) {
            const mySites = state.sites.filter(s => s.engineerId === engineerWorker.id);
            const mySiteIds = new Set(mySites.map(s => s.id));
            
            // Workers: assigned to my sites + unassigned (available)
            // Engineers should see ALL available workers to pick from
            const visibleWorkers = state.workers.filter(w => 
                (w.assignedSiteId && mySiteIds.has(w.assignedSiteId)) ||
                !w.assignedSiteId 
            );

            return { sites: mySites, workers: visibleWorkers };
        }
    }

    // If user has explicit project assignments, filter sites
    if (user?.assignedProjectIds && user.assignedProjectIds.length > 0) {
        const mySiteIds = new Set(user.assignedProjectIds);
        const mySites = state.sites.filter(s => mySiteIds.has(s.id));
        
        // Workers: assigned to my sites + unassigned (available)
        const myWorkers = state.workers.filter(w => 
            (w.assignedSiteId && mySiteIds.has(w.assignedSiteId)) ||
            !w.assignedSiteId 
        );

        return { sites: mySites, workers: myWorkers };
    }

    // Default: Show all (if no restrictions found)
    return { sites: state.sites, workers: state.workers };
  }, [state.sites, state.workers, user]);

  // Filter active workers (exclude pending)
  const activeWorkers = React.useMemo(() => {
    return scopedState.workers.filter(w => w.status !== 'pending');
  }, [scopedState.workers]);

  const [searchQuery, setSearchQuery] = useState(searchParams?.get('search') || '');
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  
  const [showMobileAccess, setShowMobileAccess] = useState(false);

  // Expiry stats removed

  const handleManualSave = () => {
    try {
      localStorage.setItem('labour-app-state-v4', JSON.stringify(state));
      alert('تم حفظ التعديلات بنجاح');
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleExportData = () => {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use local date and time for filename
      const now = new Date();
      const dateStr = now.getFullYear() + '-' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(now.getDate()).padStart(2, '0');
      const timeStr = String(now.getHours()).padStart(2, '0') + '-' + 
                      String(now.getMinutes()).padStart(2, '0') + '-' + 
                      String(now.getSeconds()).padStart(2, '0');
      
      a.download = `labour-app-backup_${dateStr}_${timeStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return alert('ملف غير صالح');
      setState(parsed as AppState);
      alert('تم استرجاع البيانات بنجاح');
    } catch {
      alert('تعذر قراءة الملف');
    } finally {
      e.target.value = '';
    }
  };



  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Add delay to TouchSensor to allow scrolling and prevent accidental drags
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto Assign Logic
  const handleAutoAssign = () => {
    if (user?.role === 'viewer') return;
    const newState = { ...state };
    // Only consider active workers who are not assigned
    const available = [...activeWorkers.filter(w => !w.assignedSiteId)];
    
    // Simple Greedy Algorithm
    newState.sites.forEach(site => {
      const required = site.requiredSkills || {};
      Object.entries(required).forEach(([skillName, count]) => {
        // Find assigned workers for this skill in this site
        const currentCount = newState.workers.filter(w => w.assignedSiteId === site.id && w.skill === skillName).length;
        let needed = (count as number) - currentCount;

        while (needed > 0) {
          const candidateIndex = available.findIndex(w => w.skill === skillName);
          if (candidateIndex !== -1) {
             const worker = available[candidateIndex];
             // Assign
             worker.assignedSiteId = site.id;
             site.assignedWorkerIds = [...(site.assignedWorkerIds || []), worker.id];
             // Remove from available
             available.splice(candidateIndex, 1);
             needed--;
          } else {
            break; // No more candidates
          }
        }
      });
    });

    // Update state
    setState({
        ...newState,
        availableWorkerIds: available.map(w => w.id),
        workers: newState.workers // Worker objects mutated above
    });
    alert('تم التوزيع التلقائي بنجاح!');
  };

  // Return all workers from sites to rest area (except Office)
  const handleReturnAllFromSites = () => {
    if (user?.role === 'viewer') return;
    if (!confirm('هل أنت متأكد من إرجاع جميع العمال من المواقع إلى الاستراحة (ماعدا عمال المكتب)؟')) return;

    // Identify Office Site ID(s) - looking for "المكتب" or "Office"
    const officeSites = state.sites.filter(s => 
        (s.name && (s.name.includes('المكتب') || s.name.toLowerCase().includes('office')))
    );
    const officeSiteIds = new Set(officeSites.map(s => s.id));

    // Update Workers: Unassign those assigned to non-office sites
    const newWorkers = state.workers.map(w => {
        if (w.assignedSiteId && !officeSiteIds.has(w.assignedSiteId)) {
            return { ...w, assignedSiteId: undefined };
        }
        return w;
    });

    // Update Sites: Clear assignedWorkerIds for non-office sites
    const newSites = state.sites.map(s => {
        if (!officeSiteIds.has(s.id)) {
            return { ...s, assignedWorkerIds: [] };
        }
        return s;
    });

    setState(prev => ({
        ...prev,
        workers: newWorkers,
        sites: newSites
    }));

    alert('تم إرجاع جميع العمال من المواقع (ماعدا المكتب) بنجاح');
  };

  const [isConfirmNotify, setIsConfirmNotify] = useState(false);
  const [notifyLinks, setNotifyLinks] = useState<{ name: string; phone: string; url: string }[]>([]);
  const [notifyInvalidCount, setNotifyInvalidCount] = useState(0);
  const [notifyInvalids, setNotifyInvalids] = useState<{ name: string; phone: string; reason: string }[]>([]);

  const handleNotifyPrepare = () => {
    if (user?.role === 'viewer') return;
    const assigned = activeWorkers.filter(w => !!w.assignedSiteId);
    const links: { name: string; phone: string; url: string }[] = [];
    const invalids: { name: string; phone: string; reason: string }[] = [];
    assigned.forEach(w => {
      const site = state.sites.find(s => s.id === w.assignedSiteId);
      if (!w.phone || w.phone.trim().length === 0) {
        invalids.push({ name: w.name, phone: '', reason: 'لا يوجد رقم' });
        return;
      }

      const url = buildWhatsappLink(w, site, state.workers);
      if (url) {
        links.push({ name: w.name, phone: w.phone, url });
      } else {
        invalids.push({ name: w.name, phone: w.phone, reason: 'رقم غير صالح' });
      }
    });
    setNotifyLinks(links);
    setNotifyInvalids(invalids);
    setNotifyInvalidCount(invalids.length);
    setIsConfirmNotify(true);
  };
  const handleNotifySend = () => {
    notifyLinks.forEach((entry, idx) => {
      setTimeout(() => {
        try {
          window.open(entry.url, '_blank');
        } catch {}
      }, idx * 200);
    });
    setIsConfirmNotify(false);
  };

  const handleUpdateSite = (siteId: string, updates: Partial<Site>) => {
    if (user?.role === 'viewer') return;
    
    // Engineer can only update their own site
    if (user?.role === 'engineer') {
        const normalize = (s: string) => s ? s.toLowerCase().trim().replace(/\s+/g, ' ') : '';
        const uName = normalize(user?.username || '');
        const engineerWorker = state.workers.find(w => {
            if (!w.isEngineer) return false;
            const wName = normalize(w.name);
            return wName === uName || (uName.length > 3 && wName.includes(uName)) || (wName.length > 3 && uName.includes(wName));
        });
        
        const site = state.sites.find(s => s.id === siteId);
        if (!engineerWorker || !site || site.engineerId !== engineerWorker.id) return;
    }
    
    setState(prev => ({
      ...prev,
      sites: prev.sites.map(s => s.id === siteId ? { ...s, ...updates } : s)
    }));
  };

  const handleReorderSite = (siteId: string, targetSiteId: string) => {
    if (user?.role === 'viewer' || user?.role === 'engineer') return; // Engineer cannot reorder sites globally
    setState(prev => {
        const site = prev.sites.find(s => s.id === siteId);
        if (!site) return prev;
        
        const newSites = prev.sites.filter(s => s.id !== siteId);
        
        if (targetSiteId === '__TOP__') {
            newSites.unshift(site);
        } else {
            const targetIndex = newSites.findIndex(s => s.id === targetSiteId);
            if (targetIndex !== -1) {
                newSites.splice(targetIndex + 1, 0, site);
            } else {
                newSites.push(site);
            }
        }
        return { ...prev, sites: newSites };
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    // Find the active worker
    const activeWorker = state.workers.find(w => w.id === activeId);
    if (!activeWorker) return;

    const overData = over.data.current;
    const overType = overData?.type;

    // 1. Moving into 'Available' container
    if (overId === 'available') {
      if (activeWorker.assignedSiteId) {
        handleAssignWorker(activeId, null);
      }
      return;
    }

    // 2. Moving into a Site container (directly over the container/card)
    if (overType === 'site') {
      const siteId = overId;
      if (activeWorker.assignedSiteId !== siteId) {
        handleAssignWorker(activeId, siteId);
      }
      return;
    }

    // 3. Moving over another Worker
    if (overType === 'worker') {
      const targetSiteId = overData?.siteId; // undefined if available, siteId if in site
      
      // Only handle if moving between DIFFERENT containers
      if (activeWorker.assignedSiteId !== targetSiteId) {
         handleAssignWorker(activeId, targetSiteId || null);
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const worker = active.data.current?.worker as Worker;
    setActiveWorker(worker);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWorker(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if it's a worker drag
    const activeWorker = state.workers.find(w => w.id === activeId);

    if (activeWorker) {
      // 1. Drop on Available Area
      if (overId === 'available') {
        handleAssignWorker(activeId, null);
        return;
      }

      const overData = over.data.current;
      const overType = overData?.type;

      // 2. Drop on a Site (Empty area or container)
      if (overType === 'site') {
         const siteId = overId;
         if (activeWorker.assignedSiteId !== siteId) {
             handleAssignWorker(activeId, siteId);
         }
         return;
      }

      // 3. Drop on another Worker
      if (overType === 'worker') {
         const targetSiteId = overData?.siteId;
         
         // Engineer Permission Check
         if (user?.role === 'engineer') {
              const normalize = (s: string) => s ? s.toLowerCase().trim().replace(/[\s\-_.]+/g, ' ') : '';
              const uName = normalize(user?.username || '');
              const engineerWorker = state.workers.find(w => {
                  if (!w.isEngineer) return false;
                  const wName = normalize(w.name);
                  return wName === uName || (uName.length > 3 && wName.includes(uName)) || (wName.length > 3 && uName.includes(wName));
              });

              // Allow if site is in engineer's scope (via scopedState)
              const isTargetAllowed = targetSiteId ? scopedState.sites.some(s => s.id === targetSiteId) : true;
              const isSourceAllowed = activeWorker.assignedSiteId ? scopedState.sites.some(s => s.id === activeWorker.assignedSiteId) : true;

              if (!isTargetAllowed || !isSourceAllowed) {
                  return; // Silently block or could alert if desired, but user asked to hide alerts
              }
              
              // If we have engineerWorker, we can double check strict ownership if needed, 
              // but relying on scopedState is safer for the "Hide Alert" requirement.
         }

         // A. Same Site Reordering
         if (activeWorker.assignedSiteId === targetSiteId) {
             const site = state.sites.find(s => s.id === targetSiteId);
             if (site) {
                 const oldIndex = site.assignedWorkerIds.indexOf(activeId);
                 const newIndex = site.assignedWorkerIds.indexOf(overId);
                 
                 if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                     const newAssigned = arrayMove(site.assignedWorkerIds, oldIndex, newIndex);
                     const newSites = state.sites.map(s => 
                         s.id === targetSiteId ? { ...s, assignedWorkerIds: newAssigned } : s
                     );
                     setState({ ...state, sites: newSites });
                 }
             }
             return;
         }

         // B. Different Site (Move & Insert)
         if (targetSiteId && activeWorker.assignedSiteId !== targetSiteId) {
             const site = state.sites.find(s => s.id === targetSiteId);
             if (site) {
                 const oldSiteId = activeWorker.assignedSiteId;
                 
                 // Insert at specific index (where the over worker is)
                 let newAssigned = [...site.assignedWorkerIds];
                 // Filter out if it somehow already exists (safety)
                 newAssigned = newAssigned.filter(id => id !== activeId);
                 
                 const targetIndex = newAssigned.indexOf(overId);
                 if (targetIndex !== -1) {
                     // Determine insertion based on direction? 
                     // For simplicity, insert at the target index (pushing target down)
                     newAssigned.splice(targetIndex, 0, activeId);
                 } else {
                     newAssigned.push(activeId);
                 }

                 const newWorkers = state.workers.map(w => 
                     w.id === activeId ? { ...w, assignedSiteId: targetSiteId, availabilityStatus: undefined } : w
                 );

                 const newSites = state.sites.map(s => {
                     if (s.id === oldSiteId) {
                         return { ...s, assignedWorkerIds: s.assignedWorkerIds.filter(id => id !== activeId) };
                     }
                     if (s.id === targetSiteId) {
                         return { ...s, assignedWorkerIds: newAssigned };
                     }
                     return s;
                 });

                 setState({ ...state, workers: newWorkers, sites: newSites });
             }
             return;
         }
      }
      return;
    }

    // Site Sort Logic
    const isSiteSort = !activeWorker;
    if (isSiteSort && activeId !== overId) {
      const oldIndex = state.sites.findIndex(s => s.id === activeId);
      const newIndex = state.sites.findIndex(s => s.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newSites = arrayMove(state.sites, oldIndex, newIndex);
        setState({ ...state, sites: newSites });
      }
    }
  };

  const handleAddWorker = (newWorker: Worker) => {
    if (user?.role === 'viewer' || user?.role === 'engineer') return;
    setState(prev => ({
        ...prev,
        workers: [newWorker, ...prev.workers],
        availableWorkerIds: [newWorker.id, ...prev.availableWorkerIds]
    }));
  };

  const handleDeleteWorker = (workerId: string) => {
    if (user?.role === 'viewer') return;
    if (!confirm('هل تريد حذف هذا العامل؟')) return;
    
    setState(prev => ({
        ...prev,
        workers: prev.workers.filter(w => w.id !== workerId),
        availableWorkerIds: prev.availableWorkerIds.filter(id => id !== workerId),
        sites: prev.sites.map(site => ({
            ...site,
            assignedWorkerIds: site.assignedWorkerIds.filter(id => id !== workerId)
        }))
    }));
  };

  const handleUpdateWorker = (workerId: string, newName: string) => {
    setState(prev => ({
        ...prev,
        workers: prev.workers.map(w => w.id === workerId ? { ...w, name: newName } : w)
    }));
  };
  const handleToggleEngineer = (workerId: string) => {
    if (user?.role === 'engineer' || user?.role === 'viewer') return;
    setState(prev => ({
      ...prev,
      workers: prev.workers.map(w => w.id === workerId ? { ...w, isEngineer: !w.isEngineer } : w)
    }));
  };

  const handleAssignWorker = (workerId: string, siteId: string | null) => {
    if (user?.role === 'viewer') return;
    
    // Engineer Validation
    if (user?.role === 'engineer') {
         const normalize = (s: string) => s ? s.toLowerCase().trim().replace(/[\s\-_.]+/g, ' ') : '';
         const uName = normalize(user?.username || '');
         const engineerWorker = state.workers.find(w => {
             if (!w.isEngineer) return false;
             const wName = normalize(w.name);
             return wName === uName || (uName.length > 3 && wName.includes(uName)) || (wName.length > 3 && uName.includes(wName));
         });
         
         // Allow if site is in engineer's scope (via scopedState)
         const isTargetAllowed = siteId ? scopedState.sites.some(s => s.id === siteId) : true;
         const worker = state.workers.find(w => w.id === workerId);
         const isSourceAllowed = worker?.assignedSiteId ? scopedState.sites.some(s => s.id === worker.assignedSiteId) : true;

         if (!isTargetAllowed || !isSourceAllowed) {
              alert('غير مسموح بنقل عامل من/إلى مشروع ليس تحت إشرافك');
              return;
         }
    }

    const workerIndex = state.workers.findIndex(w => w.id === workerId);
    if (workerIndex === -1) return;

    const newWorkers = [...state.workers];
    const worker = { ...newWorkers[workerIndex] };
    const oldSiteId = worker.assignedSiteId;
    
    // Update worker assignment
    worker.assignedSiteId = siteId || undefined;
    // Reset availability status when assigned/unassigned
    if (siteId) {
        worker.availabilityStatus = undefined;
    } else {
        worker.availabilityStatus = 'available';
    }

    newWorkers[workerIndex] = worker;

    // Update sites
    const newSites = state.sites.map(site => {
      let newAssigned = [...site.assignedWorkerIds];
      
      // Remove from old site
      if (site.id === oldSiteId) {
        newAssigned = newAssigned.filter(id => id !== workerId);
      }
      
      // Add to new site
      if (site.id === siteId) {
        if (!newAssigned.includes(workerId)) {
          newAssigned.push(workerId);
        }
      }
      
      return { ...site, assignedWorkerIds: newAssigned };
    });

    setState({
      ...state,
      workers: newWorkers,
      sites: newSites,
    });
  };

  const handleToggleAvailability = (workerId: string, status: 'available' | 'absent') => {
    if (user?.role === 'viewer') return;
    
    if (user?.role === 'engineer') {
         const normalize = (s: string) => s ? s.toLowerCase().trim().replace(/[\s\-_.]+/g, ' ') : '';
         const uName = normalize(user?.username || '');
         const engineerWorker = state.workers.find(w => {
             if (!w.isEngineer) return false;
             const wName = normalize(w.name);
             return wName === uName || (uName.length > 3 && wName.includes(uName)) || (wName.length > 3 && uName.includes(wName));
         });

         const worker = state.workers.find(w => w.id === workerId);
         if (!worker || !worker.assignedSiteId) return;
         
         const isAllowed = scopedState.sites.some(s => s.id === worker.assignedSiteId);
         if (!isAllowed) return;
    }

    setState(prev => ({
        ...prev,
        workers: prev.workers.map(w => w.id === workerId ? { ...w, availabilityStatus: status } : w)
    }));
  };

  const handleDragCancel = () => {
    setActiveWorker(null);
  };

  const isWorkerMatch = (worker: Worker) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const skillDef = state.skills.find(s => s.name === worker.skill);
    const skillLabel = skillDef ? skillDef.label : '';
    
    return (
      worker.name.toLowerCase().includes(q) ||
      (worker.skill && worker.skill.toLowerCase().includes(q)) ||
      (skillLabel && skillLabel.toLowerCase().includes(q)) ||
      (worker.iqamaNumber && worker.iqamaNumber.includes(q)) ||
      (worker.nationality && worker.nationality.toLowerCase().includes(q))
    );
  };

  const [viewMode, setViewMode] = useState<'operations' | 'analytics'>('operations');

  // Force engineer to operations view
  useEffect(() => {
    if (user?.role === 'engineer' && viewMode === 'analytics') {
        setViewMode('operations');
    }
  }, [user?.role, viewMode]);

  return (
    <DndContext
      onDragCancel={handleDragCancel}
      sensors={user?.role === 'viewer' || isMobile ? [] : sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="min-h-screen flex flex-col bg-gray-100 font-sans relative">
        {/* App Title */}
        <div className="bg-white border-b px-3 py-2 md:px-4 md:py-3 flex items-center justify-center shadow-sm z-10 relative">
             <div className="flex items-center gap-2 md:gap-3">
                 <div className="bg-primary p-1.5 md:p-2 rounded-lg text-white">
                   <QrCode className="w-5 h-5 md:w-6 md:h-6" />
                 </div>
                 <h1 className="text-lg md:text-2xl font-bold text-gray-800 font-cairo">نظام إدارة العمال والمشاريع</h1>
             </div>

{/* Notification Bell Removed from Header */}
        </div>

        {/* View Switcher - Only visible to non-viewers or based on preference */}
        <div className="bg-white border-b px-3 py-2 md:px-4 flex justify-between items-center shadow-sm z-10">
            <div className="flex items-center gap-1 md:gap-2">
                <button 
                    onClick={() => setViewMode('operations')}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-lg font-bold transition-colors ${viewMode === 'operations' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <Briefcase className="w-4 h-4 md:w-6 md:h-6 inline-block ml-1 md:ml-2" />
                    لوحة المشاريع
                </button>
                {user?.role !== 'engineer' && (
                <button 
                    onClick={() => setViewMode('analytics')}
                    className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-lg font-bold transition-colors ${viewMode === 'analytics' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                    <LayoutDashboard className="w-4 h-4 md:w-6 md:h-6 inline-block ml-1 md:ml-2" />
                    لوحة المعلومات
                </button>
                )}
            </div>
            <div className="flex items-center gap-2 md:gap-3">
                {/* Notification Bell Moved to Header */}

                <span className="text-gray-700 font-bold text-sm hidden md:inline">
                    مرحباً، {user?.username}
                </span>
                <button 
                    onClick={logout} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-xs font-bold"
                    title="تسجيل الخروج"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline">تسجيل الخروج</span>
                </button>
            </div>
        </div>

        <div key={viewMode} className="animate-fade-in flex-1 flex flex-col">
        {viewMode === 'analytics' ? (
            <ProfessionalDashboard />
        ) : (
            <>

        {/* Expiry Banner Moved */}

        {/* Header */}
        <header className="bg-white border-b px-3 py-2 md:px-4 md:py-3 flex flex-col shadow-sm z-40 sticky top-0">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
            {/* Title removed from here */}
            <div className="flex items-center gap-2">
                <div className="relative w-10 h-10 md:w-12 md:h-12">
                    <Image 
                        src="/logo.png" 
                        alt="شعار النظام" 
                        fill
                        className="object-contain"
                        priority
                    />
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800 hidden md:block">
                    نظام العمال
                </h1>
            </div>
          
            <div className="flex gap-2 md:gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide snap-x items-center py-1">
            <Link 
                href="/projects"
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 font-bold transition-all duration-200 border border-orange-200 text-xs md:text-sm whitespace-nowrap shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                المشاريع
            </Link>
            {user?.role !== 'engineer' && (
            <Link 
                href="/workers"
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-bold transition-all duration-200 border border-indigo-200 text-xs md:text-sm whitespace-nowrap shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <Users className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                العمال
            </Link>
            )}
            <Link 
                href="/reports"
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 font-bold transition-all duration-200 border border-purple-200 text-xs md:text-sm whitespace-nowrap shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                التقارير
            </Link>
            {user?.role !== 'engineer' && (
            <Link 
                href="/vehicles"
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-sky-50 text-sky-700 rounded-xl hover:bg-sky-100 font-bold transition-all duration-200 border border-sky-200 text-xs md:text-sm whitespace-nowrap shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <Truck className="w-4 h-4 md:w-5 md:h-5 text-sky-600" />
                المركبات
            </Link>
            )}
            {user?.role !== 'engineer' && (
            <Link 
                href="/drivers"
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 font-bold transition-all duration-200 border border-red-200 text-xs md:text-sm whitespace-nowrap shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <UserCircle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                السائقون
            </Link>
            )}
            <Link 
                href="/users"
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-bold transition-all duration-200 border border-emerald-200 text-xs md:text-sm whitespace-nowrap shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <Users className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
                المستخدمون
            </Link>
            {user?.role !== 'viewer' && user?.role !== 'engineer' && (
              <>
                <button 
                    onClick={handleManualSave}
                    className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold transition-all duration-200 shadow-sm md:shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner text-xs md:text-sm whitespace-nowrap border border-green-700"
                >
                    <Save className="w-4 h-4 md:w-5 md:h-5" />
                    حفظ التعديلات
                </button>
                <button 
                    onClick={handleExportData}
                    className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 font-bold transition-all duration-200 border border-blue-200 text-sm whitespace-nowrap shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
                >
                    <Download className="w-5 h-5 text-blue-600" />
                    تصدير
                </button>
                <button 
                    onClick={handleImportClick}
                    className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 font-bold transition-all duration-200 border border-amber-200 text-sm whitespace-nowrap shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
                >
                    <RefreshCw className="w-5 h-5 text-amber-600" />
                    استرجاع
                </button>
              </>
            )}
            {!isMobile && (
            <button 
                onClick={() => setShowMobileAccess(true)}
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 font-bold transition-all duration-200 border border-blue-200 text-sm whitespace-nowrap shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <Smartphone className="w-5 h-5 text-blue-600" />
                <span className="hidden md:inline">تطبيق الجوال</span>
            </button>
            )}
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportChange} />
            {user?.role !== 'viewer' && user?.role !== 'engineer' && (
            <>
            <button 
                onClick={handleAutoAssign}
                className="hidden"
            />
            <button 
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 font-bold transition-all duration-200 text-sm whitespace-nowrap shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner border border-indigo-200"
            >
                <Wand2 className="w-5 h-5" />
                توزيع
            </button>
            </>
            )}
            
            {user?.role !== 'viewer' && user?.role !== 'engineer' && (
            <button 
                onClick={handleNotifyPrepare}
                className="snap-start shrink-0 flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 font-bold transition-all duration-200 border border-yellow-200 text-sm whitespace-nowrap shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner"
            >
                <Bell className="w-5 h-5 text-yellow-600" />
                توزيع الإشعارات
            </button>
            )}
            
            {/* User Profile Removed */}
            </div>
          </div>

          {/* Global Search - Moved Below */}
          <div className="w-full flex justify-start items-center mt-2 pt-2 md:mt-3 md:pt-3 border-t gap-4 flex-wrap">
             <div className="relative w-full md:w-[380px]">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="بحث (اسم، مهنة، إقامة، جنسية)..."
                  className="w-full pr-9 pl-10 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-2.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="مسح البحث"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
             </div>

             {/* Project Status Tabs */}
             <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border shadow-sm self-center">
                <button 
                    onClick={() => setProjectStatusTab('active')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${projectStatusTab === 'active' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                    <PlayCircle className="w-4 h-4" />
                    جاري العمل
                </button>
                <button 
                    onClick={() => setProjectStatusTab('stopped')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${projectStatusTab === 'stopped' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                    <PauseCircle className="w-4 h-4" />
                    متوقف
                </button>
                <button 
                    onClick={() => setProjectStatusTab('completed')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${projectStatusTab === 'completed' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                    <CheckCircle className="w-4 h-4" />
                    منتهي
                </button>
                <button 
                    onClick={() => setProjectStatusTab('archived')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${projectStatusTab === 'archived' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                >
                    <Archive className="w-4 h-4" />
                    مؤرشف
                </button>
             </div>

             {/* Notification Bell (Moved Here) */}
             {user?.role === 'admin' && (
               <div className="relative">
                 <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors relative border border-gray-200 bg-white shadow-sm self-center"
                 >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                 </button>

                 {showNotifications && (
                    <div className="absolute top-full left-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-left ring-1 ring-black/5">
                        <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
                            <span className="text-xs text-gray-500">{unreadCount} غير مقروء</span>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {(state.notifications || []).length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    لا توجد إشعارات حالياً
                                </div>
                            ) : (
                                (state.notifications || []).slice(0, 20).map(notification => (
                                    <div 
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-4 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${!notification.isRead ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                            <div>
                                                <p className={`text-sm ${!notification.isRead ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1">
                                                    {new Date(notification.createdAt).toLocaleDateString('ar-EG')} - {new Date(notification.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                 )}
               </div>
             )}
          </div>
        </header>
 
        {/* Stats Removed */}

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row">

          {/* Sidebar - Available */}
          <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l bg-white z-0 shrink-0 max-h-[45vh] md:max-h-none md:sticky md:top-[160px] md:h-[calc(100vh-160px)] md:overflow-y-auto transition-all duration-300 flex flex-col">
             <AvailableWorkers 
                workers={activeWorkers.filter(w => !w.assignedSiteId && isWorkerMatch(w))}  
                skills={state.skills}
                onAddWorker={user?.role === 'viewer' ? (() => {}) : handleAddWorker}
                onDeleteWorker={user?.role === 'viewer' || user?.role === 'engineer' ? undefined : handleDeleteWorker}
                onUpdateWorker={user?.role === 'viewer' || user?.role === 'engineer' ? undefined : handleUpdateWorker}
                onToggleEngineer={user?.role === 'viewer' || user?.role === 'engineer' ? undefined : handleToggleEngineer}
                sites={scopedState.sites}
                onAssign={user?.role === 'viewer' ? undefined : handleAssignWorker}
                searchQuery={searchQuery}
                onToggleAvailability={(user?.role as string) === 'viewer' || (user?.role as string) === 'engineer' ? undefined : handleToggleAvailability}
                isMobile={isMobile}
                onReturnAll={user?.role !== 'viewer' && user?.role !== 'engineer' ? handleReturnAllFromSites : undefined}
                orientation="vertical"
             />
          </div>
          
          {/* Canvas - Sites */}
          <div className="flex-1 p-2 md:p-6 bg-slate-100 min-h-[500px]">
             <SortableContext items={scopedState.sites.map(s => s.id)} strategy={rectSortingStrategy}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">

                 {scopedState.sites
                    .filter(site => {
                        // Status Filter
                        let status = site.status || 'active';
                        
                        if (projectStatusTab === 'active' && status !== 'active') return false;
                        if (projectStatusTab === 'stopped' && status !== 'stopped') return false;
                        if (projectStatusTab === 'archived' && status !== 'archived') return false;
                        if (projectStatusTab === 'completed' && status !== 'completed') return false;

                        if (!searchQuery) return true;
                        const hasMatchingWorker = activeWorkers.some(w => w.assignedSiteId === site.id && isWorkerMatch(w));
                        const nameMatch = site.name.toLowerCase().includes(searchQuery.toLowerCase());
                        return nameMatch || hasMatchingWorker;
                    })
                    .map(site => (
                 <SortableSite key={site.id} site={site}>
                     <SiteCard 
                      site={site} 
                      workers={[...activeWorkers.filter(w => w.assignedSiteId === site.id && (isWorkerMatch(w) || (searchQuery && site.name.toLowerCase().includes(searchQuery.toLowerCase()))))].sort((a, b) => {
                        const order = site.assignedWorkerIds || [];
                        return (order.indexOf(a.id) - order.indexOf(b.id));
                      })} 
                      skills={state.skills}
                       allWorkers={activeWorkers}
                       onDeleteWorker={(user?.role as string) === 'viewer' || (user?.role as string) === 'engineer' ? undefined : handleDeleteWorker}
                       onUpdateWorker={(user?.role as string) === 'viewer' || (user?.role as string) === 'engineer' ? undefined : handleUpdateWorker}
                       sites={scopedState.sites}
                       onAssign={(user?.role as string) === 'viewer' ? undefined : handleAssignWorker}
                      onReorder={(user?.role as string) === 'viewer' ? undefined : handleReorderSite}
                      onUpdateSite={(user?.role as string) === 'viewer' ? undefined : handleUpdateSite}
                      onToggleAvailability={(user?.role as string) === 'viewer' || (user?.role as string) === 'engineer' ? undefined : handleToggleAvailability}
                      isMobile={isMobile}
                    />
                   </SortableSite>
                 ))}
               </div>
             </SortableContext>
          </div>

        </div>
        
        <DragOverlay>
           {activeWorker ? (
               <WorkerCardView 
                   worker={activeWorker} 
                   skillDef={state.skills.find(s => s.name === activeWorker.skill)} 
                   user={user}
                   isOverlay={true}
                   isCompact={!activeWorker.assignedSiteId}
               />
           ) : null}
        </DragOverlay>

        {isConfirmNotify && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 shrink-0">
                <h3 className="font-medium text-lg text-gray-800">تأكيد إرسال إشعارات واتساب</h3>
              </div>
              <div className="p-4 text-sm text-gray-700 overflow-y-auto flex-1">
                <div className="mb-2">سيتم فتح {notifyLinks.length} محادثة واتساب.</div>
                {notifyInvalidCount > 0 && (
                  <>
                    <div className="mb-2 text-red-600">تم تجاهل {notifyInvalidCount} رقم غير صالح:</div>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 bg-red-50 border-red-200">
                      {notifyInvalids.map((e, i) => (
                        <div key={i} className="text-xs text-red-700">
                          {e.name} — {e.phone || 'بدون رقم'} — {e.reason}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="max-h-60 overflow-y-auto border rounded p-2 bg-gray-50 mt-2">
                  {notifyLinks.map((e, i) => (
                    <div key={i} className="text-xs text-gray-600 border-b last:border-0 py-1">{e.name} - {e.phone}</div>
                  ))}
                </div>
              </div>
              <div className="p-4 flex justify-end gap-2 border-t shrink-0 bg-white">
                <button onClick={() => setIsConfirmNotify(false)} className="px-3 py-2 border rounded bg-white hover:bg-gray-50">إلغاء</button>
                <button onClick={handleNotifySend} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">إرسال</button>
              </div>
            </div>
          </div>
        )}

        {/* Skill Workers Stats Modal Removed */}

        {/* Expiry Stats Modal Removed */}

        {showMobileAccess && (
          <MobileAccess onClose={() => setShowMobileAccess(false)} />
        )}



        {/* Absence Popup Removed */}
            </>
        )}
        </div>
      </div>
    </DndContext>
  );
}