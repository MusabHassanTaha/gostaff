'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Worker, SkillDefinition, Site } from '@/types';
import { GripVertical, User, Pencil, Trash, X, Check, HardHat, MessageCircle, ChevronDown, MoveRight, UserX, UserCheck, Eye, CalendarClock, ArrowRightLeft, Briefcase } from 'lucide-react';
import { daysRemaining, statusClasses, labelFor, calculateDaysWorked } from '@/lib/date';
import { useAuth } from '@/components/state/AuthContext';
import { StatusModal } from './StatusModal';

interface WorkerCardProps {
  worker: Worker;
  skillDef?: SkillDefinition;
  onDelete?: () => void;
  onUpdate?: (newName: string) => void;
  onToggleEngineer?: () => void;
  siteId?: string;
  whatsAppLink?: string;
  sites?: Site[];
  onAssign?: (workerId: string, siteId: string | null) => void;
  hideSkillLabel?: boolean;
  onToggleAvailability?: (status: 'available' | 'absent') => void;
  isCompact?: boolean;
  isMobile?: boolean;
}

export function WorkerCard({ worker, skillDef, onDelete, onUpdate, onToggleEngineer, siteId, whatsAppLink, sites, onAssign, hideSkillLabel, onToggleAvailability, isCompact, isMobile }: WorkerCardProps) {
  const { user } = useAuth();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: worker.id,
    data: {
      type: 'worker',
      worker,
      siteId,
      workerId: worker.id
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <WorkerCardView
      worker={worker}
      skillDef={skillDef}
      isCompact={isCompact}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={style}
      attributes={attributes}
      listeners={listeners}
      user={user}
      onDelete={onDelete}
      onUpdate={onUpdate}
      onToggleEngineer={onToggleEngineer}
      siteId={siteId}
      whatsAppLink={whatsAppLink}
      sites={sites}
      onAssign={onAssign}
      hideSkillLabel={hideSkillLabel}
      onToggleAvailability={onToggleAvailability}
      isMobile={isMobile}
    />
  );
}

interface WorkerCardViewProps extends WorkerCardProps {
  user: any;
  isDragging?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  attributes?: any;
  listeners?: any;
  isOverlay?: boolean;
}

