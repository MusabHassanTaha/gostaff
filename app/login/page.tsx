'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/state/AuthContext';
import { Lock, UserPlus, HelpCircle, Mail, User, Key, ArrowRight, Eye, EyeOff, AlertCircle, X } from 'lucide-react';

type Tab = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const { login, addUser, users } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [showThanks, setShowThanks] = useState(false);
  
  // Password Visibility
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Login State
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Prefill username when coming from QR (e.g., /login?u=admin)
  useEffect(() => {
    const u = searchParams.get('u');
    if (u && typeof u === 'string' && !loginUser) {
      setLoginUser(u);
    }
  }, [searchParams]); 

  // Register State
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Forgot State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    // Sanitize inputs for mobile users
    const user = loginUser.trim().toLowerCase(); 
    const pass = loginPass.trim(); // Only trim spaces
    
    // Try lowercase first (most common for admin), if fails, try as is (if they have CaseSensitive username)
    // AuthContext login handles sync internally now
    let ok = await login(user, pass);
    if (!ok && user !== loginUser.trim()) {
         ok = await login(loginUser.trim(), pass);
    }

    if (!ok) {
      setLoginLoading(false);
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
      return;
    }
    
    // Force hard navigation to ensure clean state
    window.location.href = '/';
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regUser.trim() || !regPass) {
        setRegError('يرجى تعبئة الحقول المطلوبة');
        return;
    }
    if (regPass !== regConfirm) {
        setRegError('كلمة المرور غير متطابقة');
        return;
    }

    // Check if user exists
    if (users.some(u => u.username === regUser.trim())) {
        setRegError('اسم المستخدم موجود مسبقاً');
        return;
    }

    // Add user with pending status
    addUser({ 
        username: regUser.trim(), 
        password: regPass, 
        email: regEmail.trim(), 
        status: 'pending',
        role: 'viewer'
    });
    
    // We assume success for now as we can't easily check failure without modifying context return type.
    // However, if the user wasn't added (duplicate), the login won't work with new creds.
    // Ideally we update AuthContext to return boolean. 
    // But let's just show success message.
    setRegSuccess('تم إرسال طلبك بنجاح. يرجى انتظار موافقة المسؤول.');
    setRegUser(''); setRegPass(''); setRegConfirm(''); setRegEmail('');
    setTimeout(() => setActiveTab('login'), 3000);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    if (!forgotEmail.trim()) return;
    
    // Check if email exists
    const found = users.find(u => u.email === forgotEmail.trim());
    
    if (!found) {
        setForgotMsg(`لم يتم العثور على حساب مرتبط بهذا البريد الإلكتروني.`);
        return;
    }

    setForgotMsg('جاري إرسال البريد الإلكتروني...');

    try {
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: found.email,
                subject: 'استعادة كلمة المرور - نظام إدارة العمال',
                text: `مرحباً ${found.username}،\n\nتم استلام طلب استعادة كلمة المرور لحسابك في نظام إدارة العمال.\n\nلأسباب أمنية لا نرسل كلمات المرور عبر البريد.\nسيقوم مسؤول النظام بالتواصل معك لتحديث كلمة المرور أو تزويدك ببيانات الدخول الجديدة.\n\nشكرًا لك.`
            }),
        });

        if (res.ok) {
            setForgotMsg(`تم إرسال طلب استعادة كلمة المرور إلى مسؤول النظام (${found.email}). سيتم التواصل معك قريباً.`);
        } else {
            const data = await res.json();
            if (res.status === 503) {
                 setForgotMsg('خدمة البريد لم يتم إعدادها بعد. يرجى التواصل مع مسؤول النظام لاستعادة كلمة المرور.');
            } else {
                 setForgotMsg('فشل إرسال رسالة الاستعادة. يرجى المحاولة لاحقاً أو التواصل مع مسؤول النظام.');
            }
        }
    } catch (error) {
        setForgotMsg('حدث خطأ أثناء الاتصال بالخادم.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative flex flex-col items-center">
            <div className="relative w-16 h-16 mb-4 bg-white/10 rounded-xl p-2">
                <Image 
                    src="/logo.png" 
                    alt="شعار النظام" 
                    fill 
                    className="object-contain"
                />
            </div>
            <h1 className="text-2xl font-medium mb-2">نظام إدارة العمال</h1>
            <p className="text-slate-400 text-sm">لوحة تحكم نظام إدارة العمال والمشاريع</p>
            <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs leading-relaxed max-w-xs">
              <div className="font-bold text-amber-300 mb-0.5">رمضان مبارك</div>
              <div className="text-amber-100">نسأل الله أن يتقبل منا ومنكم صالح الأعمال وأن يجعله شهر خير وبركة.</div>
              <div className="mt-1.5 text-[11px] text-amber-200" dir="ltr">
                Ramadan Mubarak! May this holy month bring you peace, blessings, and success.
              </div>
            </div>
            <button
              onClick={() => setShowThanks(true)}
              className="absolute left-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="شكر"
            >
              <AlertCircle className="w-5 h-5" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
            <button 
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>دخول</span>
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'register' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    <span>تسجيل جديد</span>
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('forgot')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'forgot' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    <span>استعادة</span>
                </div>
            </button>
        </div>

        {/* Content */}
        <div className="p-6">
            {activeTab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم</label>
                        <div className="relative">
                            <User className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                name="username"
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck="false"
                                className="w-full pr-10 pl-10 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                placeholder="مثلاً: admin"
                                value={loginUser}
                                onChange={e => setLoginUser(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                        <div className="relative">
                            <Key className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                            <input 
                                type={showLoginPass ? "text" : "password"} 
                                name="password"
                                autoComplete="current-password"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck="false"
                                className="w-full pr-10 pl-10 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                placeholder="••••••••"
                                value={loginPass}
                                onChange={e => setLoginPass(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowLoginPass(!showLoginPass)}
                                className="absolute left-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                                {showLoginPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    
                    {loginError && (
                        <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-100 flex items-center gap-2">
                            <HelpCircle className="w-5 h-5" />
                            {loginError}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loginLoading}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
                    >
                        {loginLoading ? 'جاري التحقق...' : 'دخول إلى النظام'}
                        {!loginLoading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>
            )}

            {activeTab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4 font-medium">
                        ملاحظة: طلب التسجيل سيحتاج لموافقة المسؤول قبل تفعيل الحساب.
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم *</label>
                        <input 
                            type="text" 
                            required
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            value={regUser}
                            onChange={e => setRegUser(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني (اختياري)</label>
                        <div className="relative">
                            <Mail className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" />
                            <input 
                                type="email" 
                                className="w-full pr-10 pl-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                value={regEmail}
                                onChange={e => setRegEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور *</label>
                            <div className="relative">
                                <input 
                                    type={showRegPass ? "text" : "password"} 
                                    required
                                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    value={regPass}
                                    onChange={e => setRegPass(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowRegPass(!showRegPass)}
                                    className="absolute left-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showRegPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">تأكيد *</label>
                            <div className="relative">
                                <input 
                                    type={showRegConfirm ? "text" : "password"} 
                                    required
                                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                    value={regConfirm}
                                    onChange={e => setRegConfirm(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowRegConfirm(!showRegConfirm)}
                                    className="absolute left-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showRegConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {regError && <div className="text-sm text-red-600 font-medium">{regError}</div>}
                    {regSuccess && <div className="text-sm text-green-600 font-medium">{regSuccess}</div>}

                    <button 
                        type="submit" 
                        className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-lg shadow-md hover:shadow-lg transition-all mt-2"
                    >
                        تسجيل جديد
                    </button>
                </form>
            )}

            {activeTab === 'forgot' && (
                <form onSubmit={handleForgot} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-blue-600" />
                        </div>
                        <h3 className="text-gray-900 font-medium text-lg">نسيت كلمة المرور؟</h3>
                        <p className="text-gray-500 text-sm mt-2">أدخل بريدك الإلكتروني وسنرسل لك تعليمات الاستعادة.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                        <input 
                            type="email" 
                            required
                            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            placeholder="name@example.com"
                            value={forgotEmail}
                            onChange={e => setForgotEmail(e.target.value)}
                        />
                    </div>

                    {forgotMsg && (
                        <div className="p-4 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg border border-blue-100">
                            {forgotMsg}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-lg shadow-md hover:shadow-lg transition-all"
                    >
                        إرسال رابط الاستعادة
                    </button>
                    
                    <button 
                        type="button"
                        onClick={() => setActiveTab('login')}
                        className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700"
                    >
                        العودة لتسجيل الدخول
                    </button>
                </form>
            )}
        </div>
        
        {showThanks && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowThanks(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2 text-gray-800 font-medium">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <span>رسالة شكر</span>
                </div>
                <button onClick={() => setShowThanks(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-5 leading-8 text-gray-800 text-md">
                <p>
                  إلى أخي وسندي مجدي... من آمن بي حين لم يجرؤ أحد، ومن مد لي يد العون لأطوي مسافات العلم في الهند.
                </p>
                <p className="mt-3">
                  هذا العمل ليس مجرد أسطر برمجية، بل هو ثمرة عطائك الذي لم ينقطع وقلبك الذي احتضن طموحي كأب لابنه.
                </p>
                <p className="mt-3 font-semibold text-blue-700">
                  شكراً لأنك كنت الجسر الذي عبرت من خلاله إلى أحلامي.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <span>تصميم مصعب الملك</span>
              <span dir="ltr">© 2026</span>
            </p>
        </div>
      </div>
    </main>
  );
}
