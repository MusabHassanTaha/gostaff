'use client';

import React, { useState } from 'react';
import { Worker, Notification } from '@/types';
import { X, Calendar, UserX, Clock } from 'lucide-react';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';

interface StatusModalProps {
  worker: Worker;
  onClose: () => void;
}

export function StatusModal({ worker, onClose }: StatusModalProps) {
  const { user } = useAuth();
  const { recordAbsence, recordLeave, updateWorkerStatus, setState } = useAppState();
  const [activeTab, setActiveTab] = useState<'absence' | 'leave'>('absence');

  const getTodayLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  };

  // Absence State
  const [absenceDate, setAbsenceDate] = useState(getTodayLocal());
  const [absenceReason, setAbsenceReason] = useState('');

  // Leave State
  const [leaveStart, setLeaveStart] = useState(getTodayLocal());
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveType, setLeaveType] = useState<'annual' | 'sick' | 'emergency' | 'other'>('annual');
  const [leaveNotes, setLeaveNotes] = useState('');

  // Annual Leave Balance State
  const [annualTotal, setAnnualTotal] = useState(worker.annualLeaveTotal || 30);

  // Calculate stats
  const currentYear = new Date().getFullYear();
  const usedDays = (worker.leaveHistory || []).reduce((acc, l) => {
      const lYear = new Date(l.startDate).getFullYear();
      if (lYear === currentYear && l.type === 'annual') {
          const s = new Date(l.startDate);
          const e = new Date(l.endDate);
          const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          return acc + diff;
      }
      return acc;
  }, 0);
  const remainingBalance = annualTotal - usedDays;

  const handleUpdateAnnualTotal = (newTotal: number) => {
      setAnnualTotal(newTotal);
      setState(prev => ({
          ...prev,
          workers: prev.workers.map(w => w.id === worker.id ? { ...w, annualLeaveTotal: newTotal } : w)
      }));
  };

  const handleRecordAbsence = () => {
    if (!absenceDate) return;
    recordAbsence(worker.id, absenceDate, absenceReason, user?.username || 'Admin');

    // Notification Logic
    const newNotification: Notification = {
        id: `notif-${Date.now()}`,
        type: 'absence_report',
        targetId: worker.id,
        message: `تم تسجيل تقرير غياب جديد للعامل: ${worker.name}`,
        isRead: false,
        createdAt: Date.now()
    };
    setState(prev => ({
        ...prev,
        notifications: [newNotification, ...(prev.notifications || [])]
    }));

    alert('تم تسجيل الغياب بنجاح');
    onClose();
  };

  const handleRecordLeave = () => {
    if (!leaveStart || !leaveEnd) {
      alert('الرجاء تحديد تاريخ البداية والنهاية');
      return;
    }
    if (leaveEnd < leaveStart) {
      alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }
    recordLeave(worker.id, {
      startDate: leaveStart,
      endDate: leaveEnd,
      type: leaveType,
      notes: leaveNotes
    });
    updateWorkerStatus(worker.id, 'rest');
    alert('تم تسجيل الإجازة بنجاح');
    onClose();
  };

  const handleReturnToWork = () => {
    // Determine status based on assignment
    const newStatus = worker.assignedSiteId ? 'available' : 'waiting';
    updateWorkerStatus(worker.id, newStatus);
    alert('تم تسجيل عودة العامل للعمل');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h3 className="font-medium text-lg text-gray-800">
            إدارة حالة العامل: <span className="text-primary">{worker.name}</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 border-b bg-white flex gap-2">
          <button
            onClick={() => setActiveTab('absence')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'absence' ? 'bg-red-50 text-red-700 border border-red-200' : 'text-gray-600 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <UserX className="w-4 h-4" />
            تسجيل غياب
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'leave' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50 border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            تسجيل إجازة
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === 'absence' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الغياب
                </label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">سبب الغياب (اختياري)</label>
                <textarea
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none"
                  placeholder="مثال: مريض، ظروف عائلية..."
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleRecordAbsence}
                  className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm"
                >
                  تسجيل الغياب وتحديث الحالة
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Annual Leave Balance Section */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-blue-800 text-sm">رصيد الإجازة السنوية ({currentYear})</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-white p-2 rounded border border-blue-100">
                          {/* Label removed */}
                          <input 
                            type="number" 
                            value={annualTotal}
                            onChange={(e) => setAnnualTotal(parseInt(e.target.value) || 0)}
                            onBlur={() => handleUpdateAnnualTotal(annualTotal)}
                            className="w-full text-center font-bold text-blue-700 border-b border-blue-200 focus:outline-none focus:border-blue-500"
                          />
                      </div>
                      <div className="bg-white p-2 rounded border border-blue-100">
                          {/* Label removed */}
                          <div className="font-bold text-red-600">{usedDays}</div>
                      </div>
{/* Remaining removed */}
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ النهاية</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الإجازة</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="annual">إجازة سنوية</option>
                  <option value="sick">إجازة مرضية</option>
                  <option value="emergency">إجازة طارئة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                  placeholder="ملاحظات إضافية..."
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleRecordLeave}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  تسجيل الإجازة وتحديث الحالة
                </button>
              </div>
            </div>
          )}

          {/* Quick Action: Return to Work */}
          {(worker.availabilityStatus === 'absent' || worker.availabilityStatus === 'rest') && (
            <div className="mt-6 pt-4 border-t border-gray-100">
               <button
                  onClick={handleReturnToWork}
                  className="w-full py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-medium transition-colors"
                >
                  تسجيل عودة للعمل (إلغاء الغياب/الإجازة)
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
