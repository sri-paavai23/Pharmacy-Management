import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { SettingsProvider } from "@/components/SettingsProvider";
import prisma from "@/lib/db";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "Shree Velammal Pharmacy",
  description: "Pharmacy Management System",
};

import { cookies } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const financialYears = await prisma.financialyear.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: 'desc' }
  });

  const authCookie = (await cookies()).get("auth_user");
  let user = null;
  if (authCookie?.value) {
    try {
      user = JSON.parse(authCookie.value);
    } catch (e) {
      console.error("Failed to parse auth_user cookie", e);
      user = null;
    }
  }

  const settings = await prisma.businesssettings.findUnique({ where: { id: "1" } });

  // System Integrity & License Check
  const { checkSystemIntegrity, getDeviceId } = await import("@/lib/security/license");
  const { LicenseCheckUI } = await import("@/components/LicenseCheckUI");
  
  const integrity = await checkSystemIntegrity();
  const deviceId = await getDeviceId();

  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="antialiased">
        {!integrity.valid ? (
          <LicenseCheckUI reason={integrity.reason || 'UNKNOWN'} deviceId={deviceId} />
        ) : (
          <SettingsProvider initialSettings={settings || {
            pharmacyName: "Vellammal Pharmacy",
            dlNumber: "",
            gstin: "",
            contactInfo: "",
            ownerDetails: ""
          }}>
            <div className="flex h-screen overflow-hidden bg-slate-50">
              {user && <Sidebar />}
              <div className="flex-1 flex flex-col overflow-hidden">
                {user && (
                  <Header 
                    financialYears={financialYears} 
                    user={user} 
                    initialSettings={settings || {
                      pharmacyName: "Vellammal Pharmacy",
                      dlNumber: "",
                      gstin: "",
                      contactInfo: "",
                      ownerDetails: ""
                    }} 
                  />
                )}
                <main className="flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
          </SettingsProvider>
        )}
      </body>
    </html>
  );
}


