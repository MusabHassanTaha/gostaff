'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from './state/AuthContext';
import { useAppState } from '@/components/state/AppStateContext';
import { LayoutDashboard, Users, HardHat, ClipboardList, Car, Settings, LogOut, Check, Wallet, FileText } from 'lucide-react';

export default function TopUserBar() {
  const { user, logout } = useAuth();
  const { state, setState } = useAppState();
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/' || !user) return null;

  const role = user.role || 'viewer';

  // Navigation Links based on Role
  const navLinks = [
    // Dashboard: Everyone
    { 
      href: '/', 
      label: 'لوحة التوزيع', 
      icon: LayoutDashboard,
      roles: ['admin', 'supervisor', 'engineer', 'viewer'],
      activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-2 ring-blue-100',
      inactiveClass: 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
    },
    // Projects: Orange
    { 
      href: '/projects', 
      label: 'المشاريع', 
      icon: HardHat,
      roles: ['admin', 'engineer', 'supervisor', 'viewer'],
      activeClass: 'bg-orange-500 text-white shadow-lg shadow-orange-200 ring-2 ring-orange-100',
      inactiveClass: 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'
    },
    // Workers: Indigo
    { 
      href: '/workers', 
      label: 'العمال', 
      icon: Users,
      roles: ['admin', 'supervisor', 'viewer', 'accountant'],
      activeClass: 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-100',
      inactiveClass: 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
    },
    // Reports: Purple
    { 
      href: '/reports', 
      label: 'التقارير', 
      icon: ClipboardList,
      roles: ['admin', 'supervisor', 'engineer', 'accountant'],
      activeClass: 'bg-purple-600 text-white shadow-lg shadow-purple-200 ring-2 ring-purple-100',
      inactiveClass: 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
    },
    { 
      href: '/documents', 
      label: 'المستندات', 
      icon: FileText,
      roles: ['admin', 'supervisor'],
      activeClass: 'bg-amber-600 text-white shadow-lg shadow-amber-200 ring-2 ring-amber-100',
      inactiveClass: 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
    },
     // Vehicles: Pink (Distinct from Red/Purple)
    { 
      href: '/vehicles', 
      label: 'المركبات', 
      icon: Car,
      roles: ['admin', 'supervisor'],
      activeClass: 'bg-pink-600 text-white shadow-lg shadow-pink-200 ring-2 ring-pink-100',
      inactiveClass: 'text-gray-600 hover:bg-pink-50 hover:text-pink-700'
    },
    // Drivers: Red
    { 
      href: '/drivers', 
      label: 'السائقون', 
      icon: Users,
      roles: ['admin', 'supervisor'],
      activeClass: 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-100',
      inactiveClass: 'text-gray-600 hover:bg-red-50 hover:text-red-700'
    },
    // Salaries: Teal
    { 
      href: '/salaries', 
      label: 'الرواتب', 
      icon: Wallet,
      roles: ['admin', 'supervisor'],
      activeClass: 'bg-teal-600 text-white shadow-lg shadow-teal-200 ring-2 ring-teal-100',
      inactiveClass: 'text-gray-600 hover:bg-teal-50 hover:text-teal-700'
    },
    // Users: Green
    { 
      href: '/users', 
      label: 'المستخدمين', 
      icon: Settings,
      roles: ['admin'],
      activeClass: 'bg-green-600 text-white shadow-lg shadow-green-200 ring-2 ring-green-100',
      inactiveClass: 'text-gray-600 hover:bg-green-50 hover:text-green-700'
    },
    { 
      href: '/activity', 
      label: 'السجلات', 
      icon: ClipboardList,
      roles: ['admin'],
      activeClass: 'bg-gray-800 text-white shadow-lg shadow-gray-300 ring-2 ring-gray-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    },
  ];

  const filteredLinks = navLinks.filter(link => link.roles.includes(role));

  return (
    <div className="sticky top-0 z-50 print:hidden w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1920px] mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
               <Image 
                 src="/logo.png" 
                 alt="شعار النظام" 
                 fill
                 className="object-contain"
               />
            </div>
            <span className="font-bold text-gray-800 text-xl hidden md:block">نظام العمال</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar mx-4 py-2">
            {filteredLinks.map(link => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap
                    ${isActive ? link.activeClass : link.inactiveClass}
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Notifications */}
          <div className="flex items-center gap-3">
             {/* Notification Bell Moved to Dashboard */}

             <button 
                onClick={logout} 
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-bold text-sm border border-red-200 shadow-sm"
                title="تسجيل الخروج"
             >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}
