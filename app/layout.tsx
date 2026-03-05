import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/state/AppStateContext";
import { AuthProvider } from "@/components/state/AuthContext";
import AuthGate from "@/components/AuthGate";
import TopUserBar from "@/components/TopUserBar";
import ActivityTracker from "@/components/ActivityTracker";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb", // Primary blue color
};

export const metadata: Metadata = {
  title: "نظام إدارة العمال",
  description: "نظام ذكي لتوزيع العمال",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "نظام العمال",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${cairo.className} ${cairo.variable} font-sans antialiased`}>
        <AppProvider>
          <AuthProvider>
            <AuthGate>
              <ActivityTracker />
              <TopUserBar />
              {children}
            </AuthGate>
          </AuthProvider>
        </AppProvider>
      </body>
    </html>
  );
}
