'use client';

import React, { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Worker, SkillDefinition, Site } from '@/types';
import { WorkerCard } from './WorkerCard';
import { Search, Filter, ChevronDown, ChevronUp, Briefcase, LogOut } from 'lucide-react';

interface AvailableWorkersProps {
  workers: Worker[];
  skills: SkillDefinition[];
  onAddWorker: (worker: Worker) => void;
  onDeleteWorker?: (id: string) => void;
  onUpdateWorker?: (id: string, name: string) => void;
  onToggleEngineer?: (id: string) => void;
  sites?: Site[];
  onAssign?: (workerId: string, siteId: string | null) => void;
  searchQuery?: string;
  onManageSkills?: () => void;
  onToggleAvailability?: (workerId: string, status: 'available' | 'absent') => void;
  isMobile?: boolean;
  onReturnAll?: () => void;
}

export function AvailableWorkers({ workers, skills, onDeleteWorker, onUpdateWorker, onToggleEngineer, sites, onAssign, searchQuery, onManageSkills, onToggleAvailability, isMobile, onReturnAll }: AvailableWorkersProps) {
  const { setNodeRef } = useDroppable({
    id: 'available',
    data: { type: 'available' },
  });

  const [activeTab, setActiveTab] = useState<'waiting' | 'absent' | 'rest'>('waiting');

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
       if (activeTab === 'waiting') return w.availabilityStatus === 'waiting' || w.availabilityStatus === 'available' || !w.availabilityStatus;
       if (activeTab === 'absent') return w.availabilityStatus === 'absent';
       if (activeTab === 'rest') return w.availabilityStatus === 'rest';
       return false;
    }).sort((a, b) => (b.isEngineer ? 1 : 0) - (a.isEngineer ? 1 : 0));
  }, [workers, activeTab]);

  const waitingCount = workers.filter(w => w.availabilityStatus === 'waiting' || w.availabilityStatus === 'available' || !w.availabilityStatus).length;
  const absentCount = workers.filter(w => w.availabilityStatus === 'absent').length;
  const restCount = workers.filter(w => w.availabilityStatus === 'rest').length;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header for Persistent Side Panel */}
      <div className="p-2 md:p-3 bg-gray-50 border-b flex justify-between items-center">
        <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            قائمة الانتظار والجاهزية
        </h2>
        <div className="flex items-center gap-2">
            {onReturnAll && (
                <button 
                    onClick={onReturnAll}
                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200 transition-colors shadow-sm"
                    title="إرجاع الكل للاستراحة"
                >
                    <LogOut className="w-4 h-4 rotate-180" />
                </button>
            )}
            <span className="bg-white px-2 py-0.5 rounded text-xs border border-gray-200 text-gray-600 font-mono">
                {workers.length}
            </span>
        </div>
      </div>

      <div className="flex flex-col border-b bg-white">
          <div className="grid grid-cols-3 md:flex md:border-b md:overflow-x-auto md:no-scrollbar w-full">
              <button 
                  onClick={() => setActiveTab('waiting')}
                  className={`flex-1 md:min-w-[30%] py-2 md:py-3 text-[11px] md:text-sm font-medium border-b-2 transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      activeTab === 'waiting' 
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${activeTab === 'waiting' ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                    <span>انتظار</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] md:text-xs ${activeTab === 'waiting' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {waitingCount}
                  </span>
              </button>
              <button 
                  onClick={() => setActiveTab('absent')}
                  className={`flex-1 md:min-w-[30%] py-2 md:py-3 text-[11px] md:text-sm font-medium border-b-2 transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      activeTab === 'absent' 
                      ? 'border-red-600 text-red-700 bg-red-50/50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${activeTab === 'absent' ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                    <span>غياب</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] md:text-xs ${activeTab === 'absent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {absentCount}
                  </span>
              </button>
              <button 
                  onClick={() => setActiveTab('rest')}
                  className={`flex-1 md:min-w-[30%] py-2 md:py-3 text-[11px] md:text-sm font-medium border-b-2 transition-colors flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 ${
                      activeTab === 'rest' 
                      ? 'border-amber-600 text-amber-700 bg-amber-50/50' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${activeTab === 'rest' ? 'bg-amber-500' : 'bg-gray-300'}`}></span>
                    <span>إجازة</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] md:text-xs ${activeTab === 'rest' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {restCount}
                  </span>
              </button>
          </div>
      </div>

      <div ref={setNodeRef} className="flex-1 overflow-y-auto bg-gray-50/50 p-2">
        {filteredWorkers.length > 0 ? (
          filteredWorkers.map((worker) => (
            <WorkerCard 
              key={worker.id} 
              worker={worker} 
              skillDef={skills.find(s => s.name === worker.skill)}
              onDelete={() => onDeleteWorker?.(worker.id)}
              onUpdate={(name) => onUpdateWorker?.(worker.id, name)}
              onToggleEngineer={() => onToggleEngineer?.(worker.id)}
              sites={sites}
              onAssign={onAssign}
              hideSkillLabel={!isMobile}
              onToggleAvailability={onToggleAvailability ? (status) => onToggleAvailability(worker.id, status) : undefined}
              isCompact={false}
              isMobile={isMobile}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm p-4">
            <Briefcase className="w-8 h-8 mb-2 opacity-20" />
            <p>
              {activeTab === 'waiting' ? 'لا يوجد عمال في الانتظار' : 
               activeTab === 'absent' ? 'لا يوجد غياب مسجل' : 
               'لا يوجد عمال في إجازة'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
