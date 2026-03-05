'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAppState } from '@/components/state/AppStateContext';
import { useAuth } from '@/components/state/AuthContext';
import { CompanyDocument, DocumentCategory, DocumentType } from '@/types';
import { FileText, Image as ImageIcon, Upload, Trash2, Pencil, Plus, FolderTree, Eye, Search } from 'lucide-react';

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  'شهادات حكومية',
  'أوراق التأسيس',
  'عقود',
  'أخرى'
];

function detectTypeFromName(name: string): DocumentType {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
    return 'image';
  }
  return 'other';
}

function formatDate(value: string) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '';
  }
}

export default function DocumentsPage() {
  const { state, setState } = useAppState();
  const { user } = useAuth();

  const role = user?.role as string | undefined;
  const canEdit = role === 'admin' || role === 'supervisor';
  const canDelete = role === 'admin';

  const categories = useMemo<DocumentCategory[]>(() => {
    const source = state.documentCategories && state.documentCategories.length > 0
      ? state.documentCategories
      : DEFAULT_CATEGORIES;
    const seen = new Set<string>();
    const result: DocumentCategory[] = [];
    for (const c of source) {
      const trimmed = (c || '').trim();
      if (!trimmed) continue;
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }
    return result;
  }, [state.documentCategories]);

  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<DocumentCategory>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategory>('شهادات حكومية');
  const [editFileUploading, setEditFileUploading] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]);
      setNewCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const documents = useMemo(() => state.documents || [], [state.documents]);

  const filteredDocuments = useMemo(() => {
    const base = documents.filter(d => !activeCategory || d.category === activeCategory);
    const q = searchQuery.trim().toLowerCase();
    let result = base;
    if (q) {
      result = base.filter(d => {
        const name = d.name.toLowerCase();
        const original = (d.originalName || '').toLowerCase();
        return name.includes(q) || original.includes(q);
      });
    }
    const sorted = [...result].sort((a, b) => {
      const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() || 0 : 0;
      const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() || 0 : 0;
      if (sortOrder === 'newest') return bTime - aTime;
      return aTime - bTime;
    });
    return sorted;
  }, [documents, activeCategory, searchQuery, sortOrder]);

  const startCategoryRename = (cat: DocumentCategory) => {
    setEditingCategory(cat);
    setEditingCategoryName(cat);
    setIsManagingCategories(true);
  };

  const handleCategoryRenameSave = () => {
    if (!editingCategory) return;
    const oldName = editingCategory;
    const newNameRaw = editingCategoryName.trim();
    if (!newNameRaw) {
      alert('يرجى إدخال اسم تصنيف جديد');
      return;
    }
    if (newNameRaw === oldName) {
      setIsManagingCategories(false);
      return;
    }
    if (categories.some(c => c !== oldName && c === newNameRaw)) {
      alert('يوجد تصنيف آخر بنفس هذا الاسم');
      return;
    }
    setState(prev => {
      const currentDocs = prev.documents || [];
      const docs = currentDocs.map(d =>
        d.category === oldName ? { ...d, category: newNameRaw } : d
      );
      const sourceCats = prev.documentCategories && prev.documentCategories.length > 0
        ? prev.documentCategories
        : DEFAULT_CATEGORIES;
      const updatedCats: DocumentCategory[] = [];
      const seen = new Set<string>();
      for (const c of sourceCats) {
        const replaced = c === oldName ? newNameRaw : c;
        const t = (replaced || '').trim();
        if (!t) continue;
        if (!seen.has(t)) {
          seen.add(t);
          updatedCats.push(t);
        }
      }
      return {
        ...prev,
        documents: docs,
        documentCategories: updatedCats
      };
    });
    if (activeCategory === oldName) {
      setActiveCategory(newNameRaw);
    }
    if (newCategory === oldName) {
      setNewCategory(newNameRaw);
    }
    if (editCategory === oldName) {
      setEditCategory(newNameRaw);
    }
    setIsManagingCategories(false);
    setEditingCategory(null);
  };

  const handleUploadForNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const rawCategory = (showNewCategoryInput ? newCategoryName : newCategory) || activeCategory;
    const resolvedCategory = (rawCategory || '').trim();
    if (!resolvedCategory) {
      alert('يرجى اختيار تصنيف أو إدخال تصنيف جديد');
      e.target.value = '';
      return;
    }
    const candidateName = (newName.trim() || file.name.replace(/\.[^.]+$/, '')).toLowerCase();
    const originalLower = file.name.toLowerCase();
    const exists = documents.some(d => d.category === resolvedCategory && (
      d.name.toLowerCase() === candidateName ||
      (d.originalName && d.originalName.toLowerCase() === originalLower)
    ));
    if (exists) {
      alert('هذا المستند مضاف مسبقاً في هذا القسم');
      e.target.value = '';
      return;
    }
    if (!newName.trim()) {
      setNewName(file.name.replace(/\.[^.]+$/, ''));
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      setIsUploading(true);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل رفع الملف');
      }
      const data = await res.json();
      const type = detectTypeFromName(file.name);
      setState(prev => {
        const currentDocs = prev.documents || [];
        const currentCats = prev.documentCategories && prev.documentCategories.length > 0
          ? prev.documentCategories
          : DEFAULT_CATEGORIES;
        const hasCat = currentCats.includes(resolvedCategory);
        const nextCats = hasCat ? currentCats : [...currentCats, resolvedCategory];
        const doc: CompanyDocument = {
          id: `doc-${Date.now()}`,
          name: newName.trim() || file.name,
          category: resolvedCategory,
          type,
          url: data.url,
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        };
        return {
          ...prev,
          documentCategories: nextCats,
          documents: [doc, ...currentDocs]
        };
      });
      setNewName('');
      setNewCategory(resolvedCategory);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setIsAdding(false);
      setFileInputKey(v => v + 1);
      alert('تم حفظ المستند بنجاح');
    } catch (err: any) {
      alert(err?.message || 'فشل رفع الملف');
    } finally {
      setIsUploading(false);
    }
  };

  const startEdit = (doc: CompanyDocument) => {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditCategory(doc.category);
  };

  const handleEditSave = () => {
    if (!canEdit || !editingId) return;
    if (!editName.trim()) {
      alert('يرجى إدخال اسم المستند');
      return;
    }
    setState(prev => ({
      ...prev,
      documents: (prev.documents || []).map(d =>
        d.id === editingId ? { ...d, name: editName.trim(), category: editCategory } : d
      )
    }));
    setEditingId(null);
  };

  const handleUploadForEdit = async (e: React.ChangeEvent<HTMLInputElement>, targetId: string) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setEditFileUploading(true);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل رفع الملف');
      }
      const data = await res.json();
      const type = detectTypeFromName(file.name);
      setState(prev => ({
        ...prev,
        documents: (prev.documents || []).map(d =>
          d.id === targetId
            ? {
                ...d,
                type,
                url: data.url,
                uploadedAt: new Date().toISOString(),
                originalName: file.name
              }
            : d
        )
      }));
      alert('تم تحديث الملف بنجاح');
    } catch (err: any) {
      alert(err?.message || 'فشل رفع الملف');
    } finally {
      setEditFileUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!canDelete) return;
    if (!window.confirm('هل تريد حذف هذا المستند؟')) return;
    setState(prev => ({
      ...prev,
      documents: (prev.documents || []).filter(d => d.id !== id)
    }));
  };

  const handleOpen = (doc: CompanyDocument) => {
    if (typeof window === 'undefined') return;
    window.open(doc.url, '_blank', 'noopener,noreferrer');
  };

  const renderTypeIcon = (type: DocumentType) => {
    if (type === 'image') {
      return <ImageIcon className="w-6 h-6 text-indigo-500" />;
    }
    if (type === 'pdf') {
      return <FileText className="w-6 h-6 text-red-500" />;
    }
    return <FileText className="w-6 h-6 text-gray-500" />;
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-[1920px] mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-3">
              <span className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                <FolderTree className="w-7 h-7" />
              </span>
              إدارة المستندات
            </h1>
            <p className="text-gray-500 mt-1 font-medium text-sm">
              مكتبة رقمية منظمة لحفظ شهادات وأوراق الشركة المهمة
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 shadow-sm"
            >
              لوحة التوزيع
            </Link>
            {canEdit && (
              <>
                <button
                  onClick={() => setIsManagingCategories(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 shadow-sm"
                >
                  <FolderTree className="w-4 h-4" />
                  إدارة التصنيفات
                </button>
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setNewCategory(activeCategory);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  إضافة مستند
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold border transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3 items-stretch">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-300 pl-3 pr-9 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              placeholder="بحث باسم المستند أو باسم الملف..."
            />
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <span className="text-sm font-bold text-gray-600">الترتيب:</span>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="oldest">الأقدم أولاً</option>
            </select>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center text-center text-gray-500 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-bold text-gray-700">لا توجد مستندات في هذا القسم</p>
            {canEdit && (
              <button
                onClick={() => {
                  setIsAdding(true);
                  setNewCategory(activeCategory);
                }}
                className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                إضافة أول مستند
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                    {renderTypeIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 text-sm truncate" title={doc.name}>
                        {doc.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(doc.uploadedAt) || 'تاريخ غير متوفر'}
                    </p>
                    {doc.originalName && (
                      <p className="text-[11px] text-gray-400 mt-1 truncate" title={doc.originalName}>
                        اسم الملف: {doc.originalName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpen(doc)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black"
                  >
                    <Eye className="w-4 h-4" />
                    فتح المستند
                  </button>
                  {canEdit && (
                    <>
                      <label className="flex items-center justify-center px-2 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={e => handleUploadForEdit(e, doc.id)}
                        />
                      </label>
                      <button
                        onClick={() => startEdit(doc)}
                        className="px-2 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="px-2 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdding && canEdit && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">إضافة مستند جديد</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستند</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="مثال: السجل التجاري"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">القسم</label>
                  <select
                    value={showNewCategoryInput ? '__new__' : (newCategory || activeCategory || '')}
                    onChange={e => {
                      const value = e.target.value;
                      if (value === '__new__') {
                        setShowNewCategoryInput(true);
                        setNewCategory('');
                      } else {
                        setShowNewCategoryInput(false);
                        setNewCategory(value as DocumentCategory);
                        setNewCategoryName('');
                      }
                    }}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__new__">+ إضافة تصنيف جديد</option>
                  </select>
                  {showNewCategoryInput && (
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="اكتب اسم التصنيف الجديد..."
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ملف المستند</label>
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-700 cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-bold">
                      {isUploading ? 'جاري الرفع...' : 'اختر ملفاً (PDF أو صورة)'}
                    </span>
                    <input
                      key={fileInputKey}
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={handleUploadForNew}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                    setNewCategory(activeCategory);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                  disabled={isUploading}
                >
                  رفع وحفظ
                </button>
              </div>
            </div>
          </div>
        )}

        {editingId && canEdit && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">تعديل بيانات المستند</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستند</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">القسم</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value as DocumentCategory)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تحديث الملف (اختياري)</label>
                  <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-700 cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-bold">
                      {editFileUploading ? 'جاري الرفع...' : 'اختر ملفاً جديداً'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={e => editingId && handleUploadForEdit(e, editingId)}
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleEditSave}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                  disabled={editFileUploading}
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        )}
        {isManagingCategories && canEdit && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">إدارة التصنيفات</h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => startCategoryRename(cat)}
                    className={`w-full text-right px-3 py-2 rounded-xl border text-sm font-bold ${
                      editingCategory === cat
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {editingCategory && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    تعديل اسم التصنيف:
                  </label>
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={e => setEditingCategoryName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsManagingCategories(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50"
                >
                  إغلاق
                </button>
                {editingCategory && (
                  <button
                    onClick={handleCategoryRenameSave}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                  >
                    حفظ التعديل
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
