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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const financialYears = await prisma.financialyear.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: 'desc' }
  });

  // Auth system removed — always use default admin user
  const user = { name: "Admin", role: "ADMIN" };

  const settings = await prisma.businesssettings.findUnique({ where: { id: "1" } });

  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="antialiased">
          <SettingsProvider initialSettings={settings || {
            pharmacyName: "Vellammal Pharmacy",
            dlNumber: "",
            gstin: "",
            contactInfo: "",
            ownerDetails: ""
          }}>
            <div className="flex h-screen overflow-hidden bg-slate-50">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden">
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
                <main className="flex-1 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
          </SettingsProvider>
      </body>
    </html>
  );
}


