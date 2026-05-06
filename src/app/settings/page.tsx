import prisma from "@/lib/db";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { companyName: 'asc' }
  });

  const doctors = await prisma.doctor.findMany({
    orderBy: { name: 'asc' }
  });

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  const fys = await prisma.financialyear.findMany({
    orderBy: { startDate: 'desc' }
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-primary pl-4 rounded-sm">
            System Settings
          </h1>
          <p className="text-slate-500 mt-1 pl-5">Configure pharmacy registries and staff access.</p>
        </div>
      </div>
      <SettingsClient initialVendors={vendors} initialDoctors={doctors} initialUsers={users} initialFYs={fys} />
    </div>

  );
}
