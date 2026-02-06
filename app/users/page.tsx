'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/state/AuthContext';
import { useAppState } from '@/components/state/AppStateContext';
import SearchableSelect from '@/components/SearchableSelect';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, UserPlus, Trash2, Edit2, Check, X, Eye, EyeOff, Mail, UserCheck, UserX, AlertCircle, Shield, Lock, Search, HardHat, MapPin, Building2, Calendar, MessageCircle } from 'lucide-react';
import { Site } from '@/types';

function UserProjectsModal({ user, sites, onClose }: { user: any, sites: Site[], onClose: () => void }) {
    const assignedSites = sites.filter(s => user.assignedProjectIds?.includes(s.id));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <HardHat className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">المشاريع المعينة</h3>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">للمستخدم: {user.username}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 custom-scrollbar">
                    {assignedSites.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {assignedSites.map(site => (
                                <div key={site.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 group hover:border-blue-200">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="bg-blue-50 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                                            <Building2 className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                            site.status === 'active' ? 'bg-green-100 text-green-700' :
                                            site.status === 'stopped' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {site.status === 'active' ? 'نشط' : site.status === 'stopped' ? 'متوقف' : 'مؤرشف'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-lg mb-2">{site.name}</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span className="truncate">{site.location || 'غير محدد'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>{site.statusNote || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                            <Building2 className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">لا توجد مشاريع معينة لهذا المستخدم</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
}

function UserEditModal({ 
    editForm, 
    setEditForm, 
    sites, 
    onClose, 
    onSave 
}: { 
    editForm: any, 
    setEditForm: (form: any) => void, 
    sites: Site[], 
    onClose: () => void, 
    onSave: () => void 
}) {
    const projectOptions = useMemo(() => sites.map(s => ({ value: s.id, label: s.name })), [sites]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-blue-600" />
                        تعديل المستخدم
                    </h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">اسم المستخدم</label>
                        <input 
                            value={editForm.username} 
                            onChange={e => setEditForm({...editForm, username: e.target.value})}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">الصلاحية</label>
                        <div className="relative">
                            <select
                                value={editForm.role}
                                onChange={e => setEditForm({...editForm, role: e.target.value})}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none bg-white font-bold"
                            >
                                <option value="viewer">مشاهد (Viewer)</option>
                                <option value="engineer">مهندس (Engineer)</option>
                                <option value="supervisor">مسؤول عمال (Supervisor)</option>
                                <option value="admin">مسؤول (Admin)</option>
                            </select>
                            <Shield className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">المشاريع المعينة</label>
                        <SearchableSelect
                            options={projectOptions}
                            value={editForm.assignedProjectIds}
                            onChange={(val) => setEditForm({...editForm, assignedProjectIds: val})}
                            placeholder="اختر المشاريع..."
                            isMulti={true}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور (اختياري)</label>
                        <input 
                            type="text"
                            value={editForm.password}
                            onChange={e => setEditForm({...editForm, password: e.target.value})}
                            placeholder="اتركه فارغاً للإبقاء على الحالية"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono font-bold"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl font-bold transition-colors">إلغاء</button>
                    <button onClick={onSave} className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 font-bold transition-colors shadow-sm flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        حفظ التغييرات
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function UsersPage() {
  const { user, users, addUser, updateUser, deleteUser, isLoading } = useAuth();
  const { state: globalState } = useAppState();
  const router = useRouter();
  
  const projectOptions = useMemo(() => globalState.sites.map(s => ({ value: s.id, label: s.name })), [globalState.sites]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'engineer' | 'supervisor' | 'viewer'>('viewer');
  const [showPassword, setShowPassword] = useState(false);

  const [changePasswordForm, setChangePasswordForm] = useState('');

  // Protect page: Allow logged in users
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
      return null;
  }

  const isAdmin = user.role === 'admin'; 

  // Non-admin view: Change Password Only
  if (!isAdmin) {
      return (
        <div className="min-h-screen bg-gray-50/50 p-6 lg:p-10 animate-fade-in font-cairo" dir="rtl">
            <div className="w-full max-w-md mx-auto mt-10">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">إعدادات الحساب</h1>
                    <Link href="/" className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold transition-colors">الرئيسية</Link>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 pb-4 border-b">
                        <Lock className="w-5 h-5 text-primary" />
                        تغيير كلمة المرور
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور الجديدة</label>
                            <input 
                                type="password" 
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                                value={changePasswordForm}
                                onChange={(e) => setChangePasswordForm(e.target.value)}
                                placeholder="أدخل كلمة المرور الجديدة"
                            />
                        </div>
                        <button 
                            onClick={() => {
                                if (!changePasswordForm) return;
                                updateUser(user.username, { password: changePasswordForm });
                                setChangePasswordForm('');
                                alert('تم تحديث كلمة المرور بنجاح');
                            }}
                            disabled={!changePasswordForm}
                            className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold shadow-sm"
                        >
                            حفظ التغييرات
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    // Admin adds user directly as active
    addUser({ 
        username: username.trim(), 
        password, 
        email: email.trim(), 
        status: 'active',
        role: role
    });
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('viewer');
  };

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [viewProjectsUser, setViewProjectsUser] = useState<any | null>(null); // State for viewing projects modal
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'viewer' as const, assignedProjectIds: [] as string[] });

  const startEdit = (user: any) => {
    setEditingUser(user.username);
    setEditForm({ 
        username: user.username, 
        password: (user.password && !user.password.startsWith('$2')) ? user.password : '', 
        role: user.role || 'viewer',
        assignedProjectIds: user.assignedProjectIds || []
    });
  };

  const saveEdit = () => {
    if (!editingUser) return;
    
    // If username changed, we need to add new and delete old because username is key
    if (editingUser !== editForm.username) {
        // Check if new username exists
        if (activeUsers.some(u => u.username === editForm.username)) {
            alert('اسم المستخدم موجود بالفعل');
            return;
        }
        
        const updateData: any = {
            username: editForm.username,
            role: editForm.role,
            status: 'active',
            assignedProjectIds: editForm.assignedProjectIds
        };
        if (editForm.password) updateData.password = editForm.password;

        // Update user (renaming works because updateUser finds by old username and spreads new props)
        updateUser(editingUser, updateData);
    } else {
        // Just update
        const updateData: any = {
            role: editForm.role,
            assignedProjectIds: editForm.assignedProjectIds
        };
        if (editForm.password) updateData.password = editForm.password;

        updateUser(editingUser, updateData);
    }
    setEditingUser(null);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 lg:p-10 animate-fade-in font-cairo" dir="rtl">
      <div className="w-full max-w-[1920px] mx-auto px-4 py-8 md:p-10">
        <div className="flex flex-col items-start gap-3 mb-8">
            <h1 className="text-3xl font-bold text-gray-900 font-cairo">إدارة المستخدمين</h1>
             <Link href="/" className="px-4 py-2 rounded-lg text-gray-600 hover:text-primary hover:bg-primary/5 transition-all duration-200 font-bold flex items-center gap-2 font-cairo border border-transparent hover:border-primary/10">
                <ArrowRight className="w-5 h-5" />
                الرئيسية
            </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Add User Form - Sidebar - Only Admin */}
          {isAdmin && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 pb-4 border-b">
                  <UserPlus className="w-6 h-6 text-primary" />
                  تسجيل جديد (مباشر)
                </h2>
                <form onSubmit={handleAdd} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">اسم المستخدم</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="أدخل اسم المستخدم"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">البريد الإلكتروني</label>
                    <div className="relative">
                      <input 
                        type="email" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                      />
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
                    <div className="relative">
                      <input 
                          type={showPassword ? "text" : "password"} 
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="أدخل كلمة المرور"
                      />
                      <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الصلاحية</label>
                    <div className="relative">
                        <select
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none bg-white font-bold"
                            value={role}
                            onChange={(e) => setRole(e.target.value as any)}
                        >
                            <option value="viewer">مشاهد (Viewer)</option>
                            <option value="engineer">مهندس (Engineer)</option>
                            <option value="supervisor">مسؤول عمال (Supervisor)</option>
                            <option value="admin">مسؤول (Admin)</option>
                        </select>
                        <Shield className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <button 
                    type="submit"  
                    disabled={!username.trim() || !password}
                    className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold shadow-sm"
                  >
                    تسجيل وتفعيل فوراً
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Users Lists */}
          <div className={isAdmin ? "lg:col-span-3 space-y-8" : "lg:col-span-4 space-y-8"}>
            
            {/* Pending Requests Section - Only Admin */}
            {isAdmin && pendingUsers.length > 0 && (
              <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                <div className="px-8 py-4 border-b border-orange-200 flex items-center justify-between bg-orange-100/50">
                  <h2 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    طلبات تسجيل معلقة <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full text-sm font-bold">({pendingUsers.length})</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-orange-100/30">
                      <tr>
                        <th className="px-6 py-4 text-sm font-bold text-orange-900">اسم المستخدم</th>
                        <th className="px-6 py-4 text-sm font-bold text-orange-900">البريد الإلكتروني</th>
                        <th className="px-6 py-4 text-sm font-bold text-orange-900">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-100 bg-white">
                      {pendingUsers.map((u) => (
                        <tr key={u.username} className="hover:bg-orange-50/30">
                          <td className="px-6 py-4 font-bold text-gray-900">{u.username}</td>
                          <td className="px-6 py-4 text-gray-600 font-bold">{u.email || '-'}</td>
                          <td className="px-6 py-4 flex gap-3">
                            <button 
                              onClick={() => updateUser(u.username, { status: 'active', role: 'viewer' })}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors shadow-sm font-bold"
                            >
                              <Check className="w-4 h-4" /> قبول
                            </button>
                            <button 
                              onClick={() => deleteUser(u.username)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors shadow-sm font-bold"
                            >
                              <X className="w-4 h-4" /> رفض
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Active Users List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-800">المستخدمون النشطون <span className="text-gray-500 text-base font-bold">({activeUsers.length})</span></h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-separate border-spacing-0">
                  <thead className="bg-gray-100/80">
                    <tr>
                      <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200 first:rounded-tr-lg last:rounded-tl-lg">اسم المستخدم</th>
                      <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">البريد الإلكتروني</th>
                      <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">الصلاحية</th>
                      <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">المشاريع المعينة</th>
                      <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200">كلمة المرور</th>
                      <th className="px-6 py-5 text-sm font-bold text-gray-800 whitespace-nowrap border-b border-gray-200 first:rounded-tr-lg last:rounded-tl-lg">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {activeUsers.map((u, idx) => (
                      <tr key={u.username} className={`hover:bg-blue-50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-6 py-5 font-bold text-gray-900 align-middle text-lg group-hover:text-blue-700 hover:underline transition-colors">{u.username}</td>
                        <td className="px-6 py-5 align-middle text-gray-600 font-bold">{u.email || '-'}</td>
                        <td className="px-6 py-5 align-middle">
                            <span className={`px-3 py-1 rounded-md text-sm font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'engineer' ? 'bg-orange-100 text-orange-800' : u.role === 'supervisor' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-700'}`}>
                            {u.role === 'admin' ? 'مسؤول' : u.role === 'engineer' ? 'مهندس' : u.role === 'supervisor' ? 'مسؤول عمال' : 'مشاهد'}
                            </span>
                        </td>
                        <td className="px-6 py-5 align-middle text-gray-600 font-bold">
                            {u.assignedProjectIds?.length ? (
                            <button
                                onClick={() => setViewProjectsUser(u)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 font-bold text-sm group-hover:bg-white shadow-sm"
                            >
                                <HardHat className="w-4 h-4" />
                                <span>{u.assignedProjectIds.length} مشاريع</span>
                            </button>
                            ) : '-'}
                        </td>
                        <td className="px-6 py-5 align-middle">
                            {u.password && u.password.startsWith('$2') ? (
                            <span className="text-gray-400 font-mono text-sm font-bold" title="كلمة المرور مشفرة">(مشفر)</span>
                            ) : (
                            <span className="font-mono text-gray-800 text-lg font-bold">{u.password}</span>
                            )}
                        </td>
                        <td className="px-6 py-5 align-middle">
                            {u.username === 'admin' ? (
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">حساب أساسي</span>
                            ) : (
                            isAdmin && (
                                <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const passwordText = u.password && u.password.startsWith('$2') ? '******' : u.password;
                                        const message = `مرحبا بك في تطبيق GoStaff\nUsername: ${u.username}\nPassword: ${passwordText}`;
                                        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                                    }}
                                    className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                                    title="إرسال بيانات الدخول عبر واتساب"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => startEdit(u)} 
                                    className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                    title="تعديل"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => deleteUser(u.username)} 
                                    className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                    title="حذف"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                </div>
                            )
                            )}
                        </td>
                      </tr>
                    ))}
                    {activeUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold">
                          لا يوجد مستخدمون نشطون حالياً
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      {viewProjectsUser && (
        <UserProjectsModal 
          user={viewProjectsUser} 
          sites={globalState.sites} 
          onClose={() => setViewProjectsUser(null)} 
        />
      )}
      
      {editingUser && (
        <UserEditModal
          editForm={editForm}
          setEditForm={setEditForm}
          sites={globalState.sites}
          onClose={() => setEditingUser(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

function AlertCircleIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    )
}