export function WorkerCardView({ 
  worker, skillDef, onDelete, onUpdate, onToggleEngineer, siteId, whatsAppLink, sites, onAssign, hideSkillLabel, onToggleAvailability, isCompact, isMobile,
  user, isDragging, setNodeRef, style, attributes, listeners, isOverlay
}: WorkerCardViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editName, setEditName] = useState(worker.name);
  const [mounted, setMounted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (showMoveMenu) {
      const handleClose = (e: Event) => {
          // If scroll event, ignore if inside menu
          if (e.type === 'scroll' && menuRef.current && menuRef.current.contains(e.target as Node)) {
              return;
          }
          // If click event, ignore if inside menu
          if (e.type === 'click' && menuRef.current && menuRef.current.contains(e.target as Node)) {
              return;
          }
          setShowMoveMenu(false);
      };

      window.addEventListener('click', handleClose);
      window.addEventListener('resize', handleClose);
      window.addEventListener('scroll', handleClose, { capture: true });
      return () => {
         window.removeEventListener('click', handleClose);
         window.removeEventListener('resize', handleClose);
         window.removeEventListener('scroll', handleClose, { capture: true });
      };
    }
  }, [showMoveMenu]);

  const handleSave = () => {
    if (editName.trim() && onUpdate) {
        onUpdate(editName);
    }
    setIsEditing(false);
  };

  // Fallback if skillDef is missing (shouldn't happen if properly wired)
  const label = skillDef?.label || worker.skill;
  const colorClass = skillDef?.color || 'bg-gray-100 text-gray-700';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative flex items-center ${isCompact ? 'gap-2 p-1.5 mb-1' : 'gap-3 p-3 mb-2'} bg-white rounded-lg shadow-sm border border-gray-200 
        ${!isOverlay ? 'hover:shadow-md hover:bg-blue-50 hover:border-blue-300 transition-all select-none group touch-auto md:touch-none cursor-grab active:cursor-grabbing' : 'shadow-xl ring-2 ring-blue-500 cursor-grabbing'}
        ${isDragging ? 'opacity-50 z-50' : ''}
      `}
    >
      {/* Drag Handle & Menu */}
      <div>
        <div 
          ref={buttonRef} 
          onClick={(e) => {
             e.stopPropagation();
             if (sites && onAssign) {
                if (!showMoveMenu) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceAbove = rect.top;
                    
                    // Determine direction and max height
                    // Prefer down unless space is tight (< 250px) and there's more space above
                    const openUp = spaceBelow < 250 && spaceAbove > spaceBelow;
                    
                    const style: React.CSSProperties = {
                        right: window.innerWidth - rect.right,
                        position: 'fixed',
                        zIndex: 9999,
                    };

                    if (openUp) {
                        style.bottom = window.innerHeight - rect.top + 4;
                        style.maxHeight = Math.min(spaceAbove - 20, 400); // Max 400px or available space
                    } else {
                        style.top = rect.bottom + 4;
                        style.maxHeight = Math.min(spaceBelow - 20, 400);
                    }
                    
                    setMenuStyle(style);
                    setShowMoveMenu(true);
                } else {
                    setShowMoveMenu(false);
                }
             }
          }}
          className={`hover:bg-gray-100 ${isMobile ? 'p-2 bg-gray-50 border border-gray-200 shadow-sm' : 'p-1'} rounded flex items-center gap-0.5 cursor-pointer transition-all active:scale-95`}
          title="خيارات النقل"
        >
          {isMobile ? (
             <ArrowRightLeft className="w-5 h-5 text-blue-600" />
          ) : (
             <GripVertical className="w-5 h-5 text-gray-400" />
          )}
          {(sites && onAssign) && <ChevronDown className={`w-3 h-3 ${isMobile ? 'text-blue-400' : 'text-gray-400'}`} />}
        </div>
        
        {showMoveMenu && sites && onAssign && createPortal(
          <>
            {isMobile && (
                <div className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm" onClick={() => setShowMoveMenu(false)} />
            )}
            <div 
                ref={menuRef}
                className={isMobile 
                    ? "fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] border-t border-gray-200 z-[9999] max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200"
                    : "w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-y-auto overscroll-contain"
                }
                style={isMobile ? {} : menuStyle}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
            >
                {isMobile && (
                    <div className="flex justify-center pt-3 pb-1" onClick={() => setShowMoveMenu(false)}>
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                    </div>
                )}
                <div className="p-4 text-sm font-bold text-gray-800 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-normal">نقل العامل:</span>
                        <span className="text-primary text-base">{worker.name}</span>
                    </div>
                    {isMobile && (
                        <button onClick={() => setShowMoveMenu(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors">
                            <X className="w-4 h-4 text-gray-700" />
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto overscroll-contain flex-1 p-2">
                    <div className="text-xs font-bold text-gray-400 px-2 py-1 mb-1">اختر الوجهة:</div>
                    <button 
                        onClick={() => { onAssign(worker.id, null); setShowMoveMenu(false); }}
                        className="w-full text-right px-4 py-3.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-3 border border-red-100 rounded-xl mb-2 active:bg-red-100 bg-white shadow-sm"
                    >
                        <div className="p-1.5 bg-red-100 rounded-lg">
                            <X className="w-5 h-5" />
                        </div>
                        <span className="font-bold">إلغاء التعيين (عودة للانتظار)</span>
                    </button>
                    {sites.map(site => (
                    <button 
                        key={site.id}
                        onClick={() => { onAssign(worker.id, site.id); setShowMoveMenu(false); }}
                        className={`w-full text-right px-4 py-3.5 text-sm hover:bg-blue-50 flex items-center gap-3 border rounded-xl mb-2 active:bg-blue-100 shadow-sm transition-all ${site.id === siteId ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white border-gray-100 text-gray-700'}`}
                    >
                        <div className={`p-1.5 rounded-lg ${site.id === siteId ? 'bg-blue-200' : 'bg-gray-100'}`}>
                            <MoveRight className={`w-5 h-5 ${site.id === siteId ? 'text-blue-700' : 'text-gray-500'}`} />
                        </div>
                        <span className={`font-bold truncate ${site.id === siteId ? 'text-blue-800' : 'text-gray-800'}`}>{site.name}</span>
                        {site.id === siteId && <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full mr-auto">الحالي</span>}
                    </button>
                    ))}
                    {sites.length === 0 && (
                        <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                            <Briefcase className="w-8 h-8 opacity-20" />
                            <span className="text-sm">لا توجد مشاريع متاحة للنقل</span>
                        </div>
                    )}
                </div>
            </div>
          </>,
          document.body
        )}
      </div>

      {/* Worker Image */}
      <div className={`flex-shrink-0 ${isCompact ? 'w-[16px] h-[16px]' : 'w-[20px] h-[20px]'} bg-gray-100 rounded-full flex items-center justify-center`}>
        <User className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-gray-500`} />
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
            <div className="flex items-center gap-2">
                <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    autoFocus
                />
                <button onClick={handleSave} className="text-green-600 hover:bg-green-50 p-1 rounded">
                    <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditing(false)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                    <X className="w-4 h-4" />
                </button>
            </div>
        ) : (
            <>
            <div className={`flex ${(isCompact || isMobile) ? 'flex-col items-stretch gap-2' : 'justify-between items-center'}`}>
                {isCompact ? (
                    <div className="flex flex-col w-full text-right px-1">
                        <div className="flex items-center gap-2 w-full">
                            {worker.code && (
                                <span className="text-[10px] font-mono font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 shadow-sm border border-gray-200">
                                    {worker.code}
                                </span>
                            )}
                            {(user?.role as string) === 'engineer' ? (
                                <span 
                                    className="text-sm font-bold text-gray-900 leading-tight truncate cursor-default"
                                    title={worker.name}
                                >
                                    {worker.name}
                                </span>
                            ) : (
                                <Link 
                                    href={`/workers?search=${encodeURIComponent(worker.name)}`}
                                    className="text-sm font-bold text-gray-900 leading-tight hover:text-blue-600 hover:underline truncate"
                                    title={worker.name}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {worker.name}
                                </Link>
                            )}
                        </div>
                        {worker.englishName && (
                            <p 
                                className="text-[10px] text-gray-500 font-medium leading-tight mt-1 truncate w-full text-left dir-ltr"
                                title={worker.englishName}
                            >
                                {worker.englishName}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col min-w-0">
                        {(user?.role as string) === 'engineer' ? (
                            <span 
                                className="font-medium text-gray-900 block cursor-default"
                                title={worker.name}
                            >
                                {worker.code && <span className="text-black text-xs font-normal ml-1">({worker.code})</span>}
                                {worker.name}
                            </span>
                        ) : (
                            <Link 
                                href={`/workers?search=${encodeURIComponent(worker.name)}`}
                                className="font-medium text-gray-900 hover:text-blue-600 hover:underline block"
                                title={worker.name}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {worker.code && <span className="text-black text-xs font-normal ml-1">({worker.code})</span>}
                                {worker.name}
                            </Link>
                        )}
                        {worker.englishName && (
                            <p 
                                className={`text-xs text-black font-medium leading-tight mt-0.5 ${isMobile ? 'text-left dir-ltr' : ''}`}
                                title={worker.englishName}
                            >
                                {worker.englishName}
                            </p>
                        )}
                    </div>
                )}
                
                {/* Action Buttons */}
                <div className={`flex flex-shrink-0 ${isMobile ? 'gap-2 justify-between flex-wrap border-t border-gray-100 pt-2 mt-2 w-full' : isCompact ? 'gap-1 justify-end border-t border-gray-50 pt-1 mt-1' : 'gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity'}`}>
                    {onToggleAvailability && user?.role !== 'viewer' && user?.role !== 'engineer' && (
                        <button 
                            onClick={() => onToggleAvailability(worker.availabilityStatus === 'absent' ? 'available' : 'absent')}
                            className={`${isMobile ? 'p-2' : 'p-1'} rounded ${worker.availabilityStatus === 'absent' ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
                            title={worker.availabilityStatus === 'absent' ? 'تسجيل كحاضر (انتظار)' : 'تسجيل غياب'}
                        >
                            {worker.availabilityStatus === 'absent' ? <UserCheck className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} /> : <UserX className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />}
                        </button>
                    )}
                    {user?.role !== 'viewer' && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsStatusModalOpen(true);
                            }}
                            className={`${isMobile ? 'p-2' : 'p-1'} text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded`}
                            title="إدارة الحالة (غياب/إجازة)"
                        >
                            <CalendarClock className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        </button>
                    )}
                    {whatsAppLink && user?.role !== 'engineer' && (
                        <a 
                            href={whatsAppLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className={`${isMobile ? 'p-2' : 'p-1'} text-gray-400 hover:text-green-600 hover:bg-green-50 rounded`}
                            title="إشعار عبر واتساب"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MessageCircle className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        </a>
                    )}
                    {worker.iqamaImage && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowPreview(true);
                            }}
                            className={`${isMobile ? 'p-2' : 'p-1'} text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded`}
                            title="معاينة الإقامة"
                        >
                            <Eye className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        </button>
                    )}
                    {onToggleEngineer && user?.role !== 'viewer' && user?.role !== 'engineer' && (
                        <button 
                            onClick={onToggleEngineer}
                            className={`${isMobile ? 'p-2' : 'p-1'} rounded ${worker.isEngineer ? 'text-indigo-600 hover:bg-indigo-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            title={worker.isEngineer ? 'إلغاء تمييز مهندس' : 'تمييز كمهندس'}
                        >
                            <HardHat className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        </button>
                    )}
                    {onUpdate && user?.role !== 'viewer' && user?.role !== 'engineer' && (
                        <button 
                            onClick={() => {
                                setEditName(worker.name);
                                setIsEditing(true);
                            }}
                            className={`${isMobile ? 'p-2' : 'p-1'} text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded`}
                            title="تعديل الاسم"
                        >
                            <Pencil className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        </button>
                    )}
                    {onDelete && user?.role !== 'viewer' && user?.role !== 'engineer' && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`هل أنت متأكد من حذف العامل "${worker.name}"؟`)) {
                                    onDelete();
                                }
                            }}
                            className={`${isMobile ? 'p-2' : 'p-1'} text-gray-400 hover:text-red-600 hover:bg-red-50 rounded`}
                            title="حذف العامل"
                        >
                            <Trash className={isMobile ? "w-5 h-5" : "w-3.5 h-3.5"} />
                        </button>
                    )}
                </div>
            </div>
                {isMobile && !isCompact ? (
                  <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1 select-none">
                    {worker.isEngineer && (
                      <span className="flex-shrink-0 text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 whitespace-nowrap border border-indigo-200 font-medium">
                        مهندس
                      </span>
                    )}
                    
                    {!hideSkillLabel && (
                        <div className={`flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-full whitespace-nowrap border border-gray-200 font-medium ${colorClass}`}>
                            <HardHat className="w-3 h-3" />
                            <span>{label}</span>
                        </div>
                    )}
                    
                    <div className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-gray-50 text-gray-600 whitespace-nowrap border border-gray-200 font-mono" dir="ltr">
                        <span>{worker.phone || '-'}</span>
                    </div>

                    {(() => {
                        let dateStr = worker.availabilityStatus === 'waiting' ? worker.waitingSince : 
                                      worker.availabilityStatus === 'absent' ? worker.absentSince : undefined;
                        let prefix = worker.availabilityStatus === 'waiting' ? 'انتظار منذ' : 
                                     worker.availabilityStatus === 'absent' ? 'غائب منذ' : undefined;
                        
                        if (!dateStr && worker.hireDate) {
                             dateStr = worker.hireDate;
                             prefix = 'منذ';
                        }
                        
                        const days = calculateDaysWorked(dateStr);
                        if (days !== undefined && prefix) {
                            return (
                                <div className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap border border-blue-100 font-medium">
                                    <span>{prefix} {days} يوم</span>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div className="flex-shrink-0 flex gap-2" suppressHydrationWarning>
                        {mounted && (() => {
                          const d = daysRemaining(worker.iqamaExpiry);
                          const cls = statusClasses(d);
                          const text = labelFor(d, !!worker.iqamaExpiry);
                          return <span className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap border border-gray-100 font-medium ${cls}`}>الإقامة: {text}</span>;
                        })()}
                        {mounted && (() => {
                          const d = daysRemaining(worker.insuranceExpiry);
                          const cls = statusClasses(d);
                          const text = labelFor(d, !!worker.insuranceExpiry);
                          return <span className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap border border-gray-100 font-medium ${cls}`}>التأمين: {text}</span>;
                        })()}
                    </div>
                  </div>
                ) : (
                 <>
                {worker.isEngineer && !isCompact && (
                  <div className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 w-fit mt-1">
                    مهندس
                  </div>
                )}
                {!hideSkillLabel && !isCompact && (
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${colorClass}`}>
                        <HardHat className="w-3 h-3" />
                        <span>{label}</span>
                    </div>
                )}
                {!isCompact && (
                <div className="mt-1 flex flex-wrap gap-2" suppressHydrationWarning>
                    {mounted && (() => {
                      const d = daysRemaining(worker.iqamaExpiry);
                      const cls = statusClasses(d);
                      const text = labelFor(d, !!worker.iqamaExpiry);
                      return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>الإقامة: {text}</span>;
                    })()}
                    {mounted && (() => {
                      const d = daysRemaining(worker.insuranceExpiry);
                      const cls = statusClasses(d);
                      const text = labelFor(d, !!worker.insuranceExpiry);
                      return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>التأمين: {text}</span>;
                    })()}
                </div>
                )}
                 </>
                )}
            </>
        )}
      </div>
      {showPreview && worker.iqamaImage && createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={(e) => {
                e.stopPropagation();
                setShowPreview(false);
            }}
        >
            <div 
                className="relative bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-900 text-sm">إقامة: {worker.name}</h3>
                    <button 
                        onClick={() => setShowPreview(false)}
                        className="p-1.5 hover:bg-white rounded-full text-gray-500 hover:text-red-500 transition-colors shadow-sm border border-transparent hover:border-gray-200"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 overflow-auto bg-gray-100 flex items-center justify-center min-h-[200px]">
                    <img 
                        src={worker.iqamaImage} 
                        alt={`Iqama for ${worker.name}`} 
                        className="max-w-full h-auto object-contain rounded-lg shadow-sm"
                    />
                </div>
            </div>
        </div>,
        document.body
      )}
      {isStatusModalOpen && createPortal(
        <StatusModal worker={worker} onClose={() => setIsStatusModalOpen(false)} />,
        document.body
      )}
    </div>
  );
}
