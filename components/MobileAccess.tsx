'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Smartphone, Copy, Check, Edit2 } from 'lucide-react';

interface MobileAccessProps {
  onClose: () => void;
}

export function MobileAccess({ onClose }: MobileAccessProps) {
  // Priority:
  // 1. NEXT_PUBLIC_APP_URL
  // 2. Window location (if external)
  // 3. Detected IP (fallback)
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [detectedIp, setDetectedIp] = useState('');

  useEffect(() => {
    // 1. Check Env Var
    const envUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (envUrl) {
      setUrl(envUrl);
      return;
    }

    // 2. Check Browser Location (Best for when accessing via LAN IP already)
    // Only use if not localhost/127.0.0.1
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
           setUrl(window.location.origin);
           return;
        }
    }

    // 3. Fallback to API detection (for when accessing via localhost on server)
    fetch('/api/ip')
      .then(res => res.json())
      .then(data => {
        if (data.ip && data.ip !== '127.0.0.1') {
          setDetectedIp(data.ip);
          // If the detected IP is a Docker IP (172.x.x.x), it's likely useless for the phone
          // But we don't know the real LAN IP.
          // We'll set it anyway but maybe the user will change it.
          setUrl(`http://${data.ip}:3000`);
        } else {
           setUrl('http://192.168.8.2:3000'); // Default fallback
        }
      })
      .catch(() => {
         setUrl('http://192.168.8.2:3000');
      });
  }, []);

  const getLoginUrl = () => {
    try {
      // Ensure we always point to /login for immediate authentication on mobile
      // Handle cases where 'url' already has a path
      const base = new URL(url);
      base.pathname = '/login';
      base.search = '';
      base.hash = '';
      return base.toString();
    } catch {
      // Fallback string concat
      const safe = url.replace(/\/+$/, '');
      return `${safe}/login`;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getLoginUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
          <h3 className="font-medium text-lg text-gray-800 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            <span>الدخول من الجوال</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center space-y-6 overflow-y-auto">
          <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 shadow-sm relative group">
            {url && <QRCodeCanvas value={getLoginUrl()} size={220} level="H" includeMargin={true} />}
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-sm font-medium text-gray-600">امسح الكود</span>
            </div>
          </div>
          
          <div className="text-center space-y-2 w-full">
            <p className="text-sm text-gray-600 font-medium">يمكّنك هذا الكود من فتح صفحة الدخول مباشرة:</p>
            
            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-lg border border-gray-200 direction-ltr">
              {isEditing ? (
                <input 
                  className="flex-1 min-w-0 bg-white px-2 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-left dir-ltr"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  autoFocus
                  placeholder="http://192.168.x.x:3000"
                />
              ) : (
                <div 
                  className="flex-1 flex items-center justify-center gap-2 cursor-pointer hover:bg-blue-100 rounded px-2 py-1 transition-colors group"
                  onClick={() => setIsEditing(true)}
                  title="انقر لتعديل العنوان"
                >
                  <code className="font-mono font-medium text-lg text-primary truncate dir-ltr">
                    {getLoginUrl()}
                  </code>
                  <Edit2 className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                </div>
              )}
              
              <button 
                onClick={handleCopy}
                className="p-2 bg-white rounded shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-colors text-gray-600"
                title="نسخ الرابط"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            
            {!isEditing && (
              <p className="text-xs text-gray-400">
                (انقر على الرابط لتعديل العنوان بالكامل)
              </p>
            )}
          </div>

          <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg w-full text-center space-y-1">
            <p>تأكد أن الجوال متصل بنفس شبكة الواي فاي</p>
            {detectedIp && detectedIp.startsWith('172.') && (
                <p className="text-amber-600 font-medium">
                    ملاحظة: يبدو أن النظام يعمل داخل Docker. قد تحتاج لتعديل IP أعلاه يدوياً لعنوان جهازك المحلي (مثل 192.168.x.x).
                </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
