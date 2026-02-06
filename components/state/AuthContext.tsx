'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import bcrypt from 'bcryptjs';
import { useAppState } from './AppStateContext';
import { AuthUserRecord } from '@/types';

interface AuthUser { 
  username: string; 
  role?: AuthUserRecord['role'];
  assignedProjectIds?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  users: AuthUserRecord[];
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (record: AuthUserRecord) => void;
  updateUser: (username: string, patch: Partial<AuthUserRecord>) => void;
  deleteUser: (username: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { state, setState } = useAppState();
  // Ensure users is always an array
  const users = state.users || [];

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // Use sessionStorage for stricter "no direct entry" (session only)
      // Also check localStorage to clear it if exists (migration)
      localStorage.removeItem('labour-auth');
      
      const rawAuth = sessionStorage.getItem('labour-auth');
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth);
        if (parsed && parsed.username) {
            // Find current user data to get latest role and assignments
            const currentUser = users.find(u => u.username === parsed.username);
            setUser({ 
                username: parsed.username,
                role: currentUser?.role || (parsed.username === 'admin' ? 'admin' : 'viewer'),
                assignedProjectIds: currentUser?.assignedProjectIds || []
            });
        }
      }
    } catch {} finally {
      setIsLoading(false);
    }
  }, [users]); // Re-run when users list changes to update role if changed

  const login = async (username: string, password: string) => {
    // Force sync before checking credentials
    try {
        const res = await fetch('/api/sync');
        if (res.ok) {
            const json = await res.json();
            const serverData = json.data;
            if (serverData && serverData.users) {
                // Merge users to ensure we have the latest
                setState(prev => ({
                    ...prev,
                    ...serverData, // This might overwrite local changes if any, but safer for auth
                    users: serverData.users // Explicitly update users
                }));
                // Small delay to allow state to propagate? 
                // React state updates are batched. 
                // We might need to check against 'serverData.users' directly for this login attempt.
                
                const foundServer = serverData.users.find((u: any) => u.username === username);
                let isMatch = false;
                if (foundServer) {
                    isMatch = foundServer.password.startsWith('$2') 
                        ? bcrypt.compareSync(password, foundServer.password) 
                        : foundServer.password === password;
                }

                if (foundServer && isMatch) {
                    if (foundServer.status === 'pending') {
                        alert('حسابك قيد المراجعة من قبل المسؤول');
                        return false;
                    }
                     const userData = { 
                        username, 
                        role: foundServer.role || (username === 'admin' ? 'admin' : 'viewer'),
                        assignedProjectIds: foundServer.assignedProjectIds || []
                    };
                    try { sessionStorage.setItem('labour-auth', JSON.stringify(userData)); } catch {}
                    setUser(userData);
                    return true;
                }
            }
        }
    } catch (e) {
        console.error('Login sync failed, falling back to local state', e);
    }
    
    const found = users.find(u => u.username === username);
    if (!found) return false;

    const isMatch = found.password.startsWith('$2') 
        ? bcrypt.compareSync(password, found.password) 
        : found.password === password;
    
    if (!isMatch) return false;

    // Block pending users
    if (found.status === 'pending') {
      alert('حسابك قيد المراجعة من قبل المسؤول');
      return false;
    }
    
    const userData = { 
        username, 
        role: found.role || (username === 'admin' ? 'admin' : 'viewer'),
        assignedProjectIds: found.assignedProjectIds || []
    };
    
    try { sessionStorage.setItem('labour-auth', JSON.stringify(userData)); } catch {}
    setUser(userData);
    return true;
  };

  const logout = () => {
    try { sessionStorage.removeItem('labour-auth'); } catch {}
    setUser(null);
  };

  const addUser = (record: AuthUserRecord) => {
    if (!record.username || !record.password) return;
    if (users.some(u => u.username === record.username)) return;
    
    // const salt = bcrypt.genSaltSync(10);
    // const hashedPassword = bcrypt.hashSync(record.password, salt);
    // Store password in plain text as requested for admin visibility
    const hashedPassword = record.password;

    const newState = {
      ...state,
      users: [{ ...record, password: hashedPassword }, ...(state.users || [])]
    };

    setState(newState);

    // Sync to server to ensure other devices (like Admin dashboard) can see the new user
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState)
    }).catch(err => console.error('Background sync failed:', err));
  };

  const updateUser = (username: string, patch: Partial<AuthUserRecord>) => {
    const patchToSave = { ...patch };
    if (patch.password) {
        // const salt = bcrypt.genSaltSync(10);
        // patchToSave.password = bcrypt.hashSync(patch.password, salt);
        // Store password in plain text as requested for admin visibility
        patchToSave.password = patch.password;
    }

    const newState = {
      ...state,
      users: (state.users || []).map(u => u.username === username ? { ...u, ...patchToSave } : u)
    };
    
    setState(newState);
    
    // Sync updates (like Accept/Reject or Role Change)
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState)
    }).catch(err => console.error('Background sync failed:', err));
  };

  const deleteUser = (username: string) => {
    const next = users.filter(u => u.username !== username);
    if (next.length === users.length) return; // No change
    
    const newState = {
      ...state,
      users: next
    };

    setState(newState);

    // Sync deletion
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState)
    }).catch(err => console.error('Background sync failed:', err));

    if (user?.username === username) logout();
  };

  return (
    <AuthContext.Provider value={{ user, users, isLoading, login, logout, addUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
