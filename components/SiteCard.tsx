'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Site, Worker, SkillDefinition } from '@/types';
import { WorkerCard } from './WorkerCard';
import { MapPin, Truck, ArrowUpDown, Settings, ChevronDown, ChevronUp, Plus, X, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { buildWhatsappLink } from '@/lib/whatsapp';
import SearchableSelect from '@/components/SearchableSelect';
import Link from 'next/link';
import { useAuth } from '@/components/state/AuthContext';

interface SiteCardProps {
  site: Site;
  workers: Worker[];
  skills: SkillDefinition[];
  allWorkers?: Worker[];
  onDeleteWorker?: (id: string) => void;
  onUpdateWorker?: (id: string, name: string) => void;
  sites?: Site[];
  onAssign?: (workerId: string, siteId: string | null) => void;
  onReorder?: (siteId: string, targetSiteId: string) => void;
  onUpdateSite?: (siteId: string, updates: Partial<Site>) => void;
  onToggleAvailability?: (workerId: string, status: 'available' | 'absent') => void;
  isMobile?: boolean;
}

export function SiteCard({ site, workers, skills, allWorkers, onDeleteWorker, onUpdateWorker, sites, onAssign, onReorder, onUpdateSite, onToggleAvailability, isMobile }: SiteCardProps) {
  const { user } = useAuth();
  const { setNodeRef, isOver } = useDroppable({
    id: site.id,
    data: { type: 'site', site },
  });
  
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const availableWorkers = useMemo(() => {
    if (!allWorkers) return [];
    return allWorkers.filter(w => !w.assignedSiteId).sort((a, b) => a.name.localeCompare(b.name));
  }, [allWorkers]);

  const filteredAvailableWorkers = useMemo(() => {
    if (!searchTerm) return availableWorkers;
    const lower = searchTerm.toLowerCase();
    return availableWorkers.filter(w => w.name.toLowerCase().includes(lower) || w.skill?.toLowerCase().includes(lower));
  }, [availableWorkers, searchTerm]);

  const assignedSkills = React.useMemo(() => {
    const counts: Record<string, number> = {};
    workers.forEach(w => {
      const skillName = (w.skill || '').trim();
      if (skillName) {
        counts[skillName] = (counts[skillName] || 0) + 1;
      }
    });
    return counts;
  }, [workers]);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col h-full bg-slate-50 rounded-xl border-2 transition-colors
        ${isOver ? 'border-primary bg-blue-50' : 'border-transparent'}
      `}
    >
      {/* Site Header */}
      <div className={`p-3 md:p-4 bg-black rounded-t-xl border-b border-gray-800 ${isMobile && !isExpanded ? 'rounded-b-xl' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMobile && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                 {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
              </button>
            )}
            <Link href={`/projects?search=${encodeURIComponent(site.name)}`} className="font-medium text-lg text-white hover:text-blue-300 hover:underline transition-colors" suppressHydrationWarning>
            {site.name}
          </Link>
          {isMobile && !isExpanded && (
             <span className="text-xs text-gray-400 font-mono bg-gray-900 px-2 py-0.5 rounded-full">{workers.length}</span>
          )}
          </div>
          
          <div className="flex items-center gap-2">
            {onUpdateSite && user?.role !== 'viewer' && (
              <div className="relative">
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="p-2 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white"
                  title="إعدادات المشروع"
                >
                  <Settings className="w-5 h-5" />
                </button>
                
                {isSettingsOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border z-50 text-right p-4">
                     <div className="text-sm font-medium text-gray-800 mb-3">حالة المشروع</div>
                     <div className="mb-4">
                       <SearchableSelect
                         className="w-full"
                         placeholder="اختر الحالة..."
                         options={[
                         { value: 'active', label: 'جاري العمل' },
                         { value: 'stopped', label: 'متوقف' },
                         { value: 'archived', label: 'مؤرشف' },
                         { value: 'completed', label: 'منتهي' }
                       ]}
                         value={site.status || 'active'}
                         clearable={false}
                         onChange={(val) => {
                           onUpdateSite(site.id, { status: val as any });
                         }}
                       />
                     </div>
                     
                     <div className="text-sm font-medium text-gray-800 mb-2">ملاحظات</div>
                     <textarea 
                       className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none mb-4 h-24"
                       value={site.statusNote || ''}
                       onChange={(e) => {
                         onUpdateSite(site.id, { statusNote: e.target.value });
                       }}
                       placeholder="سبب التوقف أو ملاحظات أخرى..."
                     />
                     <button 
                       onClick={() => setIsSettingsOpen(false)}
                       className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm hover:bg-blue-700 font-medium"
                     >
                       إغلاق
                     </button>
                   </div>
                )}
              </div>
            )}

            {onReorder && sites && user?.role !== 'viewer' && (
              <div className="relative">
                <button 
                  onClick={() => setIsReorderOpen(!isReorderOpen)}
                  className="p-2 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white"
                  title="ترتيب المشروع"
                >
                  <ArrowUpDown className="w-5 h-5" />
                </button>
                
                {isReorderOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border z-50 overflow-hidden text-right">
                    <div className="p-3 border-b bg-gray-50 text-sm font-medium text-gray-600">نقل المشروع بعد...</div>
                    <div className="max-h-60 overflow-y-auto">
                      <button
                        onClick={() => {
                          onReorder(site.id, '__TOP__');
                          setIsReorderOpen(false);
                        }}
                        className="w-full px-4 py-3 text-sm text-right hover:bg-gray-50 flex items-center justify-between text-gray-700 border-b border-gray-50"
                      >
                        <span>(بداية القائمة)</span>
                      </button>
                      {sites.filter(s => s.id !== site.id).map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            onReorder(site.id, s.id);
                            setIsReorderOpen(false);
                          }}
                          className="w-full px-4 py-3 text-sm text-right hover:bg-gray-50 flex items-center justify-between text-gray-700 border-b border-gray-50 last:border-0"
                        >
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {site.engineerId && (
              <div className="text-xs text-gray-300" suppressHydrationWarning>
                {(() => {
                  const eng = (allWorkers || []).find(w => w.id === site.engineerId);
                  return eng ? `${eng.name} ${eng.englishName ? `(${eng.englishName})` : ''} - ${eng.phone}` : 'المهندس غير موجود';
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-400 mt-1" suppressHydrationWarning>
          <MapPin className="w-4 h-4" />
          <span suppressHydrationWarning>{site.location}</span>
        </div>
        
        {/* Project Status Display */}
        <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2 text-xs" suppressHydrationWarning>
                 <span className="text-gray-400">الحالة:</span>
                 <button 
                     type="button"
                     onClick={() => site.status === 'stopped' && setShowNote(!showNote)}
                     className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                     site.status === 'archived' ? 'bg-gray-700 text-gray-300 border border-gray-600' :
                     site.status === 'completed' ? 'bg-blue-900 text-blue-100 border border-blue-700' :
                     site.status === 'stopped' ? 'bg-red-900 text-red-100 border border-red-700 cursor-pointer hover:bg-red-800' :
                     'bg-green-900 text-green-100 border border-green-700'
                 }`}>
                     {site.status === 'archived' ? 'مؤرشف' :
                      site.status === 'completed' ? 'منتهي' :
                      site.status === 'stopped' ? 'متوقف' :
                      'جاري العمل'}
                 </button>
            </div>
            {showNote && site.status === 'stopped' && site.statusNote && (
                <div className="text-xs bg-red-50 text-red-800 p-2 rounded border border-red-200 animate-in fade-in slide-in-from-top-1">
                    <span className="font-medium">سبب التوقف:</span> {site.statusNote}
                </div>
            )}
        </div>

        {(() => {
             const driversToDisplay = site.assignedDrivers && site.assignedDrivers.length > 0 
                ? site.assignedDrivers 
                : (site.driverId ? [{ driverId: site.driverId, count: site.driverTransportCount || 0 }] : []);

             if (driversToDisplay.length === 0) return null;

             return (
               <div className="mt-1 flex flex-col gap-1">
                 {driversToDisplay.map((ad, idx) => {
                    const driver = (allWorkers || []).find(w => w.id === ad.driverId);
                    if (!driver) return null;

                    let text = `${driver.name} ${driver.englishName ? `(${driver.englishName})` : ''} - ${driver.phone}`;
                    if (driver.driverCarType) text += ` - ${driver.driverCarType}`;
                    if (driver.driverCarPlate) text += ` - ${driver.driverCarPlate}`;
                    if (ad.count) {
                      text += ` - ينقل: ${ad.count}`;
                    } else if (typeof driver.driverCapacity === 'number') {
                      text += ` - سعة: ${driver.driverCapacity}`;
                    }

                    return (
                      <div key={idx} className="text-[11px] text-gray-400 flex items-center gap-2" suppressHydrationWarning>
                        <Truck className="w-3.5 h-3.5 text-gray-500" />
                        <Link href={`/drivers?id=${driver.id}`} className="hover:text-blue-600 hover:underline transition-colors cursor-pointer">
                           {text}
                        </Link>
                      </div>
                    );
                 })}
               </div>
             );
        })()}
        
        
        {/* Skills Badge (Assigned / Required) */}
        <div className="mt-3 flex flex-wrap gap-2">
           {(() => {
             const required = site.requiredSkills || {};
             // Only show skills that represent workers currently in the site (assigned > 0)
             // We filter out required skills that have no workers assigned
             const allSkills = Object.keys(assignedSkills).filter(name => name && name.trim().length > 0);
             
             return allSkills.map(skillName => {
               const reqCount = required[skillName] || 0;
               const assignCount = assignedSkills[skillName] || 0;
               
                // Find definition case-insensitive
              const skillDef = skills.find(s => s.name.trim().toLowerCase() === skillName.trim().toLowerCase());
              
              // FORCE VISIBILITY:
              // Instead of relying on the possibly purged or low-contrast background classes,
              // we will extract the text color (if available) and force a white background.
              // This ensures the badge is always visible on the black header.
              
              let originalColor = skillDef?.color || '';
              let textColorClass = 'text-gray-900'; // Default text color
              
              // Extract text color class if present
              const textMatch = originalColor.match(/text-[a-z]+-\d+/);
              if (textMatch) {
                  textColorClass = textMatch[0];
              } else if (originalColor.includes('text-black')) {
                  textColorClass = 'text-black';
              }
              
              // If the text color is white or very light, force it to dark because we are using white background
              if (textColorClass.includes('white') || textColorClass.includes('gray-50') || textColorClass.includes('gray-100')) {
                  textColorClass = 'text-gray-900';
              }

              // Construct the final safe class
              // bg-white: Ensures visibility on black header
              // border-gray-200: Subtle border
              const finalClass = `bg-white border border-gray-200 shadow-sm ${textColorClass}`;

              return (
                 <span key={skillName} className={`text-xs px-2 py-1 rounded-full ${finalClass} flex items-center gap-1`}>
                   <span className="font-medium">{reqCount > 0 ? `${assignCount}/${reqCount}` : assignCount}</span>
                   <span>{skillDef?.label || skillName}</span>
                 </span>
               );
             });
           })()}
        </div>
      </div>

      {/* Workers List */}
      {(!isMobile || isExpanded) && (
        <>
      <div className="flex-1 p-2 md:p-3 min-h-[150px]">
        {/* Add Worker Button */}
        {onAssign && user?.role !== 'viewer' && (
            <button
                onClick={() => setIsAddWorkerOpen(true)}
                className="w-full mb-3 py-2 border-2 border-dashed border-blue-200 bg-blue-50/50 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
                <Plus className="w-4 h-4" />
                <span>إضافة عمال من الاستراحة</span>
            </button>
        )}

        <SortableContext 
          id={site.id}
          items={workers.map(w => w.id)}
          strategy={verticalListSortingStrategy}
        >
          {workers.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
              اسحب العمال هنا
            </div>
          ) : (
            workers.map((worker) => (
              <WorkerCard 
                  key={worker.id} 
                  worker={worker} 
                  skillDef={skills.find(s => s.name === worker.skill)}
                  onDelete={() => onDeleteWorker?.(worker.id)}
                  onUpdate={(name) => onUpdateWorker?.(worker.id, name)}
                  siteId={site.id}
                  sites={sites}
                  onAssign={onAssign}
                  whatsAppLink={buildWhatsappLink(worker, site, allWorkers || []) || undefined}
                  isMobile={isMobile}
                  onToggleAvailability={onToggleAvailability ? ((status) => onToggleAvailability(worker.id, status)) : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>
      
      <div className="p-2 text-center text-xs text-black font-bold border-t">
        إجمالي: {workers.length} عمال
      </div>
        </>
      )}

      {isAddWorkerOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">إضافة عمال إلى {site.name}</h3>
                    <button onClick={() => setIsAddWorkerOpen(false)} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Search */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="بحث عن عامل..." 
                            className="w-full pr-9 pl-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                    {filteredAvailableWorkers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <span>{availableWorkers.length === 0 ? 'لا يوجد عمال في الاستراحة' : 'لا توجد نتائج مطابقة'}</span>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {filteredAvailableWorkers.map(worker => {
                                const skill = skills.find(s => s.name === worker.skill);
                                let skillColorClass = 'bg-gray-200';
                                if (skill?.color) {
                                     // Convert text-color to bg-color approximation if needed, or just use a default indicator
                                     // Assuming skill.color is a tailwind text class like 'text-red-600'
                                     const colorMatch = skill.color.match(/text-([a-z]+)-(\d+)/);
                                     if (colorMatch) {
                                         skillColorClass = `bg-${colorMatch[1]}-${colorMatch[2]}`;
                                     } else if (skill.color.includes('black')) {
                                         skillColorClass = 'bg-gray-800';
                                     }
                                }

                                return (
                                    <button
                                        key={worker.id}
                                        onClick={() => {
                                            onAssign?.(worker.id, site.id);
                                        }}
                                        className="relative flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md text-right transition-all group overflow-hidden"
                                    >
                                        <div className={`absolute right-0 top-0 bottom-0 w-1 ${skillColorClass}`} />
                                        <div className="flex-1 mr-2">
                                            <div className="font-bold text-gray-800 group-hover:text-blue-700">{worker.name}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{worker.skill}</span>
                                                {worker.englishName && <span className="text-black font-medium">({worker.englishName})</span>}
                                            </div>
                                        </div>
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <Plus className="w-4 h-4" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-3 border-t bg-gray-50 text-center text-xs text-gray-500 flex justify-between items-center px-6">
                    <span>عدد العمال المتاحين: {filteredAvailableWorkers.length}</span>
                    <button onClick={() => setIsAddWorkerOpen(false)} className="text-blue-600 hover:underline">إغلاق</button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}
