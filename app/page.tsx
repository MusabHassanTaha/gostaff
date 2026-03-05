'use client';
import dynamic from "next/dynamic";
import { useAuth } from "@/components/state/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Dashboard = dynamic(() => import("@/components/Dashboard"), { ssr: false });

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!isLoading && user?.role === 'accountant') {
      router.replace('/workers');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role === 'accountant') return null;

  return (
    <main className="min-h-screen">
      <Dashboard />
    </main>
  );
}
